import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";
import {appSite, esc, layout, sendEmail} from "../_shared/mail.ts";

// Public signup form (#/join/<token>): through a hospital's signup link, or a personal email
// invitation. The applicant fills in their name, department (and email for the hospital link);
// no account and no password yet. The request waits for the hospital admin, who is alerted by
// email; on approval the applicant gets their username and a link to set their password.
//  - action "info": what the form shows for a token.
//  - otherwise: the form itself.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {status, headers: {...cors, "Content-Type": "application/json"}});

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Names are stored in capitals (Greek or Latin letters, spaces, hyphens), as on hospital records.
const NAME = /^[A-ZΑ-ΩΆΈΉΊΌΎΏΪΫ][A-ZΑ-ΩΆΈΉΊΌΎΏΪΫ -]*$/u;
const upperName = (value: unknown) => String(value || "").trim().replace(/\s+/g, " ").toLocaleUpperCase("el-GR");

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", {headers: cors});
  if (req.method !== "POST") return json({error: "method_not_allowed"}, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service, {auth: {persistSession: false}});
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token || "").trim();
    if (!token) return json({error: "link_invalid"}, 410);

    // The token is a hospital signup link, or a personal invitation still waiting for the form.
    const {data: link, error: linkError} = await admin
      .from("signup_links")
      .select("id, organization_id, expires_at, revoked_at")
      .eq("token", token)
      .maybeSingle();
    if (linkError) return json({error: "unavailable"}, 503);
    const {data: invitation} = link
      ? {data: null}
      : await admin
          .from("staff_access_requests")
          .select("id, organization_id, email, invited_role, department_id")
          .eq("invite_token", token)
          .eq("status", "PENDING_EMAIL")
          .is("user_id", null)
          .maybeSingle();
    const linkValid = link && !link.revoked_at && new Date(link.expires_at) > new Date();
    const organizationId = (linkValid ? link.organization_id : invitation?.organization_id) as string | undefined;
    if (!organizationId) return json({error: "link_invalid"}, 410);
    const {data: org} = await admin.from("organizations").select("name, active, is_demo").eq("id", organizationId).maybeSingle();
    if (!org?.active || org.is_demo) return json({error: "link_invalid"}, 410);
    // Admins and viewers see the whole hospital: no department to pick.
    const needsDepartment = !invitation || !["ADMIN", "VIEWER"].includes(String(invitation.invited_role));

    if (body?.action === "info") {
      const {data: departments} = await admin
        .from("departments")
        .select("id, name, code")
        .eq("organization_id", organizationId)
        .eq("active", true)
        .order("name");
      return json({
        organization_name: org.name,
        expires_at: linkValid ? link!.expires_at : null,
        email: invitation?.email || null,
        department_id: invitation?.department_id || null,
        needs_department: needsDepartment,
        departments: departments || [],
      });
    }

    const firstName = upperName(body?.first_name);
    const lastName = upperName(body?.last_name);
    // "ΟΝΟΜΑ ΕΠΩΝΥΜΟ": the username takes the first letter of each (e.g. ΓΙΩΡΓΟΣ ΝΙΚΟΛΑΟΥ → GN1234).
    const fullName = `${firstName} ${lastName}`;
    const email = invitation ? String(invitation.email) : String(body?.email || "").trim().toLowerCase();
    const departmentId = needsDepartment ? String(body?.department_id || "") : "";
    if (!NAME.test(firstName) || !NAME.test(lastName) || !EMAIL.test(email) || (needsDepartment && !departmentId))
      return json({error: "invalid_input"}, 400);

    // Throttle signups per IP (the same atomic limiter as sign-in).
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
    const {data: attemptId, error: limitError} = await admin.rpc("reserve_login_attempt", {
      p_user_code: "SIGNUP",
      p_ip: `signup:${ip}`,
      p_window_minutes: 60,
      p_max_code_fails: 100000,
      p_max_ip_fails: 10,
    });
    if (limitError) return json({error: "unavailable"}, 503);
    if (attemptId === null) return json({error: "too_many_attempts"}, 429);

    let department: {id: string; name: string} | null = null;
    if (needsDepartment) {
      const {data} = await admin
        .from("departments")
        .select("id, name")
        .eq("id", departmentId)
        .eq("organization_id", organizationId)
        .eq("active", true)
        .maybeSingle();
      if (!data) return json({error: "department_invalid"}, 400);
      department = data;
    }

    const {data: account} = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
    if (account) return json({error: "email_exists"}, 409);

    const now = new Date().toISOString();
    if (invitation) {
      const {error} = await admin
        .from("staff_access_requests")
        .update({full_name: fullName, department_id: department?.id ?? null, status: "PENDING", requested_at: now})
        .eq("id", invitation.id)
        .eq("status", "PENDING_EMAIL");
      if (error) return json({error: "signup_failed"}, 500);
    } else {
      const {data: open} = await admin
        .from("staff_access_requests")
        .select("id, status")
        .eq("organization_id", organizationId)
        .eq("email", email)
        .in("status", ["PENDING_EMAIL", "PENDING"])
        .maybeSingle();
      if (open?.status === "PENDING") return json({error: "already_pending"}, 409);
      const row = {full_name: fullName, department_id: department?.id ?? null, status: "PENDING", requested_at: now, signup_link_id: link!.id};
      const {error} = open
        ? await admin.from("staff_access_requests").update(row).eq("id", open.id)
        : await admin.from("staff_access_requests").insert({...row, organization_id: organizationId, email});
      if (error) return json({error: "signup_failed"}, 500);
    }
    await admin.from("login_attempts").update({succeeded: true}).eq("id", attemptId);

    // Alert the hospital's admins.
    const {data: admins} = await admin
      .from("profiles")
      .select("email")
      .eq("organization_id", organizationId)
      .eq("role", "ADMIN")
      .eq("active", true);
    const site = appSite(body?.origin);
    const emailed = await sendEmail(
      (admins || []).map(a => a.email).filter(Boolean),
      `Νέα αίτηση πρόσβασης: ${fullName}`,
      layout(
        "ΑΙΤΗΣΗ ΠΡΟΣΒΑΣΗΣ",
        "Νέα αίτηση πρόσβασης",
        `<p>Ο/Η <b>${esc(fullName)}</b> (${esc(email)}) ζητά πρόσβαση στο <b>${esc(org.name)}</b>${department ? `, τμήμα <b>${esc(department.name)}</b>` : ""}.</p>
         <p>Ελέγξτε τα στοιχεία, επιλέξτε ρόλο και εγκρίνετε ή απορρίψτε από τη Διαχείριση νοσοκομείου → Χρήστες.</p>`,
        {href: `${site}/#/hospital`, label: "Έγκριση ή απόρριψη"},
      ),
    );
    if (emailed)
      await admin.from("staff_access_requests").update({admin_notified_at: now}).eq("organization_id", organizationId).eq("email", email).eq("status", "PENDING");
    return json({ok: true});
  } catch {
    return json({error: "signup_failed"}, 500);
  }
});
