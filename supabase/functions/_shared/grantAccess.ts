import {type SupabaseClient} from "jsr:@supabase/supabase-js@2";
import {esc, layout, mailConfigured, sendEmail, usernameBox} from "./mail.ts";

// Making a staff account: shared by invite-staff (hospital staff) and demo-account (a prospect's Demo).
// The role names the app shows (a Sterilization supervisor is a Sterilization user with a flag).
const ROLE_NAMES: Record<string, string> = {
  ADMIN: "Διαχειριστής νοσοκομείου",
  STERILIZATION: "Χρήστης Αποστείρωσης",
  DEPARTMENT: "Χρήστης Τμήματος",
  VIEWER: "Παρατηρητής (μόνο προβολή)",
};
export const roleName = (role: string, supervisor: boolean) =>
  role === "STERILIZATION" && supervisor ? "Προϊστάμενος Αποστείρωσης" : ROLE_NAMES[role] || role;

export type Grant = {
  email: string;
  name: string;
  org: string;
  orgName: string;
  role: string;
  dept: string | null;
  invitedBy: string;
  site: string;
  approved?: boolean;
  supervisor?: boolean;
  /** An email of its own in place of the usual invitation (a prospect's Demo). */
  message?: (m: {userCode: string; url: string}) => {subject: string; html: string};
};

/**
 * Makes the account (or finds the one still waiting to be accepted) and sends the email with the
 * username and the accept-and-set-password button. Without our own mail settings the sign-in
 * service's own invitation email goes out instead.
 */
export async function grantAccess(admin: SupabaseClient, g: Grant) {
  const {data: existing} = await admin
    .from("profiles")
    .select("id, organization_id, active, user_code")
    .eq("email", g.email)
    .maybeSingle();
  if (existing && (existing.active || existing.organization_id !== g.org)) throw new Error("Email already registered");

  const ownMail = mailConfigured();
  let userId = existing?.id as string | undefined;
  let userCode = existing?.user_code as string | undefined;
  let token: string | undefined;
  let kind: "invite" | "recovery" = "invite";
  if (!userCode) {
    const {data: code, error} = await admin.rpc("generate_user_code", {p_name: g.name});
    if (error || !code) throw new Error("Username failed");
    userCode = String(code);
  }
  const roleLabel = roleName(g.role, !!g.supervisor);
  let departmentName = "Όλο το νοσοκομείο";
  if (g.dept) {
    const {data: d} = await admin.from("departments").select("name").eq("id", g.dept).maybeSingle();
    if (d?.name) departmentName = d.name;
  }
  // The sign-in service's own invitation email (used without our mail settings) reads these as
  // {{ .Data.user_code }}, {{ .Data.organization_name }}, {{ .Data.role_label }}, {{ .Data.department_name }}.
  const meta = {
    full_name: g.name,
    organization_id: g.org,
    department_id: g.dept,
    role: g.role,
    user_code: userCode,
    organization_name: g.orgName,
    role_label: roleLabel,
    department_name: departmentName,
  };

  if (ownMail) {
    let link = await admin.auth.admin.generateLink({type: "invite", email: g.email, options: {redirectTo: g.site, data: meta}});
    if (link.error && existing) {
      // Invited before: the account exists, so a set-password link takes its place.
      kind = "recovery";
      link = await admin.auth.admin.generateLink({type: "recovery", email: g.email, options: {redirectTo: g.site}});
    }
    if (link.error || !link.data?.user) throw link.error || new Error("Invite failed");
    userId = link.data.user.id;
    token = link.data.properties?.hashed_token;
  } else if (!existing) {
    const {data: inv, error} = await admin.auth.admin.inviteUserByEmail(g.email, {redirectTo: g.site, data: meta});
    if (error || !inv.user) throw error || new Error("Invite failed");
    userId = inv.user.id;
  } else {
    const {error} = await admin.auth.resetPasswordForEmail(g.email, {redirectTo: g.site});
    if (error) throw error;
  }

  if (!existing) {
    const {error: pe} = await admin.from("profiles").upsert(
      {
        id: userId, organization_id: g.org, department_id: g.dept, name: g.name, email: g.email, role: g.role, user_code: userCode,
        supervisor: g.role === "STERILIZATION" && !!g.supervisor, active: false, demo_enabled: false,
      },
      {onConflict: "id"},
    );
    if (pe) throw pe;
  }
  await admin.from("user_invitations").upsert(
    {organization_id: g.org, department_id: g.dept, auth_user_id: userId, full_name: g.name, email: g.email, role: g.role, status: "SENT", invited_by: g.invitedBy, last_sent_at: new Date().toISOString()},
    {onConflict: "organization_id,email"},
  );

  let emailed = !ownMail;
  const url = token ? `${g.site}/?st_token=${encodeURIComponent(token)}&st_link=${kind}` : undefined;
  if (url && g.message) {
    const m = g.message({userCode, url});
    emailed = await sendEmail([g.email], m.subject, m.html);
  } else if (url) {
    emailed = await sendEmail(
      [g.email],
      g.approved ? "Η πρόσβασή σας στο SurgiTrack εγκρίθηκε" : `Πρόσκληση στο SurgiTrack · ${g.orgName}`,
      layout(
        g.approved ? "ΕΓΚΡΙΣΗ ΠΡΟΣΒΑΣΗΣ" : "ΠΡΟΣΚΛΗΣΗ",
        g.approved ? "Η πρόσβασή σας εγκρίθηκε" : "Καλώς ήρθατε στο SurgiTrack",
        `<p>${g.approved ? "Ο διαχειριστής ενέκρινε την πρόσβασή σας" : "Σας δόθηκε πρόσβαση"} στο SurgiTrack του <b>${esc(g.orgName)}</b>.</p>
         ${usernameBox(userCode)}
         <p>Ρόλος: <b>${esc(roleLabel)}</b><br>Τμήμα: <b>${esc(departmentName)}</b></p>
         <p>Πατήστε το κουμπί για να ορίσετε τον κωδικό σας. Μετά συνδέεστε με το όνομα χρήστη (ή με το email σας) και τον κωδικό.</p>`,
        {href: url, label: g.approved ? "Ορισμός κωδικού" : "Αποδοχή και ορισμός κωδικού"},
      ),
    );
  }
  return {userId: userId!, userCode, emailed, url};
}
