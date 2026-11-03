import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";
import {corsFor, jsonWith} from "../_shared/http.ts";
import {recordAccountEvent} from "../_shared/accountEvents.ts";
import {
  cleanName,
  DEFAULT_DEADLINE_DAYS,
  EMAIL,
  IMPORT_ROLES,
  MAX_DEADLINE_DAYS,
  MAX_IMPORT_ROWS,
  NAME,
  phonePassword,
  placeholderEmail,
} from "../_shared/staffImport.ts";

// The platform owner's staff import (Studio → a hospital's people → "Εισαγωγή εργαζομένων"): the owner uploads a
// list of the hospital's employees, picks who to activate, and this makes their accounts, active at once, in the
// department the list names. Each person's initial password is their mobile number; they must replace it at their
// first sign-in (password_change_required), within the deadline, or the account is locked (lock_unchanged_passwords).
// Only the platform owner (an active admin of no hospital). Nobody else, whatever their role. The numbers are used
// to make the passwords and are never kept or returned; the answer holds the usernames and the reasons only.
//   body: {organization_id, deadline_days?, rows: [{full_name, department_id, role?, phone, email?}]}
//   answer: {results: [{index, ok, user_code?, error?}]}
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
    if (!me?.active || me.role !== "ADMIN" || me.organization_id) return json({error: "owner_only"}, 403);

    const body = await req.json().catch(() => ({}));
    const organizationId = String(body?.organization_id || "");
    const rows: unknown[] = Array.isArray(body?.rows) ? body.rows : [];
    if (!organizationId || !rows.length) return json({error: "invalid_input"}, 400);
    if (rows.length > MAX_IMPORT_ROWS) return json({error: "too_many_rows", max: MAX_IMPORT_ROWS}, 413);
    const days = Math.min(MAX_DEADLINE_DAYS, Math.max(1, Math.round(Number(body?.deadline_days) || DEFAULT_DEADLINE_DAYS)));

    const {data: org} = await admin.from("organizations").select("id, active, is_demo").eq("id", organizationId).maybeSingle();
    if (!org?.active || org.is_demo) return json({error: "hospital_invalid"}, 400);
    const {data: departments} = await admin.from("departments").select("id").eq("organization_id", organizationId).eq("active", true);
    const departmentIds = new Set((departments || []).map(d => d.id as string));
    const deadline = new Date(Date.now() + days * 864e5).toISOString();

    const results: Array<{index: number; ok: boolean; user_code?: string; error?: string}> = [];
    for (let index = 0; index < rows.length; index++) {
      const row = (rows[index] && typeof rows[index] === "object" ? rows[index] : {}) as Record<string, unknown>;
      const fail = (error: string) => results.push({index, ok: false, error});
      const name = cleanName(row.full_name);
      const role = String(row.role || "DEPARTMENT");
      const departmentId = row.department_id ? String(row.department_id) : "";
      const password = phonePassword(row.phone);
      const given = String(row.email || "").trim().toLowerCase();
      if (!name || name.length > 120 || !NAME.test(name)) {
        fail("invalid_name");
        continue;
      }
      if (!IMPORT_ROLES.has(role)) {
        fail("invalid_role");
        continue;
      }
      // Viewers see the whole hospital; everyone else belongs to a department of it.
      if (role !== "VIEWER" && !departmentIds.has(departmentId)) {
        fail("invalid_department");
        continue;
      }
      if (!password) {
        fail("invalid_phone");
        continue;
      }
      if (given && (!EMAIL.test(given) || given.length > 254)) {
        fail("invalid_email");
        continue;
      }
      // Run twice, a person is made once: the same name in the same hospital, or the same email, is skipped.
      const {data: sameName} = await admin
        .from("profiles")
        .select("id, user_code")
        .eq("organization_id", organizationId)
        .ilike("name", name.replace(/[\\%_]/g, "\\$&"))
        .limit(1);
      if (sameName?.length) {
        results.push({index, ok: false, error: "already_exists", user_code: sameName[0].user_code as string | undefined});
        continue;
      }
      if (given) {
        const {data: sameEmail} = await admin.from("profiles").select("id").ilike("email", given.replace(/[\\%_]/g, "\\$&")).limit(1);
        if (sameEmail?.length) {
          fail("email_taken");
          continue;
        }
      }

      const {data: code, error: codeError} = await admin.rpc("generate_user_code", {p_name: name});
      if (codeError || !code) {
        fail("username_failed");
        continue;
      }
      const userCode = String(code);
      const email = given || placeholderEmail(userCode);
      const {data: created, error: createError} = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {full_name: name, user_code: userCode},
      });
      if (createError || !created?.user) {
        fail(/already|registered|exists/i.test(createError?.message || "") ? "email_taken" : "create_failed");
        continue;
      }
      const userId = created.user.id;
      const undo = async () => {
        await admin.from("profiles").delete().eq("id", userId);
        await admin.auth.admin.deleteUser(userId);
      };
      // No record, no account (as in the other staff functions).
      const recorded = await recordAccountEvent(admin, {
        organizationId,
        targetId: userId,
        actorId: auth.user.id,
        action: "staff_imported",
        detail: {role, department_id: departmentId || null, own_email: !!given},
      });
      if (!recorded) {
        await undo();
        fail("audit_failed");
        continue;
      }
      const {error: profileError} = await admin.from("profiles").insert({
        id: userId,
        organization_id: organizationId,
        department_id: role === "VIEWER" ? null : departmentId,
        name,
        email,
        role,
        user_code: userCode,
        supervisor: false,
        active: true,
        demo_enabled: false,
        password_change_required: true,
        password_change_deadline: deadline,
      });
      if (profileError) {
        await undo();
        fail("create_failed");
        continue;
      }
      results.push({index, ok: true, user_code: userCode});
    }
    return json({results, deadline});
  } catch (e) {
    console.error("import-staff", e instanceof Error ? e.message : e);
    return json({error: "failed"}, 500);
  }
});
