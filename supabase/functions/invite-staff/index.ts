import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient, type SupabaseClient} from "jsr:@supabase/supabase-js@2";
import {grantAccess, type Grant} from "../_shared/grantAccess.ts";
import {corsFor, jsonWith} from "../_shared/http.ts";
import {appSite, esc, layout, sendEmail} from "../_shared/mail.ts";

// Staff invitations (platform admin, or a hospital admin for their own hospital).
//  - A hospital admin (role ADMIN), or a row of a CSV list (direct): the account and its username are
//    made at once and one email carries both, with the button to accept and set the password.
//  - Anyone else: a signup invitation. The email carries a form where the person fills in their
//    details; the request then waits for the hospital admin's approval.
//  - approve_request: the approval of such a request. The account is made then, and the email
//    carries the username and the button to set the password.
// Roles: ADMIN, STERILIZATION, DEPARTMENT, VIEWER (read only). Admins and viewers have no department.
const ROLES = ["ADMIN", "STERILIZATION", "DEPARTMENT", "VIEWER"];
const corsBase = {"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"};
const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), b => b.toString(16).padStart(2, "0")).join("");

/** A signup invitation: the email carries the form; the request waits there for the person. */
async function inviteToSignup(admin: SupabaseClient, g: Omit<Grant, "name">, again: boolean) {
  const {data: existing} = await admin.from("profiles").select("id").eq("email", g.email).maybeSingle();
  if (existing) throw new Error("Email already registered");
  const {data: open} = await admin
    .from("staff_access_requests")
    .select("id, status, invite_token")
    .eq("organization_id", g.org)
    .eq("email", g.email)
    .in("status", ["PENDING_EMAIL", "PENDING"])
    .maybeSingle();
  if (open?.status === "PENDING") throw new Error("Request already waiting for approval");
  let token = open?.invite_token as string | undefined;
  if (open && !token) throw new Error("Request already open");
  if (!open) {
    token = randomToken();
    const {error} = await admin.from("staff_access_requests").insert({
      organization_id: g.org,
      department_id: g.dept,
      full_name: "",
      email: g.email,
      status: "PENDING_EMAIL",
      invite_token: token,
      invited_role: g.role,
      invited_by: g.invitedBy,
      invited_at: new Date().toISOString(),
    });
    if (error) throw error;
  } else if (again) {
    await admin.from("staff_access_requests").update({invited_role: g.role, invited_at: new Date().toISOString()}).eq("id", open.id);
  }
  const url = `${g.site}/#/join/${token}`;
  const emailed = await sendEmail(
    [g.email],
    `Πρόσκληση εγγραφής στο SurgiTrack · ${g.orgName}`,
    layout(
      "ΠΡΟΣΚΛΗΣΗ ΕΓΓΡΑΦΗΣ",
      "Σας προσκαλούμε στο SurgiTrack",
      `<p>Το <b>${esc(g.orgName)}</b> σας προσκαλεί να εγγραφείτε στο SurgiTrack.</p>
       <p>Πατήστε το κουμπί και συμπληρώστε τα στοιχεία σας. Μετά την έγκριση από τον διαχειριστή θα λάβετε email με το όνομα χρήστη σας και σύνδεσμο για να ορίσετε τον κωδικό σας.</p>`,
      {href: url, label: "Συμπλήρωση στοιχείων"},
    ),
  );
  return {emailed, url};
}

Deno.serve(async req => {
  const cors = corsFor(req, corsBase);
  const json = jsonWith(cors);
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
    const site = appSite(body?.redirect_to);

    const hospital = async (org: string) => {
      if (cp.organization_id && cp.organization_id !== org) throw new Error("Organization not allowed");
      const {data: o} = await admin.from("organizations").select("id,name,active").eq("id", org).single();
      if (!o?.active) throw new Error("Hospital not active");
      return o.name as string;
    };
    const department = async (org: string, role: string, id: unknown) => {
      if (!id || role === "ADMIN" || role === "VIEWER") return null;
      const {data: d} = await admin.from("departments").select("id").eq("id", String(id)).eq("organization_id", org).eq("active", true).single();
      if (!d) throw new Error("Department not valid");
      return d.id as string;
    };

    // Approval of a request that has no account yet.
    if (body?.approve_request) {
      const {data: r} = await admin
        .from("staff_access_requests")
        .select("id, organization_id, user_id, full_name, email, status, department_id")
        .eq("id", String(body.approve_request))
        .maybeSingle();
      if (!r) return json({error: "Request not found"}, 404);
      if (r.status !== "PENDING" || r.user_id) return json({error: "Request is not awaiting approval"}, 409);
      const role = String(body.role || "");
      if (!ROLES.includes(role)) return json({error: "Role required"}, 400);
      const orgName = await hospital(r.organization_id);
      const dept = await department(r.organization_id, role, body.department_id ?? r.department_id);
      const out = await grantAccess(admin, {
        email: r.email, name: r.full_name, org: r.organization_id, orgName, role, dept, invitedBy: user.id, site, approved: true,
        supervisor: body.supervisor === true,
      });
      await admin.from("staff_access_requests").update({
        status: "APPROVED", user_id: out.userId, granted_role: role, department_id: dept, decided_at: new Date().toISOString(),
        decided_by: user.id, decision_notified_at: out.emailed ? new Date().toISOString() : null,
      }).eq("id", r.id);
      return json({ok: true, user_id: out.userId, user_code: out.userCode, emailed: out.emailed, url: out.url});
    }

    const rows = Array.isArray(body?.users) ? body.users : [body];
    if (!rows.length || rows.length > 500) throw new Error("Provide 1-500 users");
    const out = [];
    for (const row of rows) {
      try {
        const email = String(row.email || "").trim().toLowerCase(), name = String(row.full_name || "").trim().replace(/\s+/g, " ");
        const org = String(row.organization_id || "");
        const role = String(row.role || "DEPARTMENT");
        // A hospital admin, or a list the admin has already checked: straight to an account.
        const direct = role === "ADMIN" || row.direct === true || body.direct === true;
        if (!email.includes("@") || !org || !ROLES.includes(role) || (direct && name.length < 2)) throw new Error("Invalid user data");
        const orgName = await hospital(org);
        const dept = await department(org, role, row.department_id);
        if (direct) {
          const r = await grantAccess(admin, {
            email, name: name.toLocaleUpperCase("el-GR"), org, orgName, role, dept, invitedBy: user.id, site, supervisor: row.supervisor === true,
          });
          out.push({email, ok: true, mode: "account", user_code: r.userCode, emailed: r.emailed, url: r.url});
        } else {
          const r = await inviteToSignup(admin, {email, org, orgName, role, dept, invitedBy: user.id, site}, !!body.again);
          out.push({email, ok: true, mode: "signup", emailed: r.emailed, url: r.url});
        }
      } catch (e) {
        out.push({email: String(row?.email || ""), ok: false, error: e instanceof Error ? e.message : "Invite failed"});
      }
    }
    return json({results: out});
  } catch (e) {
    return json({error: e instanceof Error ? e.message : "Request failed"}, 400);
  }
});
