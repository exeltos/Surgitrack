import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";
import {esc, layout, sendEmail, usernameBox} from "../_shared/mail.ts";

// Email notifications and housekeeping for staff signup:
//  - "notify-admins": an applicant of the older signup (account made at signup), after confirming
//    their email, alerts the hospital's admins. New signups alert them from the form itself.
//  - "notify-decision": a hospital admin, after approving/rejecting, informs the applicant.
//  - "cancel-invite": a hospital admin withdraws a signup invitation not filled in yet.
// Without mail settings the call succeeds with emailed=false and the admin passes it on in person.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {status, headers: {...cors, "Content-Type": "application/json"}});

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
           ${usernameBox(p?.user_code || "")}
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

    if (action === "cancel-invite") {
      const requestId = String(body?.request_id || "");
      const {data: r} = await admin
        .from("staff_access_requests")
        .select("id, organization_id, status, user_id")
        .eq("id", requestId)
        .maybeSingle();
      if (!r) return json({error: "not_found"}, 404);
      const {data: me} = await admin.from("profiles").select("role, active, organization_id").eq("id", auth.user.id).maybeSingle();
      const allowed = me?.active && me.role === "ADMIN" && (me.organization_id === null || me.organization_id === r.organization_id);
      if (!allowed) return json({error: "forbidden"}, 403);
      if (r.status !== "PENDING_EMAIL" || r.user_id) return json({error: "not_an_invitation"}, 409);
      const {error} = await admin.from("staff_access_requests").delete().eq("id", r.id);
      if (error) return json({error: "failed"}, 500);
      return json({ok: true});
    }

    return json({error: "unknown_action"}, 400);
  } catch {
    return json({error: "failed"}, 500);
  }
});
