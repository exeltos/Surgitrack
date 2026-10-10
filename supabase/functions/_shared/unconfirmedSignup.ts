import type {SupabaseClient} from "jsr:@supabase/supabase-js@2";

// A signup through a hospital link whose email was never confirmed proves nothing about who owns the
// address: it must not keep the owner out. When the owner signs up, or is invited, it is removed first.

/** Removes an unconfirmed hospital-link signup for this email; true when there was one. */
export async function releaseUnconfirmedSignup(admin: SupabaseClient, email: string) {
  const {data: profile} = await admin.from("profiles").select("id, active").eq("email", email).maybeSingle();
  if (!profile || profile.active) return false;
  const {data: request} = await admin
    .from("staff_access_requests")
    .select("id")
    .eq("user_id", profile.id)
    .eq("status", "PENDING_EMAIL")
    .not("confirm_token", "is", null)
    .maybeSingle();
  if (!request) return false;
  await admin.from("staff_access_requests").delete().eq("id", request.id);
  await admin.from("profiles").delete().eq("id", profile.id);
  await admin.auth.admin.deleteUser(profile.id);
  return true;
}
