import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient, type SupabaseClient} from "jsr:@supabase/supabase-js@2";
import {corsFor, jsonWith, SITE} from "../_shared/http.ts";
import {esc, layout, sendEmail} from "../_shared/mail.ts";

// The morning reminder email of each hospital that turned it on (Studio → Settings → "Reminder emails"):
// sterile dates expired or ending, Sets and instruments left waiting (ready but not collected, sent but not
// received), problems open for a week, and connected devices that stopped reporting. Only barcodes, names
// and departments: never patient codes or free-text notes. Nothing waiting, nothing sent.
// Run every morning by the database scheduler (secret in the Vault, the same as the Demo round), or by the
// platform owner with {organizationId, preview: true} to see a hospital's email without sending it.
const corsBase = {"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret"};

const DAY = 864e5;
export const READY_DAYS = 2;
export const SENT_DAYS = 1;
export const ISSUE_DAYS = 7;
export const DEVICE_HOURS = 24;
const EXAMPLES = 8;
const STERILE_STATES = ["IN_STORAGE", "READY_FOR_PICKUP", "IN_DEPARTMENT"];
const WAITING_STATES = ["READY_FOR_PICKUP", "PENDING_STERILIZATION"];

export type ReminderSetting = "OFF" | "ADMINS" | "ADMINS_SUPERVISORS";
export type AssetRow = {
  barcode: string;
  name: string;
  department: string | null;
  state: string;
  mode?: string;
  updated_at: string;
  extra: {sterileUntil?: string; shelfLifeMonths?: number} | null;
};
export type IssueRow = {asset: string | null; type: string | null; department: string | null; created_at: string};
export type DeviceRow = {name: string; location: string | null; last_seen_at: string | null};
export type Group = {key: string; title: string; count: number; lines: string[]};

/** Today in Athens as YYYY-MM-DD, to compare with sterile dates. */
export const athensToday = (now: number) =>
  new Intl.DateTimeFormat("en-CA", {timeZone: "Europe/Athens", year: "numeric", month: "2-digit", day: "2-digit"}).format(new Date(now));
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);
const line = (a: {barcode: string; name: string; department: string | null}, more = "") =>
  `${a.barcode} · ${a.name}${a.department ? ` · ${a.department}` : ""}${more}`;

/** What one hospital's email says, most urgent first; empty groups left out. */
export function digest(input: {assets: AssetRow[]; issues: IssueRow[]; devices: DeviceRow[]; now: number}): Group[] {
  const {assets, issues, devices, now} = input;
  const today = athensToday(now);
  const tracked = assets.filter(a => a.mode === undefined || a.mode === "STANDALONE");
  const expired: string[] = [];
  const expiring: string[] = [];
  for (const a of tracked) {
    const until = a.extra?.sterileUntil;
    if (!until || !STERILE_STATES.includes(a.state)) continue;
    const left = daysBetween(today, until);
    // The same warning as in the app: the last month, or 10 days for a 2-month shelf life.
    const warn = a.extra?.shelfLifeMonths === 2 ? 10 : 30;
    if (left < 0) expired.push(line(a, ` · έληξε ${until.split("-").reverse().join("/")}`));
    else if (left <= warn) expiring.push(line(a, ` · λήγει ${until.split("-").reverse().join("/")}`));
  }
  const waiting = (state: string, days: number) =>
    tracked
      .filter(a => a.state === state && now - Date.parse(a.updated_at) >= days * DAY)
      .map(a => line(a, ` · ${Math.floor((now - Date.parse(a.updated_at)) / DAY)} ημέρες`));
  const oldIssues = issues
    .filter(i => now - Date.parse(i.created_at) >= ISSUE_DAYS * DAY)
    .map(i => `${i.asset || "—"}${i.type ? ` · ${i.type}` : ""}${i.department ? ` · ${i.department}` : ""}`);
  const silent = devices
    .filter(d => d.last_seen_at && now - Date.parse(d.last_seen_at) >= DEVICE_HOURS * 3600e3)
    .map(d => `${d.name}${d.location ? ` · ${d.location}` : ""}`);
  const groups: Group[] = [
    {key: "expired", title: "Ληγμένη αποστείρωση", count: expired.length, lines: expired},
    {key: "expiring", title: "Λήγουν σύντομα", count: expiring.length, lines: expiring},
    {key: "ready", title: `Έτοιμα, αλλά δεν παραλήφθηκαν εδώ και ${READY_DAYS}+ ημέρες`, count: 0, lines: waiting("READY_FOR_PICKUP", READY_DAYS)},
    {key: "sent", title: "Σταλμένα στην Αποστείρωση, χωρίς παραλαβή από χθες", count: 0, lines: waiting("PENDING_STERILIZATION", SENT_DAYS)},
    {key: "issues", title: `Εκκρεμότητες ανοιχτές πάνω από ${ISSUE_DAYS} ημέρες`, count: oldIssues.length, lines: oldIssues},
    {key: "devices", title: `Συσκευές χωρίς δεδομένα πάνω από ${DEVICE_HOURS} ώρες`, count: silent.length, lines: silent},
  ].map(g => ({...g, count: g.lines.length}));
  return groups.filter(g => g.count > 0);
}

