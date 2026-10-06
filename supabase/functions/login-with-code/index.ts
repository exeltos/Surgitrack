import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";
import {clientIp, corsFor, jsonWith} from "../_shared/http.ts";

// Signs a user in with their 6-character user code + password without ever
// revealing the email behind the code. Public endpoint (no JWT): the password
// check is the authentication, and failed attempts are rate limited per code and per IP.
const corsBase = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const WINDOW_MINUTES = 15;
const MAX_FAILS_PER_CODE = 5;
const MAX_FAILS_PER_IP = 20;
const CODE_FORMAT = /^[A-Z]{2}[0-9]{4}$/;

Deno.serve(async req => {
  const cors = corsFor(req, corsBase);
  const json = jsonWith(cors);
  if (req.method === "OPTIONS") return new Response("ok", {headers: cors});
  if (req.method !== "POST") return json({error: "method_not_allowed"}, 405);
  const started = Date.now();
  // Keep response time roughly constant so timing does not reveal whether a code exists.
  const settle = async () => {
    const wait = 600 - (Date.now() - started);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
  };
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY") || service;
    const admin = createClient(url, service, {auth: {persistSession: false}});

    const body = await req.json().catch(() => ({}));
    const code = String(body?.user_code || "").trim().toUpperCase();
    const password = String(body?.password || "");
    const ip = clientIp(req);
    if (!CODE_FORMAT.test(code) || !password) {
      await settle();
      return json({error: "invalid_credentials"}, 401);
    }

    // Check the limits and record this attempt as failed in one atomic step, so parallel
    // guesses cannot slip past the limit. Fail closed if the limiter is unavailable.
    const {data: attemptId, error: reserveError} = await admin.rpc("reserve_login_attempt", {
      p_user_code: code,
      p_ip: ip,
      p_window_minutes: WINDOW_MINUTES,
      p_max_code_fails: MAX_FAILS_PER_CODE,
      p_max_ip_fails: MAX_FAILS_PER_IP,
    });
    if (reserveError) {
      await settle();
      return json({error: "login_unavailable"}, 503);
    }
    if (attemptId === null) {
      await settle();
      return json({error: "too_many_attempts", retry_after_minutes: WINDOW_MINUTES}, 429);
    }

    const {data: profile, error: profileError} = await admin
      .from("profiles")
      .select("email")
      .eq("user_code", code)
      .eq("active", true)
      .maybeSingle();
    if (profileError) {
      await settle();
      return json({error: "login_unavailable"}, 503);
    }

    let session = null;
    if (profile?.email) {
      const auth = createClient(url, anon, {auth: {persistSession: false, autoRefreshToken: false}});
      const {data, error} = await auth.auth.signInWithPassword({email: profile.email, password});
      if (!error && data.session) session = data.session;
    }

    // The reserved attempt counts as a failure unless the password was correct.
    if (session) await admin.from("login_attempts").update({succeeded: true}).eq("id", attemptId);
    await settle();
    if (!session) return json({error: "invalid_credentials"}, 401);
    return json({access_token: session.access_token, refresh_token: session.refresh_token});
  } catch {
    await settle();
    return json({error: "login_failed"}, 500);
  }
});
