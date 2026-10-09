import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";
import {clientIp, corsFor, jsonWith} from "../_shared/http.ts";

// Public signup form (#/join/<token>): through a hospital's signup link, or a personal invitation
// (emailed, or its link passed on by hand). The person fills in their name, department (and email
// for the hospital link) and sets their password. Their account and username are made at once,
// inactive; the form shows the username. The request waits for the hospital admin, who sees it in
// the app (no email); approval activates the account and emails the person once.
//  - action "info": what the form shows for a token.
//  - otherwise: the form itself.
const corsBase = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Names are stored in capitals (Greek or Latin letters, spaces, hyphens), as on hospital records.
const NAME = /^[A-ZΑ-ΩΆΈΉΊΌΎΏΪΫ][A-ZΑ-ΩΆΈΉΊΌΎΏΪΫ -]*$/u;
// A personal invitation is valid for 7 days (the hospital link carries its own end, 10 days).
export const INVITE_DAYS = 7;
const PASSWORD_MIN = 8;
const upperName = (value: unknown) => String(value || "").trim().replace(/\s+/g, " ").toLocaleUpperCase("el-GR");

Deno.serve(async req => {
  const cors = corsFor(req, corsBase);
  const json = jsonWith(cors);
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
          .select("id, organization_id, email, invited_role, department_id, invited_at, supervisor")
          .eq("invite_token", token)
          .eq("status", "PENDING_EMAIL")
          .is("user_id", null)
          .maybeSingle();
    const linkValid = link && !link.revoked_at && new Date(link.expires_at) > new Date();
    const invitationValid =
      !!invitation && (!invitation.invited_at || Date.parse(invitation.invited_at) + INVITE_DAYS * 864e5 > Date.now());
    const organizationId = (linkValid ? link.organization_id : invitationValid ? invitation?.organization_id : undefined) as
      | string
      | undefined;
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
        expires_at: linkValid
          ? link!.expires_at
          : invitation?.invited_at
            ? new Date(Date.parse(invitation.invited_at) + INVITE_DAYS * 864e5).toISOString()
            : null,
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
    const password = typeof body?.password === "string" ? body.password : "";
    if (!NAME.test(firstName) || !NAME.test(lastName) || !EMAIL.test(email) || (needsDepartment && !departmentId))
      return json({error: "invalid_input"}, 400);
    if (password.length < PASSWORD_MIN || password.length > 72) return json({error: "password_invalid"}, 400);

    // Throttle signups per IP (the same atomic limiter as sign-in).
    const ip = clientIp(req);
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

    let open: {id: string; status: string} | null = null;
    if (!invitation) {
      ({data: open} = await admin
        .from("staff_access_requests")
        .select("id, status")
        .eq("organization_id", organizationId)
        .eq("email", email)
        .in("status", ["PENDING_EMAIL", "PENDING"])
        .maybeSingle());
      if (open?.status === "PENDING") return json({error: "already_pending"}, 409);
    }

    // The account and its username now, inactive until the hospital admin approves.
    const {data: code, error: codeError} = await admin.rpc("generate_user_code", {p_name: fullName});
    if (codeError || !code) return json({error: "signup_failed"}, 500);
    const userCode = String(code);
    const {data: created, error: createError} = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {full_name: fullName, user_code: userCode},
    });
    if (createError || !created?.user) {
      const exists = /already|registered|exists/i.test(createError?.message || "");
      return json({error: exists ? "email_exists" : "signup_failed"}, exists ? 409 : 500);
    }
    const userId = created.user.id;
    const undo = async () => {
      await admin.from("profiles").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId);
    };
    const {error: profileError} = await admin.from("profiles").insert({
      id: userId,
      organization_id: organizationId,
      department_id: department?.id ?? null,
      name: fullName,
      email,
      role: invitation?.invited_role || "DEPARTMENT",
      user_code: userCode,
      active: false,
      demo_enabled: false,
    });
    if (profileError) {
      await undo();
      return json({error: "signup_failed"}, 500);
    }

    const now = new Date().toISOString();
    const row = {
      full_name: fullName,
      department_id: department?.id ?? null,
      status: "PENDING",
      requested_at: now,
      user_id: userId,
      user_code: userCode,
    };
    const {error: requestError} = invitation
      ? await admin.from("staff_access_requests").update(row).eq("id", invitation.id).eq("status", "PENDING_EMAIL")
      : open
        ? await admin.from("staff_access_requests").update({...row, signup_link_id: link!.id}).eq("id", open.id)
        : await admin
            .from("staff_access_requests")
            .insert({...row, signup_link_id: link!.id, organization_id: organizationId, email});
    if (requestError) {
      await undo();
      return json({error: "signup_failed"}, 500);
    }
    await admin.from("login_attempts").update({succeeded: true}).eq("id", attemptId);
    return json({ok: true, user_code: userCode});
  } catch {
    return json({error: "signup_failed"}, 500);
  }
});
