import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient, type SupabaseClient} from "jsr:@supabase/supabase-js@2";
import {grantAccess, roleName, type Grant} from "../_shared/grantAccess.ts";
import {corsFor, jsonWith} from "../_shared/http.ts";
import {appSite, esc, layout, sendEmail, usernameBox} from "../_shared/mail.ts";

// Staff invitations (platform admin, or a hospital admin for their own hospital).
//  - An invitation: a personal link to the signup form, emailed (or, with send_email false, only
//    returned for the admin to pass on). The person fills in their details and sets their
//    password; their account is made then, inactive, and waits for approval. Valid 7 days.
//  - direct (a new hospital's admin from Studio, a CSV list): the account and its username are
//    made at once and one email carries both, with the button to accept and set the password.
//  - approve_request: activates the waiting account (role, department, supervisor) and emails the
//    person once that they can sign in with their username.
//  - reject_request: declines it, removes the waiting account and emails the person once.
// Roles: ADMIN, STERILIZATION, DEPARTMENT, VIEWER (read only). Admins and viewers have no department.
const ROLES = ["ADMIN", "STERILIZATION", "DEPARTMENT", "VIEWER"];
const corsBase = {"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"};
const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), b => b.toString(16).padStart(2, "0")).join("");

/** A prospect's evaluation Demo holds a limited number of colleagues; any other hospital has no limit. */
async function seatLeft(admin: SupabaseClient, org: string) {
  const {data: left, error} = await admin.rpc("demo_seats_left", {p_org: org});
  if (error) throw error;
  if (left !== null && left !== undefined && Number(left) <= 0) throw new Error("Demo user limit reached");
}

