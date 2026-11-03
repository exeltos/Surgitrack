import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";
import {corsFor, jsonWith} from "../_shared/http.ts";

// The first sign-in of a person made by the staff import: they replace the initial password (their mobile number)
// with their own, and only then does the database give them their hospital (profiles.password_change_required).
// The change is made here, not by the browser, so the requirement is lifted only if the password really changed.
// A new password has at least 8 characters with a letter and a number: a mobile number (digits only) can never pass.
const corsBase = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async req => {
  const cors = corsFor(req, corsBase);
  const json = jsonWith(cors);
  if (req.method === "OPTIONS") return new Response("ok", {headers: cors});
  if (req.method !== "POST") return json({error: "method_not_allowed"}, 405);
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
      .select("id, active, password_change_required")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (!me?.active) return json({error: "forbidden"}, 403);
    if (!me.password_change_required) return json({error: "not_required"}, 409);

    const body = await req.json().catch(() => ({}));
    const password = typeof body?.password === "string" ? body.password : "";
    if (password.length < 8 || password.length > 72 || !/\p{L}/u.test(password) || !/\d/.test(password)) {
      return json({error: "password_invalid"}, 400);
    }
    const {error: passwordError} = await admin.auth.admin.updateUserById(auth.user.id, {password});
    if (passwordError) return json({error: "update_failed"}, 500);
    const {error: profileError} = await admin
      .from("profiles")
      .update({password_change_required: false, password_change_deadline: null})
      .eq("id", auth.user.id);
    if (profileError) return json({error: "update_failed"}, 500);
    return json({ok: true});
  } catch (e) {
    console.error("change-initial-password", e instanceof Error ? e.message : e);
    return json({error: "failed"}, 500);
  }
});
