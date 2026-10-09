import {type SupabaseClient} from "jsr:@supabase/supabase-js@2";

// Deleting a prospect's evaluation Demo for good: shared by demo-lifecycle (30 days after its end)
// and demo-account (the platform owner, from Studio). Its people's accounts go first (their
// profiles with them), then the hospital, which takes every record in it along.
export async function deleteDemoOrganization(admin: SupabaseClient, organizationId: string) {
  // Invitations name who sent them, which would hold the sender's account back.
  const {error: ie} = await admin.from("user_invitations").delete().eq("organization_id", organizationId);
  if (ie) throw ie;
  const {data: people, error: le} = await admin.from("profiles").select("id").eq("organization_id", organizationId);
  if (le) throw le;
  for (const p of (people || []) as Array<{id: string}>) {
    const {error} = await admin.auth.admin.deleteUser(p.id);
    if (error) throw error;
  }
  // Accounts gone, their profiles go with them; any left (none expected) would block the hospital.
  const {error: pe} = await admin.from("profiles").delete().eq("organization_id", organizationId);
  if (pe) throw pe;
  const {error: oe} = await admin.from("organizations").delete().eq("id", organizationId).eq("is_demo", true);
  if (oe) throw oe;
}
