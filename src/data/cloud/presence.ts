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
