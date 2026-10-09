import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";
import {corsFor, jsonWith} from "../_shared/http.ts";
import {appSite, esc, layout, sendEmail, usernameBox} from "../_shared/mail.ts";
import {grantAccess} from "../_shared/grantAccess.ts";

// A prospect's evaluation Demo (platform owner only). Studio opens the Demo hospital and fills it
// with sample data; this sends the prospect their account: the Demo's administrator, with one
// email carrying the username, the end date and the button to set the password. Sending it again
// (before they have signed in) gives a new set-password link.
//  - action "notify_request": someone in a Demo asked for the application or for more time; the
//    platform owner is emailed (the request itself is already saved and shows in Studio).
const corsBase = {"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"};

const athensDate = (iso: string) =>
  new Intl.DateTimeFormat("el-GR", {timeZone: "Europe/Athens", day: "2-digit", month: "2-digit", year: "numeric"}).format(
    new Date(iso),
  );

const OWNER_EMAIL = "info@exeltos.com";

export const requestEmail = (r: {
  kind: string;
  hospital: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  site: string;
}) => ({
  subject: r.kind === "PURCHASE" ? `Θέλει την εφαρμογή: ${r.hospital}` : `Ζητά παράταση Demo: ${r.hospital}`,
  html: layout(
    "DEMO ΑΞΙΟΛΟΓΗΣΗΣ",
    r.kind === "PURCHASE" ? "Ενδιαφέρον για την εφαρμογή" : "Αίτημα παράτασης Demo",
    `<p><b>${esc(r.name)}</b> (${esc(r.email)}${r.phone ? `, ${esc(r.phone)}` : ""}) από το Demo <b>${esc(r.hospital)}</b>
     ${r.kind === "PURCHASE" ? "θέλει την εφαρμογή." : "ζητά περισσότερο χρόνο αξιολόγησης."}</p>
     ${r.message ? `<p>Μήνυμα: ${esc(r.message)}</p>` : ""}
     <p>Το αίτημα φαίνεται στο Studio → Νοσοκομεία &amp; Demo → Demo αξιολόγησης.</p>`,
    {href: `${r.site}/#/studio`, label: "Άνοιγμα Studio"},
  ),
});

export const demoEmail = (d: {contactName: string; hospital: string; endsAt: string; userCode: string; url: string}) => ({
  subject: `Το Demo του SurgiTrack για το ${d.hospital} είναι έτοιμο`,
  html: layout(
    "DEMO ΑΞΙΟΛΟΓΗΣΗΣ",
    "Το Demo σας είναι έτοιμο",
    `<p>${esc(d.contactName)}, ετοιμάσαμε για το <b>${esc(d.hospital)}</b> ένα δικό σας περιβάλλον δοκιμής του SurgiTrack,
     με δοκιμαστικά δεδομένα: Σετ και εργαλεία, κύκλοι αποστείρωσης, διακινήσεις προς τα τμήματα, ζητήματα και παραγγελίες.</p>
     ${usernameBox(d.userCode)}
     <p>Είστε ο διαχειριστής του Demo: βλέπετε όλη την εφαρμογή και μπορείτε να προσθέσετε συναδέλφους σας από «Χρήστες &amp; Τμήματα».</p>
     <p>Το Demo είναι διαθέσιμο έως <b>${athensDate(d.endsAt)}</b>. Τα δεδομένα του είναι δοκιμαστικά· μην καταχωρίσετε πραγματικά στοιχεία ασθενών.</p>
     <p>Πατήστε το κουμπί για να ορίσετε τον κωδικό σας. Μετά συνδέεστε με το όνομα χρήστη (ή με το email σας) και τον κωδικό.</p>`,
    {href: d.url, label: "Ορισμός κωδικού και είσοδος"},
  ),
});

