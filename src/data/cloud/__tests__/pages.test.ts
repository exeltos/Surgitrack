import {describe, expect, it} from 'vitest';
import {loadAllPages, PAGE_SIZE, type PageResult} from '../pages';

/** A table of `total` numbered rows, answering like the database (optionally with the total). */
const table = (total: number, opts: {delayMs?: number; withCount?: boolean} = {}) => {
  const rows = Array.from({length: total}, (_, i) => i);
  let inFlight = 0;
  let maxInFlight = 0;
  let calls = 0;
  const fetchPage = async (from: number, to: number, withCount: boolean): Promise<PageResult<number>> => {
    calls += 1;
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    if (opts.delayMs) await new Promise(resolve => setTimeout(resolve, opts.delayMs));
    inFlight -= 1;
    return {
      data: rows.slice(from, to + 1),
      error: null,
      count: withCount && opts.withCount !== false ? total : null,
    };
  };
  return {fetchPage, stats: () => ({calls, maxInFlight})};
};

describe('loading every page', () => {
  it('returns all rows in order, for small and large tables', async () => {
    for (const total of [0, 5, PAGE_SIZE - 1, PAGE_SIZE, PAGE_SIZE + 1, 13_923]) {
      const t = table(total);
      const rows = await loadAllPages(t.fetchPage);
      expect(rows).toEqual(Array.from({length: total}, (_, i) => i));
    }
  });

  it('asks for the pages after the first together, a few at a time', async () => {
    const t = table(13_923, {delayMs: 2});
    await loadAllPages(t.fetchPage);
    expect(t.stats().calls).toBe(14);
    expect(t.stats().maxInFlight).toBe(4);
  });

  it('is several times faster than one page after the other on a slow network', async () => {
    const parallel = table(13_923, {delayMs: 40});
    const started = Date.now();
    await loadAllPages(parallel.fetchPage);
    const took = Date.now() - started;
    // One after the other: 14 round trips (~560 ms). Together: 1 + ceil(13 / 4) = 5 round trips (~200 ms).
    expect(took).toBeLessThan(14 * 40 * 0.6);
  });

  it('still loads everything when the total is not returned', async () => {
    const t = table(2_500, {withCount: false});
    expect(await loadAllPages(t.fetchPage)).toHaveLength(2_500);
  });

  it('stops on an error', async () => {
    let call = 0;
    const failing = async (from: number, to: number): Promise<PageResult<number>> => {
      call += 1;
      return call === 3
        ? {data: null, error: new Error('network')}
        : {data: Array.from({length: to - from + 1}, (_, i) => from + i), error: null, count: 5_000};
    };
    await expect(loadAllPages(failing)).rejects.toThrow('network');
  });
});
