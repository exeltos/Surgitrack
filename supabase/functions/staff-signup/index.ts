import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";

// Public self-signup through a hospital's signup link. Creates the account unconfirmed, records a
// pending access request for the chosen department and sends the email-confirmation message.
// The hospital admin approves (and picks the role) only after the email is confirmed.
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
    const anon = Deno.env.get("SUPABASE_ANON_KEY") || service;
    const admin = createClient(url, service, {auth: {persistSession: false}});

    const body = await req.json().catch(() => ({}));
    const token = String(body?.token || "").trim();
    const firstName = upperName(body?.first_name);
    const lastName = upperName(body?.last_name);
    // "ΟΝΟΜΑ ΕΠΩΝΥΜΟ": the username takes the first letter of each (e.g. ΓΙΩΡΓΟΣ ΝΙΚΟΛΑΟΥ → GN1234).
    const fullName = `${firstName} ${lastName}`;
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    const departmentId = String(body?.department_id || "");
    const redirectTo = String(body?.redirect_to || "") || undefined;
    if (!token || !NAME.test(firstName) || !NAME.test(lastName) || !EMAIL.test(email) || password.length < 8 || !departmentId)
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

    const {data: link, error: linkError} = await admin
      .from("signup_links")
      .select("id, organization_id, expires_at, revoked_at, organization:organizations(active, is_demo)")
      .eq("token", token)
      .maybeSingle();
    if (linkError) return json({error: "unavailable"}, 503);
    const org = link?.organization as {active?: boolean; is_demo?: boolean} | null;
    if (!link || link.revoked_at || new Date(link.expires_at) <= new Date() || !org?.active || org.is_demo)
      return json({error: "link_invalid"}, 410);

    const {data: department} = await admin
      .from("departments")
      .select("id")
      .eq("id", departmentId)
      .eq("organization_id", link.organization_id)
      .eq("active", true)
      .maybeSingle();
    if (!department) return json({error: "department_invalid"}, 400);

    const {data: created, error: createError} = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: {full_name: fullName, first_name: firstName, last_name: lastName},
    });
    if (createError || !created.user) {
      const exists = /already|registered|exists/i.test(createError?.message || "");
      return json({error: exists ? "email_exists" : "signup_failed"}, exists ? 409 : 500);
    }

    const {error: requestError} = await admin.from("staff_access_requests").insert({
      organization_id: link.organization_id,
      department_id: department.id,
      user_id: created.user.id,
      signup_link_id: link.id,
      full_name: fullName,
      email,
      status: "PENDING_EMAIL",
    });
    if (requestError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return json({error: "signup_failed"}, 500);
    }
    // Supabase sends its (customised) confirmation email; the link returns to the app.
    const auth = createClient(url, anon, {auth: {persistSession: false, autoRefreshToken: false}});
    const {error: mailError} = await auth.auth.resend({type: "signup", email, options: {emailRedirectTo: redirectTo}});
    if (mailError) {
      // Without the confirmation email the account could never be activated, and the address would be
      // stuck as "already registered": undo the signup (the request goes with the user) so it can be retried.
      await admin.auth.admin.deleteUser(created.user.id);
      return json({error: "confirmation_failed"}, 502);
    }
    await admin.from("login_attempts").update({succeeded: true}).eq("id", attemptId);
    return json({ok: true});
  } catch {
    return json({error: "signup_failed"}, 500);
  }
});
