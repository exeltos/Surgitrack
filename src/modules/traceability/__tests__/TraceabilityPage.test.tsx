import {afterEach, describe, expect, it, vi} from 'vitest';
import {screen} from '@testing-library/react';
import {renderPage} from '../../../test/renderPage';
import {registerOlderLoader, setCutoff} from '../../../data/cloud/historyWindow';
import {sets as demoSets} from '../../../data/demo';
import TraceabilityPage from '../TraceabilityPage';

const COLLECTIONS = ['movements', 'counts', 'sterilizationCycles', 'receipts'] as const;

describe('Traceability and the older history', () => {
  afterEach(() => COLLECTIONS.forEach(collection => setCutoff(collection, undefined)));

  it('fetches only the older history of the Set searched for, never the whole hospital', async () => {
    const calls: Array<[string, string | undefined]> = [];
    const stops = COLLECTIONS.map(collection => {
      setCutoff(collection, '2026-07-01T00:00:00.000Z');
      return registerOlderLoader(collection, async filter => {
        calls.push([collection, filter]);
      });
    });
    const set = demoSets[0];
    renderPage(<TraceabilityPage />, {path: `/traceability?q=${set.barcode}`});

    expect(await screen.findByRole('status')).toHaveTextContent('Αναζήτηση και στο παλαιότερο ιστορικό');
    await vi.waitFor(() =>
      expect(calls.map(([collection]) => collection).sort()).toEqual(['movements', 'sterilizationCycles']),
    );
    expect(calls.every(([, filter]) => filter?.includes(set.barcode))).toBe(true);
    stops.forEach(stop => stop());
  });

  it('asks nothing before a search', async () => {
    const load = vi.fn(async () => undefined);
    setCutoff('movements', '2026-07-01T00:00:00.000Z');
    const stop = registerOlderLoader('movements', load);
    renderPage(<TraceabilityPage />);
    await new Promise(resolve => setTimeout(resolve, 600));
    expect(load).not.toHaveBeenCalled();
    stop();
  });
});
