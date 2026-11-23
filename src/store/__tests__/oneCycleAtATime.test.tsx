import type {ReactNode} from 'react';
import {act, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {LibraryStoreProvider} from '../../core/LibraryStore';
import {SurgiProvider, useSurgi} from '../SurgiStore';

const wrapper = ({children}: {children: ReactNode}) => (
  <LibraryStoreProvider>
    <SurgiProvider dataMode="DEMO">{children}</SurgiProvider>
  </LibraryStoreProvider>
);

const STERILIZER = 'ΚΛΙΒΑΝΟΣ ΔΟΚΙΜΗΣ';

/** Two instruments ready for the sterilizer, by the same steps the Sterilization screens take. */
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
  const assets = s()
    .tools.filter(t => t.mode === 'STANDALONE' && t.state === 'IN_DEPARTMENT' && !t.maxUses)
    .slice(0, 2);
  for (const asset of assets) {
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
        assetRefs: [{kind: 'TOOL', id: asset.id}],
        equipment: 'ΠΛΥΝΤΗΡΙΟ 1',
        cycleNumber: `W-${asset.id}`,
        program: 'Θ',
      }),
    );
    run(() => s().recordPreparation('TOOL', asset.id, {toolIds: [asset.id], checkedToolIds: [asset.id], allOk: true}));
    run(() => s().completeWorkflowCheckpoint('TOOL', asset.id, {stageId: 'PACKAGING', checks: [true, true, true]}));
  }
  const load = (index: number, cycleNumber: string, program: string) =>
    run(() =>
      s().createProcessLoad({
        kind: 'STERILIZATION',
        assetRefs: [{kind: 'TOOL', id: assets[index].id}],
        equipment: STERILIZER,
        cycleNumber,
        program,
        chemicalIndicatorResult: 'PASS',
      }),
    );
  const statusOf = (cycleNumber: string) => s().processLoads.find(l => l.cycleNumber === cycleNumber)?.status;
  return {s, run, load, statusOf};
};

describe('a sterilizer runs one cycle at a time', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem('surgitrack-demo-role', 'STERILIZATION');
  });
  afterEach(() => vi.useRealTimers());

  it('takes the next load only once the cycle in it has ended by hand', () => {
    const f = setup();
    const first = f.load(0, 'S-1', '134°C · 5 min')!;
    expect(first.status).toBe('OPEN');
    expect(f.load(1, 'S-2', '134°C · 5 min')).toBeUndefined();
    expect(f.statusOf('S-2')).toBeUndefined();
    f.run(() => f.s().finishProcessLoad(first.id, 'PASSED'));
    expect(f.load(1, 'S-2', '134°C · 5 min')?.status).toBe('OPEN');
  });

  it("ends a cycle by itself once its program's whole length has passed, at that time", () => {
    vi.useFakeTimers({toFake: ['Date'], now: new Date(2026, 10, 23, 9, 0, 30)});
    const f = setup();
    f.load(0, 'S-1', '134°C · 5 min · σύνολο 45 min');
    vi.setSystemTime(new Date(2026, 10, 23, 9, 30));
    // Still running: the next load waits.
    expect(f.load(1, 'S-2', '134°C · 5 min')).toBeUndefined();
    vi.setSystemTime(new Date(2026, 10, 23, 10, 5));
    expect(f.load(1, 'S-2', '134°C · 5 min')?.status).toBe('OPEN');
    const ended = f.s().processLoads.find(l => l.cycleNumber === 'S-1')!;
    expect(ended.status).toBe('AWAITING_RELEASE');
    // Ended 45 minutes after its exact start (09:00:30), not at the start of its minute.
    expect(ended.completedAt).toBe('23/11/2026 09:45');
    expect(ended.startedAtMs).toBe(new Date(2026, 10, 23, 9, 0, 30).getTime());
    expect(ended.note).toContain('Αυτόματο τέλος κύκλου');
    // One record per load and item, so that two apps recording the same end keep one.
    const cycles = f.s().sterilizationCycles.filter(c => c.loadId === ended.id);
    expect(cycles.map(c => c.id)).toEqual([`sc-auto-${ended.id}-${cycles[0].assetKind}-${cycles[0].assetId}`]);
    // It does not go back into the sterilizer while S-2 is in it.
    expect(f.run(() => f.s().reopenProcessLoad(ended.id, 'Ο κύκλος δεν είχε τελειώσει'))).toBe(false);
    expect(f.s().processLoads.find(l => l.id === ended.id)?.status).toBe('AWAITING_RELEASE');
    const second = f.s().processLoads.find(l => l.cycleNumber === 'S-2')!;
    f.run(() => f.s().finishProcessLoad(second.id, 'PASSED'));
    // Back into the sterilizer: it is ended by hand from then on, and its new result is a record of its own.
    expect(f.run(() => f.s().reopenProcessLoad(ended.id, 'Ο κύκλος δεν είχε τελειώσει'))).toBe(true);
    vi.setSystemTime(new Date(2026, 10, 23, 11, 0));
    expect(f.s().processLoads.find(l => l.id === ended.id)?.status).toBe('OPEN');
    f.run(() => f.s().finishProcessLoad(ended.id, 'FAILED'));
    const after = f.s().sterilizationCycles.filter(c => c.loadId === ended.id);
    expect(after).toHaveLength(2);
    expect(after.find(c => c.result === 'FAILED')?.id).not.toMatch(/^sc-auto-/);
  });
});
