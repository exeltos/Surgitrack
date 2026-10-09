import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";
import {APP_ORIGIN, corsFor, jsonWith, SITE} from "../_shared/http.ts";
import {notifyAccountEvent, recordAccountEvent} from "../_shared/accountEvents.ts";

// Makes a one-time link for a staff member, to pass on by hand (message, phone) when email does
// not reach them: an invitation link for someone who has not accepted yet, or a set-new-password
// link for an active user. The link itself is never emailed. Only a hospital admin for users of
// their own hospital, or the platform admin; never for one's own account. The link opens the app's «Συνέχεια» page,
// which spends it only when the person presses the button. Every link is recorded in account_events
// (no record, no link) and the person is told by email, so a link cannot be used in their name unseen.
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

    const {data: me} = await admin.from("profiles").select("id, name, role, active, organization_id").eq("id", auth.user.id).maybeSingle();
    if (!me?.active || me.role !== "ADMIN") return json({error: "forbidden"}, 403);

    const body = await req.json().catch(() => ({}));
    const userId = String(body?.user_id || "");
    if (!userId) return json({error: "user_required"}, 400);
    if (userId === auth.user.id) return json({error: "self"}, 403);
    const origin = String(body?.origin || "");
    // The link may point only at the app itself.
    const site = APP_ORIGIN.test(origin) ? origin : SITE;

    const {data: target} = await admin.from("profiles").select("id, organization_id, email, active").eq("id", userId).maybeSingle();
    if (!target?.email) return json({error: "not_found"}, 404);
    // A hospital admin only manages their own hospital; the platform admin (no hospital) any.
    if (me.organization_id && target.organization_id !== me.organization_id) return json({error: "forbidden"}, 403);
    if (!target.organization_id) return json({error: "forbidden"}, 403);

    // Someone who has not accepted their invitation gets an invitation link; everyone else a
    // set-new-password link. An invitation that turns out to be accepted already falls back.
    const {data: invitation} = await admin
      .from("user_invitations")
      .select("id")
      .eq("auth_user_id", userId)
      .eq("status", "SENT")
      .maybeSingle();
    let kind: "invite" | "recovery" = !target.active && invitation ? "invite" : "recovery";
    let link = await admin.auth.admin.generateLink({type: kind, email: target.email, options: {redirectTo: site}});
    if (link.error && kind === "invite") {
      kind = "recovery";
      link = await admin.auth.admin.generateLink({type: kind, email: target.email, options: {redirectTo: site}});
    }
    const token = link.data?.properties?.hashed_token;
    if (link.error || !token) return json({error: "link_failed"}, 500);
    const action = kind === "recovery" ? "password_link" : "invite_link";
    const recorded = await recordAccountEvent(admin, {
      organizationId: target.organization_id,
      targetId: userId,
      actorId: auth.user.id,
      action,
    });
    if (!recorded) return json({error: "audit_failed"}, 500);
    await notifyAccountEvent(target.email, action, me.name);
    return json({ok: true, kind, url: `${site}/?st_token=${encodeURIComponent(token)}&st_link=${kind}`});
  } catch (e) {
    console.error("staff-link", e instanceof Error ? e.message : e);
    return json({error: "failed"}, 500);
  }
});
