import type {ReactNode} from 'react';
import {act, renderHook} from '@testing-library/react';
import {beforeEach, describe, expect, it} from 'vitest';
import {LibraryStoreProvider, useLibraries} from '../../core/LibraryStore';
import {SurgiProvider, useSurgi} from '../SurgiStore';

const wrapper = ({children}: {children: ReactNode}) => (
  <LibraryStoreProvider>
    <SurgiProvider dataMode="DEMO">{children}</SurgiProvider>
  </LibraryStoreProvider>
);

/** An instrument ready for the sterilizer, by the same steps the Sterilization screens take. */
const setup = () => {
  const {result} = renderHook(() => ({...useSurgi(), libs: useLibraries()}), {wrapper});
  const s = () => result.current;
  const run = <T,>(fn: () => T) => {
    let out!: T;
    act(() => {
      out = fn();
    });
    return out;
  };
  const asset = s().tools.find(t => t.mode === 'STANDALONE' && t.state === 'IN_DEPARTMENT' && !t.maxUses)!;
  const ref = [{kind: 'TOOL' as const, id: asset.id}];
  run(() => s().sendToSterilization('TOOL', asset.id));
  run(() =>
    s().receiveAtSterilization('TOOL', asset.id, {
      deliveredByUserId: 'u',
      deliveredByName: 'Τ',
      deliveredByDepartment: 'Τμήμα',
    }),
  );
  run(() =>
    s().createProcessLoad({
      kind: 'WASHING',
      assetRefs: ref,
      equipment: 'ΠΛΥΝΤΗΡΙΟ 1',
      cycleNumber: 'W-1',
      program: 'Θ',
    }),
  );
  run(() => s().recordPreparation('TOOL', asset.id, {toolIds: [asset.id], checkedToolIds: [asset.id], allOk: true}));
  run(() => s().completeWorkflowCheckpoint('TOOL', asset.id, {stageId: 'PACKAGING', checks: [true, true, true]}));
  return {s, run, ref};
};

describe('a sterilizer taken out of service', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem('surgitrack-demo-role', 'STERILIZATION');
  });

  it('is not loaded, and is loaded again once it is put back', () => {
    const f = setup();
    const sterilizer = f.s().libs.sterilizers[0];
    f.run(() =>
      f.s().libs.updateItem('sterilizers', sterilizer.id, {
        outOfService: {reason: 'BREAKDOWN', since: '10/11/2026 08:00', by: 'Τ'},
      }),
    );
    const load = () =>
      f.s().createProcessLoad({
        kind: 'STERILIZATION',
        assetRefs: f.ref,
        equipment: sterilizer.el,
        cycleNumber: 'S-1',
        program: '134°C · 5 min',
        chemicalIndicatorResult: 'PASS',
      });
    expect(f.run(load)).toBeUndefined();
    expect(f.s().processLoads.some(l => l.cycleNumber === 'S-1')).toBe(false);
    f.run(() => f.s().libs.updateItem('sterilizers', sterilizer.id, {outOfService: undefined}));
    expect(f.run(load)).toBeDefined();
  });
});
