import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";
import {SMTPClient} from "https://deno.land/x/denomailer@1.6.0/mod.ts";

// Email notifications for hospital self-signup:
//  - "notify-admins": the applicant, after confirming their email, alerts the hospital's admins.
//  - "notify-decision": a hospital admin, after approving/rejecting, informs the applicant.
// Emails go out through the same SMTP server as the sign-in emails (secrets SMTP_HOST, SMTP_PORT,
// which is 465 since Edge Functions cannot use 25 or 587, SMTP_USER, SMTP_PASS, MAIL_FROM), or
// through Resend (RESEND_API_KEY, MAIL_FROM). Without either the call succeeds with emailed=false
// and the admin passes the username on in person.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {status, headers: {...cors, "Content-Type": "application/json"}});
const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

/** Sends through SMTP when it is configured; undefined when it is not. */
const sendSmtp = async (to: string[], subject: string, html: string) => {
  const host = Deno.env.get("SMTP_HOST");
  const user = Deno.env.get("SMTP_USER");
  const pass = Deno.env.get("SMTP_PASS");
  const from = Deno.env.get("MAIL_FROM");
  if (!host || !user || !pass || !from) return undefined;
  const port = Number(Deno.env.get("SMTP_PORT") || 465);
  const client = new SMTPClient({connection: {hostname: host, port, tls: port === 465, auth: {username: user, password: pass}}});
  try {
    await client.send({from, to, subject, html, content: "auto"});
    return true;
  } catch (e) {
    console.error("smtp", e instanceof Error ? e.message : e);
    return false;
  } finally {
    await client.close().catch(() => {});
  }
};

const sendResend = async (to: string[], subject: string, html: string) => {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("MAIL_FROM");
  if (!key || !from) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {Authorization: `Bearer ${key}`, "Content-Type": "application/json"},
    body: JSON.stringify({from, to, subject, html}),
  });
  return res.ok;
};

const sendEmail = async (to: string[], subject: string, html: string) => {
  if (!to.length) return false;
  return (await sendSmtp(to, subject, html)) ?? (await sendResend(to, subject, html));
};

