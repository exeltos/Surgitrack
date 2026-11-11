import {supabase} from '../../lib/supabase';

/** How often the app says it is there; the owner's list shows the people seen in the last few minutes. */
export const PRESENCE_MINUTE = 60_000;

/**
 * «I am here»: the database notes who, from which address and with which browser (see migration
 * 20261110160000_active_sessions_and_blocks), and answers whether this address may stay: false once the platform
 * owner blocked it. An answer that cannot be had (no connection, the function not there yet) lets the person
 * stay: the database refuses a blocked address its data itself.
 */
export async function touchPresence(): Promise<{allowed: boolean; ip?: string} | null> {
  try {
    const {data, error} = await supabase.rpc('touch_presence', {p_agent: navigator.userAgent});
    if (error || !data || typeof data !== 'object') return null;
    const answer = data as {allowed?: boolean; ip?: string | null};
    return {allowed: answer.allowed !== false, ip: answer.ip || undefined};
  } catch {
    return null;
  }
}

/**
 * Who of a hospital is connected now (seen in the last minutes), for its administrators and the platform owner.
 * `null` when it cannot be had (no connection, or the function is not there yet): the screen then shows no
 * "connected" mark at all rather than saying nobody is.
 */
export async function loadHospitalPresence(organizationId: string): Promise<Set<string> | null> {
  try {
    const {data, error} = await supabase.rpc('hospital_presence', {p_org: organizationId});
    if (error || !Array.isArray(data)) return null;
    return new Set((data as Array<{user_id: string}>).map(r => r.user_id));
  } catch {
    return null;
  }
}
