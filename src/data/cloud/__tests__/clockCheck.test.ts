import {beforeEach, describe, expect, it, vi} from 'vitest';

const session = vi.hoisted(() => ({token: undefined as string | undefined, fail: false}));
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => {
        if (session.fail) throw new Error('offline');
        return {data: {session: session.token ? {access_token: session.token} : null}};
      },
    },
  },
}));

const {deviceClockTrusted, tokenIssuedAt, MAX_CLOCK_SKEW_MS} = await import('../clockCheck');

const NOW = Date.parse('2026-11-01T10:00:00Z');
const token = (iat: number) => `h.${btoa(JSON.stringify({iat})).replace(/=+$/, '')}.s`;

describe('trusting the device clock', () => {
  beforeEach(() => {
    session.token = undefined;
    session.fail = false;
  });

  it('reads when a token was issued', () => {
    expect(tokenIssuedAt(token(1_700_000_000))).toBe(1_700_000_000_000);
    expect(tokenIssuedAt('garbage')).toBeUndefined();
    expect(tokenIssuedAt(undefined)).toBeUndefined();
  });

  it('trusts a clock close to the token time', async () => {
    session.token = token(NOW / 1000 - 1800);
    expect(await deviceClockTrusted(NOW)).toBe(true);
  });

  it('does not trust a clock a year ahead, or far behind', async () => {
    session.token = token(NOW / 1000);
    expect(await deviceClockTrusted(NOW + 365 * 864e5)).toBe(false);
    expect(await deviceClockTrusted(NOW - 2 * MAX_CLOCK_SKEW_MS)).toBe(false);
  });

  it('does not trust anything without a session or when it cannot be read', async () => {
    expect(await deviceClockTrusted(NOW)).toBe(false);
    session.fail = true;
    expect(await deviceClockTrusted(NOW)).toBe(false);
  });
});