export const reminderEmail = (hospital: string, groups: Group[], dateLabel: string) => ({
  subject: `SurgiTrack · ${hospital}: ${groups.reduce((n, g) => n + g.count, 0)} εκκρεμή για σήμερα`,
  html: layout(
    `ΥΠΕΝΘΥΜΙΣΗ · ${esc(dateLabel)}`,
    `Τι περιμένει σήμερα στο ${esc(hospital)}`,
    groups
      .map(
        g => `<h2 style="font-size:15px;margin:22px 0 6px;color:#152c41">${esc(g.title)} <span style="color:#b42318">(${g.count})</span></h2>
<ul style="margin:0;padding-left:18px">${g.lines
          .slice(0, EXAMPLES)
          .map(l => `<li>${esc(l)}</li>`)
          .join("")}${g.count > EXAMPLES ? `<li>και ${g.count - EXAMPLES} ακόμη</li>` : ""}</ul>`,
      )
      .join("") +
      `<p style="margin-top:22px;font-size:12px">Το email το λαμβάνετε επειδή ο διαχειριστής του νοσοκομείου ενεργοποίησε τις υπενθυμίσεις (Studio → Ρυθμίσεις).</p>`,
    {href: SITE, label: "Άνοιγμα του SurgiTrack"},
  ),
});

const settingOf = async (admin: SupabaseClient, organizationId: string): Promise<ReminderSetting> => {
  const {data} = await admin.from("hospital_settings").select("system_settings").eq("organization_id", organizationId);
  for (const row of (data || []) as Array<{system_settings: {reminderEmails?: string} | null}>) {
    const value = row.system_settings?.reminderEmails;
    if (value === "ADMINS" || value === "ADMINS_SUPERVISORS") return value;
  }
  return "OFF";
};

const recipients = async (admin: SupabaseClient, organizationId: string, setting: ReminderSetting) => {
  const {data} = await admin
    .from("profiles")
    .select("email, role, supervisor")
    .eq("organization_id", organizationId)
    .eq("active", true)
    .in("role", ["ADMIN", "STERILIZATION"]);
  const people = (data || []) as Array<{email: string | null; role: string; supervisor: boolean | null}>;
  const wanted = people.filter(p => p.role === "ADMIN" || (setting === "ADMINS_SUPERVISORS" && p.supervisor));
  return [...new Set(wanted.map(p => p.email).filter((e): e is string => !!e))];
};

