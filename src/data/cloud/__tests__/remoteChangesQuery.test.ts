import {beforeEach, describe, expect, it, vi} from 'vitest';

// What the incremental pull asks the database: a stand-in client records each call of the query chain.
const calls: Array<[string, unknown[]]> = [];
vi.mock('../../../lib/supabase', () => {
  const chain: Record<string, unknown> = {};
  for (const name of ['from', 'select', 'eq', 'or', 'gte', 'order']) {
    chain[name] = (...args: unknown[]) => {
      calls.push([name, args]);
      return chain;
    };
  }
  chain.range = (...args: unknown[]) => {
    calls.push(['range', args]);
    return Promise.resolve({data: [], error: null});
  };
  return {supabase: chain};
});

const {loadChangedRecords} = await import('../remoteChanges');
const SINCE = '2026-10-10T06:00:00.000Z';

beforeEach(() => {
  calls.length = 0;
});

describe('records changed since the last look', () => {
  it('asks a record table for anything updated or created since then', async () => {
    await loadChangedRecords('org-1', 'sets', SINCE);
    const select = String(calls.find(([name]) => name === 'select')?.[1][0]);
    expect(select).toContain('updated_at');
    expect(calls).toContainEqual(['or', [`updated_at.gte.${SINCE},created_at.gte.${SINCE}`]]);
  });

  it.each(['movements', 'receipts', 'deliveries', 'sterilizationCycles', 'recycleBin'] as const)(
    'never asks the history table %s for updated_at, which it does not have',
    async collection => {
      await loadChangedRecords('org-1', collection, SINCE);
      const select = String(calls.find(([name]) => name === 'select')?.[1][0]);
      expect(select).not.toContain('updated_at');
      expect(calls.some(([name]) => name === 'or')).toBe(false);
      expect(calls).toContainEqual(['gte', ['created_at', SINCE]]);
    },
  );
});
