import {supabase} from '../../lib/supabase';

/** How far the device's clock may be from the server's before it is not believed. */
export const MAX_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;

/** The server time (ms) a sign-in token was issued at: the token's `iat`. Tokens are renewed about hourly. */
export const tokenIssuedAt = (accessToken: string | undefined): number | undefined => {
  try {
    const payload = accessToken?.split('.')[1];
    if (!payload) return undefined;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const iat = (JSON.parse(json) as {iat?: unknown}).iat;
    return typeof iat === 'number' && Number.isFinite(iat) ? iat * 1000 : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Whether this device's clock agrees with the server's (within a day), judged by when the signed-in
 * session's token was issued. Anything that is deleted for good because "30 days passed" must check it
 * first: a clock a year ahead would otherwise empty the Recycle bin. Without a session, or when unsure,
 * the answer is no (nothing is deleted).
 */
export async function deviceClockTrusted(now = Date.now()): Promise<boolean> {
  try {
    const {data} = await supabase.auth.getSession();
    const issued = tokenIssuedAt(data.session?.access_token);
    return issued !== undefined && Math.abs(now - issued) <= MAX_CLOCK_SKEW_MS;
  } catch {
    return false;
  }
}
