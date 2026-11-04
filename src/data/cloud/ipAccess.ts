import {supabase} from '../../lib/supabase';

/** What the database says about the caller's network (see migration 20261104200000_ip_access). */
export type IpAccess = {mode: 'OFF' | 'LOG' | 'ENFORCE'; allowed: boolean; ip?: string};

/**
 * Asks whether this address may work in the hospital; the database also records a refused one. An answer that
 * cannot be had (no connection, the function not there yet) never locks anyone out: the database refuses the data
 * itself where the hospital enforces it.
 */
export async function checkIpAccess(): Promise<IpAccess | null> {
  try {
    const {data, error} = await supabase.rpc('my_ip_access');
    if (error || !data || typeof data !== 'object') return null;
    const answer = data as {mode?: string; allowed?: boolean; ip?: string | null};
    const mode = answer.mode === 'ENFORCE' || answer.mode === 'LOG' ? answer.mode : 'OFF';
    return {mode, allowed: answer.allowed !== false, ip: answer.ip || undefined};
  } catch {
    return null;
  }
}

/** Whether the person must be turned away: the hospital enforces its addresses and this one is not among them. */
export const turnedAway = (access: IpAccess | null) => !!access && access.mode === 'ENFORCE' && !access.allowed;
