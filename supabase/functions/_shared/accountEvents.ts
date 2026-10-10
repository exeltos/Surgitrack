import type {SupabaseClient} from "jsr:@supabase/supabase-js@2";
import {esc, layout, sendEmail} from "./mail.ts";

// What someone else did to an account (a set-password or invitation link made for it, its sign-in email
// changed) is kept in account_events, which the hospital's admins and the platform owner read and nobody
// signed in can change; and the person is told by email, so nobody can quietly act in their name.

export type AccountAction = "password_link" | "invite_link" | "email_changed";

/** Records the event; false when it could not be kept (the caller then does not act). */
export const recordAccountEvent = async (
  admin: SupabaseClient,
  event: {organizationId: string; targetId: string; actorId: string; action: AccountAction; detail?: Record<string, unknown>},
) => {
  const {error} = await admin.from("account_events").insert({
    organization_id: event.organizationId,
    target_id: event.targetId,
    actor_id: event.actorId,
    action: event.action,
    detail: event.detail ?? {},
  });
  if (error) console.error("account_events", error.message);
  return !error;
};

const athensTime = (now: Date) =>
  new Intl.DateTimeFormat("el-GR", {
    timeZone: "Europe/Athens",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);

/**
 * Tells the person (best effort: a failed email does not undo what was done). An email change is told
 * to both addresses: the old one so its owner learns of it, the new one ("email_changed_to") in case
 * the old one is no longer read.
 */
export const notifyAccountEvent = async (
  to: string,
  action: AccountAction | "email_changed_to",
  by: string,
  now = new Date(),
) => {
  const who = esc(by || "τον διαχειριστή του νοσοκομείου");
  const when = esc(athensTime(now));
  const what =
    action === "email_changed_to"
      ? `Το email σύνδεσης του λογαριασμού σας στο SurgiTrack ορίστηκε σε αυτή τη διεύθυνση από ${who} (${when}). Από εδώ και πέρα συνδέεστε με αυτό το email· το όνομα χρήστη και ο κωδικός σας μένουν ίδια.`
      : action === "email_changed"
      ? `Το email σύνδεσης του λογαριασμού σας στο SurgiTrack άλλαξε από ${who} (${when}). Από εδώ και πέρα συνδέεστε με το νέο email.`
      : action === "password_link"
        ? `Δημιουργήθηκε σύνδεσμος ορισμού νέου κωδικού για τον λογαριασμό σας στο SurgiTrack από ${who} (${when}).`
        : `Δημιουργήθηκε σύνδεσμος πρόσκλησης για τον λογαριασμό σας στο SurgiTrack από ${who} (${when}).`;
  const body = `${what}<br><br>Αν δεν το ζητήσατε εσείς, ενημερώστε αμέσως τον υπεύθυνο του νοσοκομείου σας.`;
  return sendEmail([to], "SurgiTrack: αλλαγή στον λογαριασμό σας", layout("ΑΣΦΑΛΕΙΑ ΛΟΓΑΡΙΑΣΜΟΥ", "Αλλαγή στον λογαριασμό σας", body)).catch(
    () => false,
  );
};
