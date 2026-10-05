import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";
import {corsFor, jsonWith} from "../_shared/http.ts";

// Deletes a staff account for good: sign-in, profile, invitation and access requests, so nothing of
// the account stays and the same email can be invited again from scratch. Only a hospital admin
// for users of their own hospital, or the platform admin; never one's own account. The history
// the user left (movements, issues, handovers) stays, with their name as recorded then.
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

    const {data: me} = await admin.from("profiles").select("id, role, active, organization_id").eq("id", auth.user.id).maybeSingle();
    if (!me?.active || me.role !== "ADMIN") return json({error: "forbidden"}, 403);

    const body = await req.json().catch(() => ({}));
    const userId = String(body?.user_id || "");
    if (!userId) return json({error: "user_required"}, 400);
    if (userId === auth.user.id) return json({error: "self"}, 409);

    const {data: target} = await admin.from("profiles").select("id, organization_id, name, email").eq("id", userId).maybeSingle();
    if (!target) return json({error: "not_found"}, 404);
    // A hospital admin only manages their own hospital; the platform admin (no hospital) any.
    if (me.organization_id && target.organization_id !== me.organization_id) return json({error: "forbidden"}, 403);
    if (!target.organization_id) return json({error: "forbidden"}, 403);

    // An invitation the user sent keeps its record but loses the link.
    await admin.from("user_invitations").update({invited_by: null}).eq("invited_by", userId);

    const {error} = await admin.auth.admin.deleteUser(userId);
    if (error) return json({error: "delete_failed", message: error.message}, 500);
    await admin.from("profiles").delete().eq("id", userId);
    const email = String(target.email || "").toLowerCase();
    if (email) {
      await admin.from("user_invitations").delete().eq("organization_id", target.organization_id).eq("email", email);
      await admin.from("staff_access_requests").delete().eq("organization_id", target.organization_id).eq("email", email);
    }
    return json({ok: true, name: target.name});
  } catch (e) {
    return json({error: "failed", message: e instanceof Error ? e.message : String(e)}, 500);
  }
});