const hospitalDigest = async (admin: SupabaseClient, organizationId: string, now: number) => {
  const columns = "barcode, name, department, state, updated_at, extra";
  const [sets, tools, issues, devices] = await Promise.all([
    admin.from("instrument_sets").select(columns).eq("organization_id", organizationId).in("state", [...STERILE_STATES, ...WAITING_STATES]),
    admin
      .from("instruments")
      .select(`${columns}, mode`)
      .eq("organization_id", organizationId)
      .eq("mode", "STANDALONE")
      .in("state", [...STERILE_STATES, ...WAITING_STATES]),
    admin.from("issues").select("asset, type, department, created_at").eq("organization_id", organizationId).eq("status", "OPEN"),
    admin.from("devices").select("name, location, last_seen_at").eq("organization_id", organizationId).eq("active", true),
  ]);
  for (const r of [sets, tools, issues, devices]) if (r.error) throw r.error;
  return digest({
    assets: [...((sets.data || []) as AssetRow[]), ...((tools.data || []) as AssetRow[])],
    issues: (issues.data || []) as IssueRow[],
    devices: (devices.data || []) as DeviceRow[],
    now,
  });
};

Deno.serve(async req => {
  const cors = corsFor(req, corsBase);
  const json = jsonWith(cors);
  if (req.method === "OPTIONS") return new Response("ok", {headers: cors});
  try {
    const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!, service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service);
    const secret = req.headers.get("x-cron-secret") || "";
    const scheduled = !!secret && (await admin.rpc("demo_cron_secret_ok", {p_secret: secret})).data === true;
    const body = (await req.json().catch(() => ({}))) as {organizationId?: string; preview?: boolean};
    const now = Date.now();
    const dateLabel = athensToday(now).split("-").reverse().join("/");

    if (!scheduled) {
      // The platform owner (an active admin of no hospital) may only preview one hospital's email.
      const caller = createClient(url, anon, {global: {headers: {Authorization: req.headers.get("Authorization") || ""}}});
      const {data: {user}} = await caller.auth.getUser();
      if (!user) return json({error: "Unauthorized"}, 401);
      const {data: cp} = await admin.from("profiles").select("role,active,organization_id").eq("id", user.id).maybeSingle();
      if (!cp?.active || cp.role !== "ADMIN" || cp.organization_id) return json({error: "Forbidden"}, 403);
      if (!body.preview || !body.organizationId) return json({error: "Only a preview can be asked for"}, 400);
      const {data: org} = await admin.from("organizations").select("name").eq("id", body.organizationId).maybeSingle();
      if (!org) return json({error: "No such hospital"}, 404);
      const groups = await hospitalDigest(admin, body.organizationId, now);
      const setting = await settingOf(admin, body.organizationId);
      return json({
        setting,
        recipients: (await recipients(admin, body.organizationId, setting === "OFF" ? "ADMINS" : setting)).length,
        groups,
        ...(groups.length ? reminderEmail(org.name, groups, dateLabel) : {}),
      });
    }

    const {data: orgs, error} = await admin.from("organizations").select("id, name, is_demo, active").eq("active", true);
    if (error) throw error;
    const done = {hospitals: 0, emails: 0, failed: 0};
    for (const org of (orgs || []) as Array<{id: string; name: string; is_demo: boolean}>) {
      if (org.is_demo) continue;
      try {
        const setting = await settingOf(admin, org.id);
        if (setting === "OFF") continue;
        const groups = await hospitalDigest(admin, org.id, now);
        if (!groups.length) continue;
        const m = reminderEmail(org.name, groups, dateLabel);
        // One by one, so nobody sees the others' addresses.
        for (const address of await recipients(admin, org.id, setting)) {
          if (await sendEmail([address], m.subject, m.html)) done.emails++;
          else done.failed++;
        }
        done.hospitals++;
      } catch (e) {
        console.error("reminders", org.id, e instanceof Error ? e.message : e);
        done.failed++;
      }
    }
    return json({ok: true, ...done});
  } catch (e) {
    const message = e instanceof Error ? e.message : String((e as {message?: string})?.message || "Request failed");
    return json({error: message}, 400);
  }
});
