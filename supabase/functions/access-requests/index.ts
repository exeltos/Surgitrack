import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";
import {corsFor, jsonWith} from "../_shared/http.ts";

// Housekeeping for staff signup (approval and rejection, with their one email, are in invite-staff):
//  - "cancel-invite": a hospital admin withdraws an invitation nobody has signed up with yet.
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
    const caller = createClient(url, anon, {global: {headers: {Authorization: req.headers.get("Authorization") || ""}}});
    const {data: auth} = await caller.auth.getUser();
    if (!auth.user) return json({error: "unauthorized"}, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

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