/** The same look as the sign-in emails: a dark header, a white card, one button. */
const layout = (eyebrow: string, title: string, body: string, button?: {href: string; label: string}) =>
  `<!doctype html><html lang="el"><body style="margin:0;background:#f4f7fa;font-family:Arial,sans-serif;color:#1d2939">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fa;padding:36px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #e1e7ed;border-radius:16px;overflow:hidden">
<tr><td style="padding:24px 30px;background:#183b56;color:#fff"><div style="font-size:22px;font-weight:800">SurgiTrack</div><div style="font-size:11px;color:#c8d5de;margin-top:4px">Surgical Instrument Traceability</div></td></tr>
<tr><td style="padding:34px 30px"><div style="font-size:11px;font-weight:700;letter-spacing:.1em;color:#738396">${eyebrow}</div><h1 style="font-size:24px;margin:8px 0 12px;color:#152c41">${title}</h1>
<div style="font-size:14px;line-height:1.65;color:#667085">${body}</div>
${button ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:26px 0"><tr><td style="background:#183b56;border-radius:9px"><a href="${button.href}" style="display:inline-block;padding:13px 22px;color:#fff;text-decoration:none;font-size:14px;font-weight:700">${button.label}</a></td></tr></table>` : ""}
<div style="border-top:1px solid #edf1f4;margin-top:28px;padding-top:18px;font-size:11px;color:#98a2b3">SurgiTrack · Healthcare Suite<br>Αυτό είναι αυτοματοποιημένο μήνυμα. Για βοήθεια απευθυνθείτε στον διαχειριστή του νοσοκομείου σας.</div></td></tr></table>
</td></tr></table></body></html>`;

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", {headers: cors});
  if (req.method !== "POST") return json({error: "method_not_allowed"}, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY") || service;
    const appUrl = (Deno.env.get("APP_URL") || "https://surgitrack-med.netlify.app").replace(/\/$/, "");
    const admin = createClient(url, service, {auth: {persistSession: false}});
    const caller = createClient(url, anon, {global: {headers: {Authorization: req.headers.get("Authorization") || ""}}});
    const {data: auth} = await caller.auth.getUser();
    if (!auth.user) return json({error: "unauthorized"}, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    if (action === "notify-admins") {
      const {data: r} = await admin
        .from("staff_access_requests")
        .select("id, organization_id, full_name, email, status, admin_notified_at, department:departments(name), organization:organizations(name)")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (!r || r.status !== "PENDING" || r.admin_notified_at) return json({ok: true, emailed: false});
      const {data: admins} = await admin
        .from("profiles")
        .select("email")
        .eq("organization_id", r.organization_id)
        .eq("role", "ADMIN")
        .eq("active", true);
      const department = (r.department as {name?: string} | null)?.name || "—";
      const hospital = (r.organization as {name?: string} | null)?.name || "";
      const emailed = await sendEmail(
        (admins || []).map(a => a.email).filter(Boolean),
        `Νέα αίτηση πρόσβασης: ${r.full_name}`,
        layout(
          "ΑΙΤΗΣΗ ΠΡΟΣΒΑΣΗΣ",
          "Νέα αίτηση πρόσβασης",
          `<p>Ο/Η <b>${esc(r.full_name)}</b> (${esc(r.email)}) ζητά πρόσβαση στο <b>${esc(hospital)}</b>, τμήμα <b>${esc(department)}</b>.</p>
           <p>Επιλέξτε ρόλο και τμήμα και εγκρίνετε ή απορρίψτε από τη Διαχείριση νοσοκομείου → Χρήστες.</p>`,
          {href: `${appUrl}/#/hospital`, label: "Έγκριση ή απόρριψη"},
        ),
      );
      if (emailed) await admin.from("staff_access_requests").update({admin_notified_at: new Date().toISOString()}).eq("id", r.id);
      return json({ok: true, emailed});
    }

    if (action === "notify-decision") {
      const requestId = String(body?.request_id || "");
      const {data: r} = await admin
        .from("staff_access_requests")
        .select("id, organization_id, user_id, full_name, email, status, decision_note, decision_notified_at, organization:organizations(name)")
        .eq("id", requestId)
        .maybeSingle();
      if (!r) return json({error: "not_found"}, 404);
      // Only the hospital's own admin (or the platform admin) may trigger this.
      const {data: me} = await admin.from("profiles").select("role, active, organization_id").eq("id", auth.user.id).maybeSingle();
      const allowed = me?.active && me.role === "ADMIN" && (me.organization_id === null || me.organization_id === r.organization_id);
      if (!allowed) return json({error: "forbidden"}, 403);
      if (!["APPROVED", "REJECTED"].includes(r.status) || r.decision_notified_at) return json({ok: true, emailed: false});
      const hospital = (r.organization as {name?: string} | null)?.name || "";
      let html: string;
      let subject: string;
      if (r.status === "APPROVED") {
        const {data: p} = await admin.from("profiles").select("user_code").eq("id", r.user_id).maybeSingle();
        subject = "Η πρόσβασή σας στο SurgiTrack εγκρίθηκε";
        html = layout(
          "ΕΓΚΡΙΣΗ ΠΡΟΣΒΑΣΗΣ",
          "Η πρόσβασή σας εγκρίθηκε",
          `<p>Καλώς ήρθατε στο SurgiTrack του <b>${esc(hospital)}</b>.</p>
           <table role="presentation" cellspacing="0" cellpadding="0" style="margin:18px 0;background:#f4f7fa;border-radius:10px;width:100%"><tr><td style="padding:14px 16px">
           <div style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#738396">ΟΝΟΜΑ ΧΡΗΣΤΗ</div>
           <div style="font-size:22px;font-weight:800;letter-spacing:2px;color:#152c41">${esc(p?.user_code || "")}</div></td></tr></table>
           <p>Συνδέεστε με το όνομα χρήστη (ή με το email σας) και τον κωδικό που ορίσατε κατά την εγγραφή.</p>`,
          {href: appUrl, label: "Σύνδεση στο SurgiTrack"},
        );
      } else {
        subject = "Η αίτησή σας στο SurgiTrack δεν εγκρίθηκε";
        html = layout(
          "ΑΙΤΗΣΗ ΠΡΟΣΒΑΣΗΣ",
          "Η αίτησή σας δεν εγκρίθηκε",
          `<p>Η αίτηση πρόσβασης στο <b>${esc(hospital)}</b> δεν εγκρίθηκε.</p>
           ${r.decision_note ? `<p>Σχόλιο του διαχειριστή: ${esc(r.decision_note)}</p>` : ""}
           <p>Για διευκρινίσεις απευθυνθείτε στον διαχειριστή του νοσοκομείου.</p>`,
        );
      }
      const emailed = await sendEmail([r.email], subject, html);
      if (emailed) await admin.from("staff_access_requests").update({decision_notified_at: new Date().toISOString()}).eq("id", r.id);
      return json({ok: true, emailed});
    }

    return json({error: "unknown_action"}, 400);
  } catch {
    return json({error: "failed"}, 500);
  }
});
