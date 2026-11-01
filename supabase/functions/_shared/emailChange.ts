import type {SupabaseClient} from "jsr:@supabase/supabase-js@2";
import {notifyAccountEvent, recordAccountEvent} from "./accountEvents.ts";

// A hospital admin changing another person's sign-in email does not switch it at once: the new address must
// prove it is the person's. update-staff keeps the request (email_change_requests, only the hash of its one-time
// token) and mails the link to the NEW address; opening the link (#/join/confirm/<token>, answered by
// staff-signup) makes the change. Until then the person keeps signing in with the old email. Only the platform
// owner changes an email at once.

/** A request, and its emailed link, work for 3 days. */
export const EMAIL_CHANGE_DAYS = 3;

export const newChangeToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, "0")).join("");

export const hashToken = async (token: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))), b =>
    b.toString(16).padStart(2, "0"),
  ).join("");

export type ChangeResult =
  | {status: "ok"; email: string; organization: string}
  | {status: "invalid" | "taken" | "unavailable"};

/** The emailed link was opened: the new address is proven, so the change is made. */
export async function confirmEmailChange(admin: SupabaseClient, token: string): Promise<ChangeResult> {
  const {data: request, error} = await admin
    .from("email_change_requests")
    .select("id, organization_id, user_id, new_email, requested_at")
    .eq("token_hash", await hashToken(token))
    .maybeSingle();
  if (error) return {status: "unavailable"};
  if (!request) return {status: "invalid"};
  if (Date.parse(request.requested_at) + EMAIL_CHANGE_DAYS * 864e5 < Date.now()) {
    await admin.from("email_change_requests").delete().eq("id", request.id);
    return {status: "invalid"};
  }
  const {data: profile} = await admin
    .from("profiles")
    .select("id, organization_id, email, role")
    .eq("id", request.user_id)
    .maybeSingle();
  // The request was made by a hospital admin, who may not touch an admin's account (only the platform owner does):
  // if the person has been made an administrator since, the request is void. (update-staff also withdraws a request
  // when the owner changes the person's email or role; this is the second lock.)
  if (!profile || profile.organization_id !== request.organization_id || profile.role === "ADMIN") {
    await admin.from("email_change_requests").delete().eq("id", request.id);
    return {status: "invalid"};
  }
  const pattern = String(request.new_email).replace(/[\\%_]/g, "\\$&");
  const {data: taken} = await admin.from("profiles").select("id").ilike("email", pattern).neq("id", request.user_id).limit(1);
  if (taken?.length) return {status: "taken"};
  // No record, no change (as update-staff does): the completion is kept first, and when it cannot be kept nothing
  // is changed and the request stays, so the link can be opened again.
  const recorded = await recordAccountEvent(admin, {
    organizationId: request.organization_id,
    targetId: request.user_id,
    actorId: request.user_id,
    action: "email_changed",
    detail: {from: profile.email ?? null, to: request.new_email, confirmed: true},
  });
  if (!recorded) return {status: "unavailable"};
  const {error: authError} = await admin.auth.admin.updateUserById(request.user_id, {
    email: request.new_email,
    email_confirm: true,
  });
  if (authError) return {status: /already|registered|exists/i.test(authError.message) ? "taken" : "unavailable"};
  const {error: profileError} = await admin.from("profiles").update({email: request.new_email}).eq("id", request.user_id);
  if (profileError) {
    // Keep the sign-in email and the profile in step.
    if (profile.email) await admin.auth.admin.updateUserById(request.user_id, {email: profile.email, email_confirm: true});
    return {status: "unavailable"};
  }
  await admin.from("email_change_requests").delete().eq("id", request.id);
  if (profile.email) await notifyAccountEvent(profile.email, "email_changed", "");
  const {data: org} = await admin.from("organizations").select("name").eq("id", request.organization_id).maybeSingle();
  return {status: "ok", email: request.new_email, organization: org?.name || ""};
}
