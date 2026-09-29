import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";

// Signs a handover between Sterilization and a department. The signed-in Sterilization user is
// one party; the other party confirms with their own user code + password on the same screen.
// Returns who signed, never a session: the password check's session is revoked at once.
// Failed attempts share the login limiter (per code, and per signed-in caller).
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {status, headers: {...cors, "Content-Type": "application/json"}});

const WINDOW_MINUTES = 15;
const MAX_FAILS_PER_CODE = 5;
const MAX_FAILS_PER_CALLER = 20;
const CODE_FORMAT = /^[A-Z]{2}[0-9]{4}$/;
const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Διαχειριστής",
  STERILIZATION: "Αποστείρωση",
  DEPARTMENT: "Χρήστης Τμήματος",
};

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", {headers: cors});
  if (req.method !== "POST") return json({error: "method_not_allowed"}, 405);
  const started = Date.now();
  const settle = async () => {
    const wait = 500 - (Date.now() - started);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
  };
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY") || service;
    const admin = createClient(url, service, {auth: {persistSession: false}});
    const caller = createClient(url, anon, {
      auth: {persistSession: false},
      global: {headers: {Authorization: req.headers.get("Authorization") || ""}},
    });
    const {data: auth} = await caller.auth.getUser();
    if (!auth.user) return json({error: "unauthorized"}, 401);

    const {data: me} = await admin
      .from("profiles")
      .select("id, organization_id, role, active")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (!me?.active) return json({error: "unauthorized"}, 401);
    const body = await req.json().catch(() => ({}));
    // Hospital staff sign within their own hospital; the platform admin within the one it works in.
    const organizationId = me.organization_id || (me.role === "ADMIN" ? String(body?.organization_id || "") : "");
    if (!organizationId) return json({error: "no_organization"}, 400);

    const code = String(body?.user_code || "").trim().toUpperCase();
    const password = String(body?.password || "");
    if (!CODE_FORMAT.test(code) || !password) {
      await settle();
      return json({error: "invalid_credentials"}, 401);
    }

    const {data: attemptId, error: reserveError} = await admin.rpc("reserve_login_attempt", {
      p_user_code: code,
      p_ip: `handover:${auth.user.id}`,
      p_window_minutes: WINDOW_MINUTES,
      p_max_code_fails: MAX_FAILS_PER_CODE,
      p_max_ip_fails: MAX_FAILS_PER_CALLER,
    });
    if (reserveError) {
      await settle();
      return json({error: "unavailable"}, 503);
    }
    if (attemptId === null) {
      await settle();
      return json({error: "too_many_attempts", retry_after_minutes: WINDOW_MINUTES}, 429);
    }

    const {data: person} = await admin
      .from("profiles")
      .select("id, name, email, role, user_code, department:departments(name)")
      .eq("user_code", code)
      .eq("organization_id", organizationId)
      .eq("active", true)
      .maybeSingle();

    let verified = false;
    if (person?.email) {
      const check = createClient(url, anon, {auth: {persistSession: false, autoRefreshToken: false}});
      const {data, error} = await check.auth.signInWithPassword({email: person.email, password});
      if (!error && data.session) {
        verified = true;
        await admin.auth.admin.signOut(data.session.access_token, "local").catch(() => undefined);
      }
    }
    if (verified) await admin.from("login_attempts").update({succeeded: true}).eq("id", attemptId);
    await settle();
    if (!verified || !person) return json({error: "invalid_credentials"}, 401);
    if (person.id === auth.user.id) return json({error: "same_user"}, 409);
    // Read-only viewers take no part in a handover.
    if (person.role === "VIEWER") return json({error: "invalid_credentials"}, 401);

    const department = person.department as {name?: string} | {name?: string}[] | null;
    return json({
      user_id: person.id,
      name: person.name,
      user_code: person.user_code,
      role: ROLE_LABEL[person.role] || person.role,
      department: (Array.isArray(department) ? department[0]?.name : department?.name) || "",
    });
  } catch {
    await settle();
    return json({error: "failed"}, 500);
  }
});
