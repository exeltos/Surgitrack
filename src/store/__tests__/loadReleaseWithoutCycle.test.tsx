import type {ReactNode} from 'react';
import {act, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {LibraryStoreProvider} from '../../core/LibraryStore';
import {demoSurgiRepository} from '../../data/repositories/demoRepository';
import {SurgiProvider, useSurgi} from '../SurgiStore';

const wrapper = ({children}: {children: ReactNode}) => (
  <LibraryStoreProvider>
    <SurgiProvider dataMode="DEMO">{children}</SurgiProvider>
  </LibraryStoreProvider>
);

const setup = () => {
  const {result} = renderHook(() => useSurgi(), {wrapper});
  const s = () => result.current;
  const load = s().processLoads.find(l => l.kind === 'STERILIZATION' && l.status === 'AWAITING_RELEASE')!;
  const states = () => load.items.map(item => s().sets.find(x => x.id === item.assetId)?.state);
  const loadStatus = () => s().processLoads.find(l => l.id === load.id)?.status;
  const release = (decision: 'RELEASED' | 'REPROCESS') => {
    let out: unknown;
    act(() => {
      out = s().releaseProcessLoad(load.id, {
        physicalParametersOk: true,
        chemicalIndicatorOk: decision === 'RELEASED',
        chemicalIndicatorResult: decision === 'RELEASED' ? 'PASS' : 'FAIL',
        packagingIntegrityOk: true,
        biologicalIndicatorResult: 'NOT_REQUIRED',
        decision,
      });
    });
    return out;
  };
  return {s, load, states, loadStatus, release};
};

describe('load release without the cycle on record', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem('surgitrack-demo-role', 'STERILIZATION');
    // A hospital whose load waits for release with no sterilizer cycle on record (data saved before cycles
    // were, or a device that has not sent them yet).
    const original = demoSurgiRepository.getInitialData;
    vi.spyOn(demoSurgiRepository, 'getInitialData').mockImplementation(() => ({
      ...original(),
      sterilizationCycles: [],
    }));
  });
  afterEach(() => vi.restoreAllMocks());

  it('is not released, and the load and its items stay waiting', () => {
    const f = setup();
    expect(f.load).toBeTruthy();
    expect(f.release('RELEASED')).toBeUndefined();
    expect(f.loadStatus()).toBe('AWAITING_RELEASE');
    expect(f.states().every(state => state === 'AWAITING_RELEASE')).toBe(true);
    expect(f.s().sterilizationReleases.some(r => r.loadId === f.load.id)).toBe(false);
  });

  it('can still be sent back, and then every item goes back too', () => {
    const f = setup();
    f.release('REPROCESS');
    expect(f.loadStatus()).toBe('REPROCESS');
    expect(f.states().every(state => state === 'IN_WASHING')).toBe(true);
  });
});
