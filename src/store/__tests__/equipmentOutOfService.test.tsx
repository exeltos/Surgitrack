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

  it('is not loaded while its latest test failed, and is loaded again after a passing one', () => {
    const f = setup();
    const sterilizer = f.s().libs.sterilizers[0];
    const test = (result: 'PASS' | 'FAIL', id: string) => ({
      id,
      kind: 'BOWIE_DICK' as const,
      result,
      at: '10/11/2026 07:30',
      by: 'Τ',
    });
    const load = () =>
      f.s().createProcessLoad({
        kind: 'STERILIZATION',
        assetRefs: f.ref,
        equipment: sterilizer.el,
        cycleNumber: 'S-2',
        program: '134°C · 5 min',
        chemicalIndicatorResult: 'PASS',
      });
    f.run(() => f.s().libs.updateItem('sterilizers', sterilizer.id, {tests: [test('FAIL', 't1')]}));
    expect(f.run(load)).toBeUndefined();
    f.run(() => f.s().libs.updateItem('sterilizers', sterilizer.id, {tests: [test('PASS', 't2'), test('FAIL', 't1')]}));
    expect(f.run(load)).toBeDefined();
  });

  it('is not released while its latest test failed, and is released after a passing one', () => {
    const f = setup();
    const sterilizer = f.s().libs.sterilizers[0];
    const test = (result: 'PASS' | 'FAIL', id: string) => ({
      id,
      kind: 'BOWIE_DICK' as const,
      result,
      at: '10/11/2026 07:30',
      by: 'Τ',
    });
    // A cycle that ended (taken from a device) waits for release.
    const load = f.run(() =>
      f.s().createProcessLoad({
        kind: 'STERILIZATION',
        assetRefs: f.ref,
        equipment: sterilizer.el,
        cycleNumber: 'S-3',
        program: '134°C · 5 min',
        chemicalIndicatorResult: 'PASS',
        cycleCompleted: true,
      }),
    )!;
    expect(load.status).toBe('AWAITING_RELEASE');
    const release = () =>
      f.run(() =>
        f.s().releaseProcessLoad(load.id, {
          physicalParametersOk: true,
          packagingIntegrityOk: true,
          chemicalIndicatorOk: true,
          chemicalIndicatorResult: 'PASS',
          biologicalIndicatorResult: 'NOT_REQUIRED',
          decision: 'RELEASED',
        }),
      );
    const status = () => f.s().processLoads.find(item => item.id === load.id)?.status;
    f.run(() => f.s().libs.updateItem('sterilizers', sterilizer.id, {tests: [test('FAIL', 't1')]}));
    release();
    expect(status()).toBe('AWAITING_RELEASE');
    f.run(() => f.s().libs.updateItem('sterilizers', sterilizer.id, {tests: [test('PASS', 't2'), test('FAIL', 't1')]}));
    release();
    expect(status()).toBe('RELEASED');
  });

  it('does not load a washer while its latest test failed, and loads it after a passing one', () => {
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
    run(() => s().sendToSterilization('TOOL', asset.id));
    run(() =>
      s().receiveAtSterilization('TOOL', asset.id, {
        deliveredByUserId: 'u',
        deliveredByName: 'Τ',
        deliveredByDepartment: 'Τμήμα',
      }),
    );
    const washer = s().libs.washers[0];
    const test = (kindResult: 'PASS' | 'FAIL', id: string) => ({
      id,
      kind: 'CLEANING' as const,
      result: kindResult,
      at: '10/11/2026 07:30',
      by: 'Τ',
    });
    const load = () =>
      s().createProcessLoad({
        kind: 'WASHING',
        assetRefs: [{kind: 'TOOL' as const, id: asset.id}],
        equipment: washer.el,
        cycleNumber: 'W-9',
        program: 'Θ',
      });
    run(() => s().libs.updateItem('washers', washer.id, {tests: [test('FAIL', 'w1')]}));
    expect(run(load)).toBeUndefined();
    expect(s().processLoads.some(l => l.cycleNumber === 'W-9')).toBe(false);
    run(() => s().libs.updateItem('washers', washer.id, {tests: [test('PASS', 'w2'), test('FAIL', 'w1')]}));
    expect(run(load)).toBeDefined();
    expect(s().processLoads.some(l => l.cycleNumber === 'W-9')).toBe(true);
  });
});
