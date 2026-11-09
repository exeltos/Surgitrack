import type {ReactNode} from 'react';
import {act, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {LibraryStoreProvider} from '../../core/LibraryStore';
import {SurgiProvider, useSurgi} from '../SurgiStore';

const sent = vi.hoisted(() => vi.fn(async () => ({stored: 1})));
vi.mock('../../data/cloud/simulatedDevice', () => ({
  sendSimulatedCycle: sent,
  simulatedDeviceName: (name: string) => `${name} (προσομοίωση)`,
}));

const wrapper = ({children}: {children: ReactNode}) => (
  <LibraryStoreProvider>
    <SurgiProvider dataMode="DEMO">{children}</SurgiProvider>
  </LibraryStoreProvider>
);

/** A load in the sterilizer, by the same steps the Sterilization screens take. */
const setup = () => {
  const {result} = renderHook(() => useSurgi(), {wrapper});
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
  const load = run(() =>
    s().createProcessLoad({
      kind: 'STERILIZATION',
      assetRefs: ref,
      equipment: 'ΚΛΙΒΑΝΟΣ 1',
      cycleNumber: 'S-1',
      program: '134°C · 5 min',
      chemicalIndicatorResult: 'PASS',
    }),
  )!;
  const current = () => s().processLoads.find(l => l.id === load.id)!;
  return {s, run, load, current, asset};
};

describe('a simulated sterilizer cycle', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem('surgitrack-demo-role', 'STERILIZATION');
  });
  afterEach(() => vi.useRealTimers());

  it('cannot be ended as passed while it runs, and records its readings when it ends', () => {
    vi.useFakeTimers({toFake: ['Date']});
    vi.setSystemTime(new Date('2026-11-09T10:00:00'));
    const f = setup();
    f.run(() => f.s().startCycleSimulation(f.load.id, 'PASS'));
    expect(f.current().simulation).toMatchObject({scenario: 'PASS'});

    // Half a minute in (10 simulated minutes): still running.
    vi.setSystemTime(new Date('2026-11-09T10:00:30'));
    f.run(() => f.s().finishProcessLoad(f.load.id, 'PASSED'));
    expect(f.current().status).toBe('OPEN');

    // A minute in: the cycle has ended; the end of the cycle keeps what it measured.
    vi.setSystemTime(new Date('2026-11-09T10:01:05'));
    f.run(() => f.s().finishProcessLoad(f.load.id, 'PASSED'));
    expect(f.current().status).toBe('AWAITING_RELEASE');
    expect(f.current().cycleData).toMatchObject({source: 'SIMULATION', result: 'PASS', setpoint: 134});
    expect(f.current().cycleData!.curve.length).toBeGreaterThan(15);
  });

  it('keeps the failed readings of a cycle stopped by hand', () => {
    vi.useFakeTimers({toFake: ['Date']});
    vi.setSystemTime(new Date('2026-11-09T10:00:00'));
    const f = setup();
    f.run(() => f.s().startCycleSimulation(f.load.id, 'LOW_PRESSURE'));
    vi.setSystemTime(new Date('2026-11-09T10:00:20'));
    f.run(() => f.s().finishProcessLoad(f.load.id, 'FAILED'));
    expect(f.current().status).toBe('FAILED');
    expect(f.current().cycleData?.result).toBe('FAIL');
    expect(f.s().tools.find(t => t.id === f.asset.id)!.state).not.toBe('AWAITING_RELEASE');
  });

  it('does not report to the connected devices where there is no hospital in the cloud', () => {
    vi.useFakeTimers({toFake: ['Date']});
    vi.setSystemTime(new Date('2026-11-09T10:00:00'));
    const f = setup();
    f.run(() => f.s().startCycleSimulation(f.load.id, 'PASS'));
    vi.setSystemTime(new Date('2026-11-09T10:01:05'));
    f.run(() => f.s().finishProcessLoad(f.load.id, 'PASSED'));
    expect(f.current().status).toBe('AWAITING_RELEASE');
    expect(sent).not.toHaveBeenCalled();
  });

  it('does not start twice', () => {
    const f = setup();
    f.run(() => f.s().startCycleSimulation(f.load.id, 'PASS'));
    const first = f.current().simulation;
    f.run(() => f.s().startCycleSimulation(f.load.id, 'ABORTED'));
    expect(f.current().simulation).toEqual(first);
  });
});
