import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";
import {corsFor, jsonWith} from "../_shared/http.ts";
import {notifyAccountEvent, recordAccountEvent} from "../_shared/accountEvents.ts";

// Edits a staff account: full name, sign-in email, department, role and access (and Demo access,
// for the platform admin only). Only a hospital admin for users of their own hospital, or the
// platform admin. The email changes on the sign-in account too, so the person signs in with the
// new one; the username (user code) stays the same. Nobody changes their own account. An email change
// is recorded in account_events (no record, no change) and both the old and the new address are told.
const corsBase = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ROLES = new Set(["DEPARTMENT", "STERILIZATION", "ADMIN", "VIEWER"]);
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    const name = String(body?.name || "").trim().replace(/\s+/g, " ");
    const email = String(body?.email || "").trim().toLowerCase();
    if (!userId) return json({error: "user_required"}, 400);
    if (!name || name.length > 120) return json({error: "invalid_name"}, 400);
    if (!EMAIL_FORMAT.test(email) || email.length > 254) return json({error: "invalid_email"}, 400);

    // Nobody changes their own account: another admin (or the platform owner) does it for them.
    if (userId === auth.user.id) return json({error: "self"}, 403);

    const {data: target} = await admin
      .from("profiles")
      .select("id, organization_id, email, role, supervisor, active, department_id, demo_enabled")
      .eq("id", userId)
      .maybeSingle();
    if (!target) return json({error: "not_found"}, 404);
    // A hospital admin only manages their own hospital; the platform admin (no hospital) any.
    if (me.organization_id && target.organization_id !== me.organization_id) return json({error: "forbidden"}, 403);
    if (!target.organization_id) return json({error: "forbidden"}, 403);

    // Fields left out keep their value.
    const role = body?.role === undefined ? target.role : String(body.role);
    if (!ROLES.has(role)) return json({error: "invalid_role"}, 400);
    const supervisor = role === "STERILIZATION" && (body?.supervisor === undefined ? !!target.supervisor : !!body.supervisor);
    const active = body?.active === undefined ? target.active : !!body.active;
    const wholeHospital = role === "ADMIN" || role === "VIEWER";
    let departmentId = body?.department_id === undefined ? target.department_id : body.department_id || null;
    if (wholeHospital) departmentId = null;
    if (departmentId) {
      const {data: department} = await admin
        .from("departments")
        .select("id")
        .eq("id", departmentId)
        .eq("organization_id", target.organization_id)
        .maybeSingle();
      if (!department) return json({error: "invalid_department"}, 400);
    }
    // Demo access is the platform admin's to give.
    const demoEnabled =
      !me.organization_id && body?.demo_enabled !== undefined ? !!body.demo_enabled : target.demo_enabled;

    const emailChanged = email !== String(target.email || "").toLowerCase();
    if (emailChanged) {
      const pattern = email.replace(/[\\%_]/g, "\\$&");
      const {data: taken} = await admin.from("profiles").select("id").ilike("email", pattern).neq("id", userId).limit(1);
      if (taken?.length) return json({error: "email_taken"}, 409);
      const recorded = await recordAccountEvent(admin, {
        organizationId: target.organization_id,
        targetId: userId,
        actorId: auth.user.id,
        action: "email_changed",
        detail: {from: target.email ?? null, to: email},
      });
      if (!recorded) return json({error: "audit_failed"}, 500);
      const {error} = await admin.auth.admin.updateUserById(userId, {email, email_confirm: true});
      if (error) {
        const status = /already|registered|exists/i.test(error.message) ? 409 : 500;
        return json({error: status === 409 ? "email_taken" : "update_failed"}, status);
      }
    }
    const {error} = await admin
      .from("profiles")
      .update({
        name,
        email,
        role,
        supervisor,
        active,
        department_id: departmentId,
        demo_enabled: demoEnabled,
      })
      .eq("id", userId);
    if (error) {
      // Keep the sign-in email and the profile in step.
      if (emailChanged && target.email) await admin.auth.admin.updateUserById(userId, {email: target.email, email_confirm: true});
      return json({error: "update_failed"}, 500);
    }
    if (emailChanged) {
      if (target.email) await notifyAccountEvent(target.email, "email_changed", me.name);
      await notifyAccountEvent(email, "email_changed_to", me.name);
    }
    return json({ok: true, name, email});
  } catch (e) {
    console.error("update-staff", e instanceof Error ? e.message : e);
    return json({error: "failed"}, 500);
  }
});
