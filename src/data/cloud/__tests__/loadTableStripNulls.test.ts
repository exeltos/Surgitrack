import {beforeEach, describe, expect, it, vi} from 'vitest';

// A stand-in client: records whether each request asked for empty fields to be left out, and can refuse
// that option the way a server without it does (406, PGRST107).
const state = vi.hoisted(() => ({stripped: [] as boolean[], refuseStrip: false}));
vi.mock('../../../lib/supabase', () => {
  const query = () => {
    let strip = false;
    const chain: Record<string, unknown> = {};
    for (const name of ['from', 'select', 'eq', 'gte', 'lt', 'order', 'range']) chain[name] = () => chain;
    chain.stripNulls = () => {
      strip = true;
      return chain;
    };
    chain.then = (resolve: (value: unknown) => unknown) => {
      state.stripped.push(strip);
      if (strip && state.refuseStrip)
        return Promise.resolve(resolve({data: null, error: {code: 'PGRST107', message: 'not acceptable'}}));
      // With empty fields left out the row has no `department` key at all.
      const row = strip
        ? {id: 't1', barcode: 'T1', name: 'ΛΑΒΙΔΑ', updated_at: '2026-10-10T10:00:00Z'}
        : {id: 't1', barcode: 'T1', name: 'ΛΑΒΙΔΑ', department: null, updated_at: '2026-10-10T10:00:00Z'};
      return Promise.resolve(resolve({data: [row], error: null, count: 1}));
    };
    return chain;
  };
  return {supabase: {from: () => query()}};
});

beforeEach(() => {
  state.stripped.length = 0;
  state.refuseStrip = false;
  vi.resetModules();
});

describe('loading a table', () => {
  it('asks for empty fields to be left out, and reads a missing field as empty', async () => {
    const {loadTable} = await import('../appRecords');
    const rows = await loadTable('org-1', 'tools');
    expect(state.stripped).toEqual([true]);
    expect(rows[0]).toMatchObject({id: 't1', barcode: 'T1', name: 'ΛΑΒΙΔΑ'});
    expect(rows[0]).not.toHaveProperty('department');
  });

  it('falls back to the plain request when the server does not know the option, and stays with it', async () => {
    state.refuseStrip = true;
    const {loadTable} = await import('../appRecords');
    const rows = await loadTable('org-1', 'tools');
    expect(rows).toHaveLength(1);
    expect(state.stripped).toEqual([true, false]);
    await loadTable('org-1', 'tools');
    expect(state.stripped).toEqual([true, false, false]);
  });
});
