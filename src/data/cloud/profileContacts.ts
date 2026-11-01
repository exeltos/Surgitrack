import {supabase} from '../../lib/supabase';

/** The sign-in email and username of a person (the part of a profile only admins read, see profile_contacts()). */
export type ProfileContact = {id: string; email: string; user_code: string | null};

/** The function is missing (the database migration is not applied yet): PostgREST 404 or Postgres undefined_function. */
const functionMissing = (error: {code?: string; message?: string} | null) =>
  !!error &&
  (error.code === 'PGRST202' || error.code === '42883' || /could not find the function/i.test(error.message || ''));

/**
 * Contacts of a hospital's people (or of everyone, for the platform owner, without a hospital), through
 * profile_contacts(): a hospital admin gets their hospital's, anybody else only their own. The email and username
 * are no longer read from the profiles table. Until the function exists in the database, the table is read as before,
 * so the app and the migration can be rolled out in either order.
 */
export async function loadProfileContacts(
  organizationId?: string,
): Promise<{contacts: Map<string, ProfileContact>; error?: {message: string}}> {
  const call = await supabase.rpc('profile_contacts', {p_org: organizationId ?? null});
  let rows = call.data as ProfileContact[] | null;
  let error = call.error;
  if (functionMissing(error)) {
    const query = supabase.from('profiles').select('id,email,user_code');
    const table = await (organizationId ? query.eq('organization_id', organizationId) : query);
    rows = table.data as ProfileContact[] | null;
    error = table.error;
  }
  return {contacts: new Map((rows || []).map(row => [row.id, row])), error: error ?? undefined};
}

/** The id of the person with this email (ignoring case) in a hospital, if the caller may see it. */
export async function findProfileIdByEmail(
  organizationId: string | undefined,
  email: string,
): Promise<string | undefined> {
  if (!organizationId) return undefined;
  const wanted = email.trim().toLowerCase();
  const {contacts} = await loadProfileContacts(organizationId);
  return [...contacts.values()].find(c => (c.email || '').toLowerCase() === wanted)?.id;
}