Deno.serve(async req => {
  const cors = corsFor(req, corsBase);
  const json = jsonWith(cors);
  if (req.method === "OPTIONS") return new Response("ok", {headers: cors});
  try {
    const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!, service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const caller = createClient(url, anon, {global: {headers: {Authorization: req.headers.get("Authorization") || ""}}});
    const {data: {user}, error: ue} = await caller.auth.getUser();
    if (ue || !user) return json({error: "Unauthorized"}, 401);
    const admin = createClient(url, service);
    const body = await req.json();

    // A request from someone in a Demo: only their own, and only once.
    if (body?.action === "notify_request") {
      const {data: r} = await admin
        .from("demo_requests")
        .select("id, organization_id, user_id, kind, contact_name, phone, message, created_at")
        .eq("id", String(body.request_id || ""))
        .maybeSingle();
      if (!r || r.user_id !== user.id) return json({error: "Request not found"}, 404);
      if (Date.now() - Date.parse(r.created_at) > 10 * 60_000) return json({ok: true, emailed: false});
      // At most 3 emails an hour per person, however many requests they send.
      const {count} = await admin
        .from("demo_requests")
        .select("id", {count: "exact", head: true})
        .eq("user_id", user.id)
        .gte("created_at", new Date(Date.now() - 3_600_000).toISOString());
      if ((count || 0) > 3) return json({ok: true, emailed: false});
      const [{data: org}, {data: who}, {data: settings}] = await Promise.all([
        admin.from("organizations").select("name").eq("id", r.organization_id).single(),
        admin.from("profiles").select("name, email").eq("id", user.id).maybeSingle(),
        admin.from("platform_settings").select("contact_email").maybeSingle(),
      ]);
      const m = requestEmail({
        kind: r.kind,
        hospital: org?.name || "",
        name: r.contact_name || who?.name || "",
        email: who?.email || "",
        phone: r.phone || "",
        message: r.message || "",
        site: appSite(body.redirect_to),
      });
      const emailed = await sendEmail([settings?.contact_email || OWNER_EMAIL], m.subject, m.html);
      return json({ok: true, emailed});
    }

    // The platform owner: an active admin who belongs to no hospital.
    const {data: cp} = await admin.from("profiles").select("id,role,active,organization_id").eq("id", user.id).single();
    if (!cp?.active || cp.role !== "ADMIN" || cp.organization_id) return json({error: "Forbidden"}, 403);
    if (body?.action !== "invite") return json({error: "Unknown action"}, 400);

    const {data: demo} = await admin
      .from("demo_accounts")
      .select("id, organization_id, hospital_name, contact_name, contact_email, seeded_at, evaluator_id")
      .eq("id", String(body.demo_account_id || ""))
      .maybeSingle();
    if (!demo) return json({error: "Demo not found"}, 404);
    const {data: org} = await admin
      .from("organizations")
      .select("id, name, active, is_demo, evaluation, trial_ends_at")
      .eq("id", demo.organization_id)
      .single();
    if (!org?.is_demo || !org.evaluation) return json({error: "Not an evaluation Demo"}, 409);
    if (!org.active) return json({error: "Demo is not active"}, 409);
    if (!org.trial_ends_at || Date.parse(org.trial_ends_at) <= Date.now()) return json({error: "Demo has ended"}, 409);
    // The email goes out only once the Demo has its sample data.
    if (!demo.seeded_at) return json({error: "Sample data not ready"}, 409);
    if (demo.evaluator_id) {
      const {data: evaluator} = await admin.from("profiles").select("active").eq("id", demo.evaluator_id).maybeSingle();
      // Once signed in, they reset a forgotten password from the sign-in screen like everyone else.
      if (evaluator?.active) return json({error: "Already signed in"}, 409);
    }

    const out = await grantAccess(admin, {
      email: String(demo.contact_email).toLowerCase(),
      name: String(demo.contact_name).toLocaleUpperCase("el-GR"),
      org: org.id,
      orgName: org.name,
      role: "ADMIN",
      dept: null,
      invitedBy: user.id,
      site: appSite(body.redirect_to),
      message: ({userCode, url: link}) =>
        demoEmail({contactName: demo.contact_name, hospital: demo.hospital_name, endsAt: org.trial_ends_at, userCode, url: link}),
    });
    const now = new Date().toISOString();
    const {error: de} = await admin
      .from("demo_accounts")
      .update({status: "SENT", evaluator_id: out.userId, invited_at: now, updated_at: now})
      .eq("id", demo.id);
    if (de) throw de;
    return json({ok: true, user_code: out.userCode, emailed: out.emailed, url: out.url});
  } catch (e) {
    const message = e instanceof Error ? e.message : String((e as {message?: string})?.message || "Request failed");
    return json({error: message}, 400);
  }
});
