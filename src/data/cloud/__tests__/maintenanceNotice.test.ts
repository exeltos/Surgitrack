import {describe, expect, it, vi} from 'vitest';

vi.mock('../../../lib/supabase', () => ({supabase: {}}));

import {maintenanceActive} from '../platformContact';

describe('maintenance notice', () => {
  const now = Date.parse('2026-10-09T10:00:00Z');
  it('shows a message without an end until it is removed', () => {
    expect(maintenanceActive({message: 'Αναβάθμιση απόψε 22:00'}, now)).toBe(true);
  });
  it('stops at its end time', () => {
    expect(maintenanceActive({message: 'x', until: '2026-10-09T11:00:00Z'}, now)).toBe(true);
    expect(maintenanceActive({message: 'x', until: '2026-10-09T09:59:00Z'}, now)).toBe(false);
  });
  it('shows nothing without a message', () => {
    expect(maintenanceActive(null, now)).toBe(false);
    expect(maintenanceActive({message: ''}, now)).toBe(false);
  });
});
