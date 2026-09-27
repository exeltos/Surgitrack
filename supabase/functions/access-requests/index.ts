import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";

// Email notifications for hospital self-signup:
//  - "notify-admins": the applicant, after confirming their email, alerts the hospital's admins.
//  - "notify-decision": a hospital admin, after approving/rejecting, informs the applicant.
// Emails go through Resend (RESEND_API_KEY, MAIL_FROM). Without them the call succeeds with
// emailed=false and the in-app queue still works.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {status, headers: {...cors, "Content-Type": "application/json"}});
const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

const sendEmail = async (to: string[], subject: string, html: string) => {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("MAIL_FROM");
  if (!key || !from || !to.length) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {Authorization: `Bearer ${key}`, "Content-Type": "application/json"},
    body: JSON.stringify({from, to, subject, html}),
  });
  return res.ok;
};

const layout = (title: string, body: string) =>
  `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1f3a4a">
     <h2 style="color:#0e6d82">SurgiTrack</h2><h3>${title}</h3>${body}
     <p style="color:#7b8f9d;font-size:12px;margin-top:24px">Αυτόματο μήνυμα SurgiTrack.</p></div>`;

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
          "Νέα αίτηση πρόσβασης",
          `<p>Ο/Η <b>${esc(r.full_name)}</b> (${esc(r.email)}) ζητά πρόσβαση στο <b>${esc(hospital)}</b>,
           τμήμα <b>${esc(department)}</b>.</p>
           <p><a href="${appUrl}/#/hospital" style="background:#0e6d82;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Έγκριση ή απόρριψη</a></p>`,
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
          "Η πρόσβασή σας εγκρίθηκε",
          `<p>Καλώς ήρθατε στο SurgiTrack του <b>${esc(hospital)}</b>.</p>
           <p>Όνομα χρήστη: <b style="font-size:18px;letter-spacing:1px">${esc(p?.user_code || "")}</b><br>
           Συνδέεστε με αυτό (ή με το email σας) και τον κωδικό που ορίσατε.</p>
           <p><a href="${appUrl}" style="background:#0e6d82;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Σύνδεση</a></p>`,
        );
      } else {
        subject = "Η αίτησή σας στο SurgiTrack δεν εγκρίθηκε";
        html = layout(
          "Η αίτησή σας δεν εγκρίθηκε",
          `<p>Η αίτηση πρόσβασης στο <b>${esc(hospital)}</b> δεν εγκρίθηκε.</p>
           ${r.decision_note ? `<p>Σχόλιο: ${esc(r.decision_note)}</p>` : ""}
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
