import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient, type SupabaseClient} from "jsr:@supabase/supabase-js@2";
import {corsFor, jsonWith, SITE} from "../_shared/http.ts";
import {esc, layout, sendEmail} from "../_shared/mail.ts";
import {deleteDemoOrganization} from "../_shared/deleteDemo.ts";

// The daily round of the prospects' evaluation Demos (run by the database scheduler, with the
// secret it keeps in the Vault, or by the platform owner from Studio):
//  - 3 days before the end, the Demo's people are told it is ending (once per end date);
//  - once it has ended, they are thanked and offered the application or more time (once per end date);
//  - 30 days after the end, a Demo that did not become a customer is deleted with its accounts,
//    unless the owner chose to keep it.
const corsBase = {"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret"};

const DAY = 864e5;
export const ENDING_NOTICE_DAYS = 3;
export const DELETE_AFTER_DAYS = 30;
/** An "ended" email goes out only for an end this recent (not for Demos that ended long ago). */
const ENDED_NOTICE_WINDOW_DAYS = 7;

const athensDate = (iso: string) =>
  new Intl.DateTimeFormat("el-GR", {timeZone: "Europe/Athens", day: "2-digit", month: "2-digit", year: "numeric"}).format(
    new Date(iso),
  );

export const endingEmail = (d: {hospital: string; endsAt: string; days: number}) => ({
  subject: `Το Demo του SurgiTrack λήγει ${d.days <= 1 ? "αύριο" : `σε ${d.days} ημέρες`}`,
  html: layout(
    "DEMO ΑΞΙΟΛΟΓΗΣΗΣ",
    "Το Demo σας λήγει σύντομα",
    `<p>Το Demo του SurgiTrack για το <b>${esc(d.hospital)}</b> είναι διαθέσιμο έως <b>${athensDate(d.endsAt)}</b>.</p>
     <p>Αν δεν το έχετε κάνει ήδη, πείτε μας τη γνώμη σας από το κουμπί «Αξιολόγηση» στη μπάρα του Demo.
     Χρειάζεστε περισσότερο χρόνο; Πατήστε «Ζητώ παράταση». Θέλετε την εφαρμογή για το νοσοκομείο σας; «Θέλω την εφαρμογή».</p>`,
    {href: SITE, label: "Άνοιγμα του Demo"},
  ),
});

export const endedEmail = (d: {hospital: string}) => ({
  subject: `Το Demo του SurgiTrack για το ${d.hospital} έληξε`,
  html: layout(
    "DEMO ΑΞΙΟΛΟΓΗΣΗΣ",
    "Ευχαριστούμε που δοκιμάσατε το SurgiTrack",
    `<p>Το Demo για το <b>${esc(d.hospital)}</b> έληξε. Τα δεδομένα του διατηρούνται για ${DELETE_AFTER_DAYS} ημέρες.</p>
     <p>Συνδεθείτε για να ζητήσετε παράταση ή για να μας πείτε ότι θέλετε την εφαρμογή· θα επικοινωνήσουμε μαζί σας.</p>`,
    {href: SITE, label: "Σύνδεση"},
  ),
});

type DemoRow = {
  id: string;
  organization_id: string;
  status: string;
  auto_delete: boolean;
  ending_notice_for: string | null;
  ended_notice_for: string | null;
  organizations: {name: string; is_demo: boolean; evaluation: boolean; trial_ends_at: string | null} | null;
};

/** What the round does with one Demo now. */
export const plan = (d: DemoRow, now: number) => {
  const org = d.organizations;
  if (!org?.is_demo || !org.evaluation || d.status === "CONVERTED" || !org.trial_ends_at) return null;
  const end = Date.parse(org.trial_ends_at);
  if (d.auto_delete && now - end > DELETE_AFTER_DAYS * DAY) return "DELETE" as const;
  if (d.status !== "SENT") return null;
  if (end <= now) {
    if (!sameInstant(d.ended_notice_for, org.trial_ends_at) && now - end <= ENDED_NOTICE_WINDOW_DAYS * DAY) return "ENDED" as const;
    return null;
  }
  if (end - now <= ENDING_NOTICE_DAYS * DAY && !sameInstant(d.ending_notice_for, org.trial_ends_at)) return "ENDING" as const;
  return null;
};
const sameInstant = (a: string | null, b: string) => !!a && Date.parse(a) === Date.parse(b);

const recipients = async (admin: SupabaseClient, organizationId: string) => {
  const {data} = await admin.from("profiles").select("email").eq("organization_id", organizationId).eq("active", true);
  return [...new Set(((data || []) as Array<{email: string | null}>).map(p => p.email).filter((e): e is string => !!e))];
};

Deno.serve(async req => {
  const cors = corsFor(req, corsBase);
  const json = jsonWith(cors);
  if (req.method === "OPTIONS") return new Response("ok", {headers: cors});
  try {
    const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!, service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service);
    // The scheduler, or the platform owner (an active admin who belongs to no hospital).
    const secret = req.headers.get("x-cron-secret") || "";
    const scheduled = !!secret && (await admin.rpc("demo_cron_secret_ok", {p_secret: secret})).data === true;
    if (!scheduled) {
      const caller = createClient(url, anon, {global: {headers: {Authorization: req.headers.get("Authorization") || ""}}});
      const {data: {user}} = await caller.auth.getUser();
      if (!user) return json({error: "Unauthorized"}, 401);
      const {data: cp} = await admin.from("profiles").select("role,active,organization_id").eq("id", user.id).maybeSingle();
      if (!cp?.active || cp.role !== "ADMIN" || cp.organization_id) return json({error: "Forbidden"}, 403);
    }

    const {data: demos, error} = await admin
      .from("demo_accounts")
      .select("id, organization_id, status, auto_delete, ending_notice_for, ended_notice_for, organizations(name, is_demo, evaluation, trial_ends_at)");
    if (error) throw error;
    const now = Date.now();
    const done = {ending: 0, ended: 0, deleted: 0, failed: 0};
    for (const d of (demos || []) as DemoRow[]) {
      const step = plan(d, now);
      if (!step) continue;
      try {
        const org = d.organizations!;
        if (step === "DELETE") {
          await deleteDemoOrganization(admin, d.organization_id);
          done.deleted++;
          continue;
        }
        const to = await recipients(admin, d.organization_id);
        const m =
          step === "ENDING"
            ? endingEmail({hospital: org.name, endsAt: org.trial_ends_at!, days: Math.ceil((Date.parse(org.trial_ends_at!) - now) / DAY)})
            : endedEmail({hospital: org.name});
        // Sent one by one, so nobody sees the others' addresses.
        for (const address of to) await sendEmail([address], m.subject, m.html);
        const {error: ue} = await admin
          .from("demo_accounts")
          .update(step === "ENDING" ? {ending_notice_for: org.trial_ends_at} : {ended_notice_for: org.trial_ends_at})
          .eq("id", d.id);
        if (ue) throw ue;
        done[step === "ENDING" ? "ending" : "ended"]++;
      } catch (e) {
        console.error("demo-lifecycle", d.id, e instanceof Error ? e.message : e);
        done.failed++;
      }
    }
    return json({ok: true, ...done});
  } catch (e) {
    const message = e instanceof Error ? e.message : String((e as {message?: string})?.message || "Request failed");
    return json({error: message}, 400);
  }
});
