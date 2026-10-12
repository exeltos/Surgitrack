import {afterEach, describe, expect, it, vi} from 'vitest';
import {act, renderHook} from '@testing-library/react';
import {
  cutoffOf,
  loadOlderHistory,
  loadOlderMatching,
  registerOlderLoader,
  setCutoff,
  useHistoryWindow,
} from '../historyWindow';

const CUTOFF = '2026-07-01T00:00:00.000Z';
/** A sync's older loader: a full load clears the cutoff, a filtered one keeps it. */
const loader = (collection: 'movements' | 'receipts') =>
  vi.fn(async (filter?: string) => {
    if (!filter) setCutoff(collection, undefined);
  });

describe('loading older history', () => {
  const stops: Array<() => void> = [];
  afterEach(() => {
    stops.splice(0).forEach(stop => stop());
    setCutoff('movements', undefined);
    setCutoff('receipts', undefined);
  });

  it('loads in full only the kinds asked for', async () => {
    const movements = loader('movements');
    const receipts = loader('receipts');
    stops.push(registerOlderLoader('movements', movements), registerOlderLoader('receipts', receipts));
    setCutoff('movements', CUTOFF);
    setCutoff('receipts', CUTOFF);
    const {result} = renderHook(() => useHistoryWindow(['receipts']));
    expect(result.current.windowed).toBe(true);

    await act(() => loadOlderHistory(['receipts']));
    expect(receipts).toHaveBeenCalledWith();
    expect(movements).not.toHaveBeenCalled();
    expect(result.current.windowed).toBe(false);
    expect(cutoffOf('movements')).toBe(CUTOFF);
  });

  it('fetches a search once, keeps the window, and skips a kind already loaded in full', async () => {
    const movements = loader('movements');
    const receipts = loader('receipts');
    stops.push(registerOlderLoader('movements', movements), registerOlderLoader('receipts', receipts));
    setCutoff('movements', CUTOFF);
    const {result} = renderHook(() => useHistoryWindow(['movements']));

    await act(() => loadOlderMatching({movements: 'asset.ilike."S1*"', receipts: 'barcode.eq.S1'}));
    await act(() => loadOlderMatching({movements: 'asset.ilike."S1*"'}));
    expect(movements.mock.calls).toEqual([['asset.ilike."S1*"']]);
    expect(receipts).not.toHaveBeenCalled();
    expect(result.current.windowed).toBe(true);

    // A new window (e.g. another hospital) searches again.
    setCutoff('movements', CUTOFF);
    await act(() => loadOlderMatching({movements: 'asset.ilike."S1*"'}));
    expect(movements).toHaveBeenCalledTimes(2);
  });

  it('shows the search as loading while it runs, and lets a failed one be tried again', async () => {
    let fail: (error: Error) => void = () => undefined;
    const movements = vi.fn(() => new Promise<void>((_resolve, reject) => (fail = reject)));
    stops.push(registerOlderLoader('movements', movements));
    setCutoff('movements', CUTOFF);
    const {result} = renderHook(() => useHistoryWindow(['movements']));

    let search: Promise<void> = Promise.resolve();
    act(() => {
      search = loadOlderMatching({movements: 'patient_code.ilike."*P*"'});
    });
    expect(result.current.loading).toBe(true);
    await act(async () => {
      fail(new Error('Failed to fetch'));
      await expect(search).rejects.toThrow('Failed to fetch');
    });
    expect(result.current.loading).toBe(false);
    void loadOlderMatching({movements: 'patient_code.ilike."*P*"'}).catch(() => undefined);
    expect(movements).toHaveBeenCalledTimes(2);
  });
});
