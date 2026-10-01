import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";

// Edits a staff account's details: full name and sign-in email. Only a hospital admin for users
// of their own hospital, or the platform admin. The email changes on the sign-in account too, so
// the person signs in with the new one; the username (user code) stays the same.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {status, headers: {...cors, "Content-Type": "application/json"}});
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async req => {
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

    const {data: me} = await admin.from("profiles").select("id, role, active, organization_id").eq("id", auth.user.id).maybeSingle();
    if (!me?.active || me.role !== "ADMIN") return json({error: "forbidden"}, 403);

    const body = await req.json().catch(() => ({}));
    const userId = String(body?.user_id || "");
    const name = String(body?.name || "").trim().replace(/\s+/g, " ");
    const email = String(body?.email || "").trim().toLowerCase();
    if (!userId) return json({error: "user_required"}, 400);
    if (!name || name.length > 120) return json({error: "invalid_name"}, 400);
    if (!EMAIL_FORMAT.test(email) || email.length > 254) return json({error: "invalid_email"}, 400);

    const {data: target} = await admin.from("profiles").select("id, organization_id, email").eq("id", userId).maybeSingle();
    if (!target) return json({error: "not_found"}, 404);
    // A hospital admin only manages their own hospital; the platform admin (no hospital) any.
    if (me.organization_id && target.organization_id !== me.organization_id) return json({error: "forbidden"}, 403);
    if (!target.organization_id) return json({error: "forbidden"}, 403);

    if (email !== String(target.email || "").toLowerCase()) {
      const {data: taken} = await admin.from("profiles").select("id").ilike("email", email).neq("id", userId).limit(1);
      if (taken?.length) return json({error: "email_taken"}, 409);
      const {error} = await admin.auth.admin.updateUserById(userId, {email, email_confirm: true});
      if (error) {
        const status = /already|registered|exists/i.test(error.message) ? 409 : 500;
        return json({error: status === 409 ? "email_taken" : "update_failed", message: error.message}, status);
      }
    }
    const {error} = await admin.from("profiles").update({name, email}).eq("id", userId);
    if (error) return json({error: "update_failed", message: error.message}, 500);
    return json({ok: true, name, email});
  } catch (e) {
    return json({error: "failed", message: e instanceof Error ? e.message : String(e)}, 500);
  }
});