/** A signup invitation: the email carries the form; the request waits there for the person. */
async function inviteToSignup(admin: SupabaseClient, g: Omit<Grant, "name">, send: boolean) {
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
  const invite = {
    department_id: g.dept,
    invited_role: g.role,
    supervisor: g.role === "STERILIZATION" && !!g.supervisor,
    invited_by: g.invitedBy,
    // Sending or copying it again starts its 7 days again.
    invited_at: new Date().toISOString(),
  };
  if (!open) {
    await seatLeft(admin, g.org);
    token = randomToken();
    const {error} = await admin
      .from("staff_access_requests")
      .insert({...invite, organization_id: g.org, full_name: "", email: g.email, status: "PENDING_EMAIL", invite_token: token});
    if (error) throw error;
  } else {
    const {error} = await admin.from("staff_access_requests").update(invite).eq("id", open.id);
    if (error) throw error;
  }
  const url = `${g.site}/#/join/${token}`;
  if (!send) return {emailed: false, url};
  const emailed = await sendEmail(
    [g.email],
    `Πρόσκληση εγγραφής στο SurgiTrack · ${g.orgName}`,
    layout(
      "ΠΡΟΣΚΛΗΣΗ ΕΓΓΡΑΦΗΣ",
      "Σας προσκαλούμε στο SurgiTrack",
      `<p>Το <b>${esc(g.orgName)}</b> σας προσκαλεί να εγγραφείτε στο SurgiTrack.</p>
       <p>Πατήστε το κουμπί, συμπληρώστε τα στοιχεία σας και ορίστε τον κωδικό σας. Θα δείτε αμέσως το όνομα χρήστη σας· μπορείτε να συνδεθείτε μόλις εγκρίνει ο διαχειριστής.</p>
       <p>Ο σύνδεσμος ισχύει 7 ημέρες.</p>`,
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

    const waiting = async (id: unknown) => {
      const {data: r} = await admin
        .from("staff_access_requests")
        .select("id, organization_id, user_id, user_code, full_name, email, status, department_id, supervisor")
        .eq("id", String(id))
        .maybeSingle();
      if (!r) return null;
      return r;
    };

    // Approval: the person's waiting account becomes active (an older request without an account
    // gets one now, with a set-password link).
    if (body?.approve_request) {
      const r = await waiting(body.approve_request);
      if (!r) return json({error: "Request not found"}, 404);
      if (r.status !== "PENDING") return json({error: "Request is not awaiting approval"}, 409);
      const role = String(body.role || "");
      if (!ROLES.includes(role)) return json({error: "Role required"}, 400);
      const orgName = await hospital(r.organization_id);
      const dept = await department(r.organization_id, role, body.department_id ?? r.department_id);
      const supervisor = role === "STERILIZATION" && (body.supervisor ?? r.supervisor) === true;
      const now = new Date().toISOString();
      if (r.user_id) {
        const {error: pe} = await admin
          .from("profiles")
          .update({role, department_id: dept, supervisor, active: true, updated_at: now})
          .eq("id", r.user_id)
          .eq("organization_id", r.organization_id);
        if (pe) throw pe;
        const emailed = await sendEmail(
          [r.email],
          "Η πρόσβασή σας στο SurgiTrack εγκρίθηκε",
          layout(
            "ΕΓΚΡΙΣΗ ΠΡΟΣΒΑΣΗΣ",
            "Η πρόσβασή σας εγκρίθηκε",
            `<p>Ο διαχειριστής ενέκρινε την πρόσβασή σας στο SurgiTrack του <b>${esc(orgName)}</b>.</p>
             ${usernameBox(String(r.user_code || ""))}
             <p>Ρόλος: <b>${esc(roleName(role, supervisor))}</b></p>
             <p>Συνδεθείτε με το όνομα χρήστη (ή με το email σας) και τον κωδικό που ορίσατε στην εγγραφή.</p>`,
            {href: site, label: "Σύνδεση στο SurgiTrack"},
          ),
        );
        await admin.from("staff_access_requests").update({
          status: "APPROVED", granted_role: role, department_id: dept, supervisor, decided_at: now, decided_by: user.id,
          decision_notified_at: emailed ? now : null,
        }).eq("id", r.id);
        return json({ok: true, user_id: r.user_id, user_code: r.user_code, emailed});
      }
      const out = await grantAccess(admin, {
        email: r.email, name: r.full_name, org: r.organization_id, orgName, role, dept, invitedBy: user.id, site, approved: true, supervisor,
      });
      await admin.from("staff_access_requests").update({
        status: "APPROVED", user_id: out.userId, user_code: out.userCode, granted_role: role, department_id: dept, supervisor,
        decided_at: now, decided_by: user.id, decision_notified_at: out.emailed ? now : null,
      }).eq("id", r.id);
      return json({ok: true, user_id: out.userId, user_code: out.userCode, emailed: out.emailed, url: out.url});
    }

    // Rejection: the waiting account is removed (the email can sign up again later); one email says so.
    if (body?.reject_request) {
      const r = await waiting(body.reject_request);
      if (!r) return json({error: "Request not found"}, 404);
      if (r.status !== "PENDING") return json({error: "Request is not awaiting approval"}, 409);
      const orgName = await hospital(r.organization_id);
      const note = String(body.note || "").trim().slice(0, 500);
      const now = new Date().toISOString();
      const {error: re} = await admin.from("staff_access_requests").update({
        status: "REJECTED", user_id: null, decided_at: now, decided_by: user.id, decision_note: note || null,
      }).eq("id", r.id);
      if (re) throw re;
      if (r.user_id) {
        const {data: p} = await admin.from("profiles").select("active").eq("id", r.user_id).maybeSingle();
        // Never an account already in use.
        if (p && !p.active) {
          await admin.from("profiles").delete().eq("id", r.user_id);
          await admin.auth.admin.deleteUser(r.user_id);
        }
      }
      const emailed = await sendEmail(
        [r.email],
        "Η αίτησή σας στο SurgiTrack δεν εγκρίθηκε",
        layout(
          "ΑΙΤΗΣΗ ΠΡΟΣΒΑΣΗΣ",
          "Η αίτησή σας δεν εγκρίθηκε",
          `<p>Ο διαχειριστής του <b>${esc(orgName)}</b> δεν ενέκρινε την αίτησή σας για πρόσβαση στο SurgiTrack.</p>
           ${note ? `<p>Σχόλιο: ${esc(note)}</p>` : ""}
           <p>Για απορίες απευθυνθείτε στον διαχειριστή του νοσοκομείου.</p>`,
        ),
      );
      if (emailed) await admin.from("staff_access_requests").update({decision_notified_at: now}).eq("id", r.id);
      return json({ok: true, emailed});
    }

    const rows = Array.isArray(body?.users) ? body.users : [body];
    if (!rows.length || rows.length > 500) throw new Error("Provide 1-500 users");
    const out = [];
    for (const row of rows) {
      try {
        const email = String(row.email || "").trim().toLowerCase(), name = String(row.full_name || "").trim().replace(/\s+/g, " ");
        const org = String(row.organization_id || "");
        const role = String(row.role || "DEPARTMENT");
        // A new hospital's admin (Studio) or a list the admin has already checked: straight to an account.
        const direct = row.direct === true || body.direct === true;
        if (!email.includes("@") || !org || !ROLES.includes(role) || (direct && name.length < 2)) throw new Error("Invalid user data");
        const orgName = await hospital(org);
        const dept = await department(org, role, row.department_id);
        if (direct) {
          const {data: known} = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
          if (!known) await seatLeft(admin, org);
          const r = await grantAccess(admin, {
            email, name: name.toLocaleUpperCase("el-GR"), org, orgName, role, dept, invitedBy: user.id, site, supervisor: row.supervisor === true,
          });
          out.push({email, ok: true, mode: "account", user_code: r.userCode, emailed: r.emailed, url: r.url});
        } else {
          const r = await inviteToSignup(
            admin,
            {email, org, orgName, role, dept, invitedBy: user.id, site, supervisor: row.supervisor === true},
            body.send_email !== false,
          );
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
