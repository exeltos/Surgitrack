import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";

// Invites staff by email (platform admin, or a hospital admin for their own hospital).
// Roles: ADMIN, STERILIZATION, DEPARTMENT, VIEWER (read only). Admins and viewers have no department.
const ROLES = ["ADMIN", "STERILIZATION", "DEPARTMENT", "VIEWER"];
const cors = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {status, headers: {...cors, "Content-Type": "application/json"}});

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", {headers: cors});
  try {
    const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!, service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = req.headers.get("Authorization") || "";
    const caller = createClient(url, anon, {global: {headers: {Authorization: token}}});
    const {data: {user}, error: ue} = await caller.auth.getUser();
    if (ue || !user) return json({error: "Unauthorized"}, 401);
    const admin = createClient(url, service);
    const {data: cp} = await admin.from("profiles").select("id,role,active,organization_id").eq("id", user.id).single();
    if (!cp?.active || cp.role !== "ADMIN") return json({error: "Forbidden"}, 403);
    const body = await req.json();
    const rows = Array.isArray(body?.users) ? body.users : [body];
    if (!rows.length || rows.length > 500) throw new Error("Provide 1-500 users");
    const out = [];
    for (const row of rows) {
      try {
        const email = String(row.email || "").trim().toLowerCase(), name = String(row.full_name || "").trim();
        const org = String(row.organization_id || "");
        const role = String(row.role || "DEPARTMENT");
        const dept = row.department_id && role !== "ADMIN" && role !== "VIEWER" ? String(row.department_id) : null;
        if (!email.includes("@") || name.length < 2 || !org || !ROLES.includes(role)) throw new Error("Invalid user data");
        if (cp.organization_id && cp.organization_id !== org) throw new Error("Organization not allowed");
        const {data: o} = await admin.from("organizations").select("id,active").eq("id", org).single();
        if (!o?.active) throw new Error("Hospital not active");
        if (dept) {
          const {data: d} = await admin.from("departments").select("id").eq("id", dept).eq("organization_id", org).eq("active", true).single();
          if (!d) throw new Error("Department not valid");
        }
        const redirectTo = String(body.redirect_to || "https://surgitrack-med.netlify.app");
        const {data: inv, error: ie} = await admin.auth.admin.inviteUserByEmail(email, {redirectTo, data: {full_name: name, organization_id: org, department_id: dept, role}});
        if (ie || !inv.user) throw ie || new Error("Invite failed");
        const {error: pe} = await admin.from("profiles").upsert({id: inv.user.id, organization_id: org, department_id: dept, name, email, role, active: false, demo_enabled: false}, {onConflict: "id"});
        if (pe) throw pe;
        const {data: p} = await admin.from("profiles").select("user_code").eq("id", inv.user.id).single();
        await admin.from("user_invitations").upsert({organization_id: org, department_id: dept, auth_user_id: inv.user.id, full_name: name, email, role, status: "SENT", invited_by: user.id, last_sent_at: new Date().toISOString()}, {onConflict: "organization_id,email"});
        out.push({email, ok: true, user_code: p?.user_code || null});
      } catch (e) {
        out.push({email: String(row?.email || ""), ok: false, error: e instanceof Error ? e.message : "Invite failed"});
      }
    }
    return json({results: out});
  } catch (e) {
    return json({error: e instanceof Error ? e.message : "Request failed"}, 400);
  }
});
