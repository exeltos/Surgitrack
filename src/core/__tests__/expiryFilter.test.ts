import {describe, expect, it} from 'vitest';
import {matchesExpiry} from '../sterileExpiry';

describe('the expiry filter of a list', () => {
  const today = new Date(2026, 10, 20);
  it('keeps what expires soon or has expired, while it is sterile', () => {
    expect(matchesExpiry('EXPIRING', {state: 'IN_DEPARTMENT', sterileUntil: '2026-11-30'}, today)).toBe(true);
    expect(matchesExpiry('EXPIRED', {state: 'IN_DEPARTMENT', sterileUntil: '2026-11-10'}, today)).toBe(true);
    expect(matchesExpiry('EXPIRING', {state: 'IN_DEPARTMENT', sterileUntil: '2027-05-20'}, today)).toBe(false);
    // Back for reprocessing: its old date no longer counts.
    expect(matchesExpiry('EXPIRED', {state: 'IN_WASHING', sterileUntil: '2026-11-10'}, today)).toBe(false);
    expect(matchesExpiry('', {state: 'IN_WASHING'}, today)).toBe(true);
  });
});
