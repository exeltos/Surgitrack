import type {ReactNode} from 'react';
import {act, renderHook} from '@testing-library/react';
import {beforeEach, describe, expect, it} from 'vitest';
import {LibraryStoreProvider} from '../../core/LibraryStore';
import {SurgiProvider, useSurgi} from '../SurgiStore';
import type {AssetKind} from '../../types/domain';
import type {ReleaseProcessLoadPayload} from '../types';

const wrapper = ({children}: {children: ReactNode}) => (
  <LibraryStoreProvider>
    <SurgiProvider dataMode="DEMO">{children}</SurgiProvider>
  </LibraryStoreProvider>
);

const deliverer = {deliveredByUserId: 'u-dept', deliveredByName: 'ΝΟΣΗΛΕΥΤΗΣ ΤΕΣΤ', deliveredByDepartment: 'Τμήμα'};
const receiver = {receivedByUserId: 'u-dept', receivedByName: 'ΝΟΣΗΛΕΥΤΗΣ ΤΕΣΤ', receivedByDepartment: 'Τμήμα'};
const passingRelease: ReleaseProcessLoadPayload = {
  physicalParametersOk: true,
  chemicalIndicatorOk: true,
  packagingIntegrityOk: true,
  biologicalIndicatorResult: 'NOT_REQUIRED',
  decision: 'RELEASED',
};

/** Drives the store like the Sterilization screens do, one action at a time (state updates between actions). */
const setup = () => {
  const {result} = renderHook(() => useSurgi(), {wrapper});
  const s = () => result.current;
  // A standalone instrument back in its department with no usage limit, so nothing but the flow decides.
  const asset = s().tools.find(t => t.mode === 'STANDALONE' && t.state === 'IN_DEPARTMENT' && !t.maxUses)!;
  const kind: AssetKind = 'TOOL';
  const state = () => s().tools.find(x => x.id === asset.id)!.state;
  const instrument = () => s().tools.find(x => x.id === asset.id)!;
  const act1 = <T,>(fn: () => T) => {
    let out!: T;
    act(() => {
      out = fn();
    });
    return out;
  };
  const send = () => act1(() => s().sendToSterilization(kind, asset.id));
  const receive = () => act1(() => s().receiveAtSterilization(kind, asset.id, deliverer));
  const wash = () =>
    act1(() =>
      s().createProcessLoad({
        kind: 'WASHING',
        assetRefs: [{kind, id: asset.id}],
        equipment: 'ΠΛΥΝΤΗΡΙΟ 1',
        cycleNumber: 'W-1',
        program: 'ΘΕΡΜΙΚΗ',
      }),
    );
  const prepare = () =>
    act1(() =>
      s().recordPreparation(kind, asset.id, {
        toolIds: [asset.id],
        checkedToolIds: [asset.id],
        allOk: true,
      }),
    );
  const pack = () =>
    act1(() => s().completeWorkflowCheckpoint(kind, asset.id, {stageId: 'PACKAGING', checks: [true, true, true]}));
  const sterilize = (chemicalIndicatorResult: 'PASS' | 'FAIL' = 'PASS', cycleNumber = 'S-1') =>
    act1(() =>
      s().createProcessLoad({
        kind: 'STERILIZATION',
        assetRefs: [{kind, id: asset.id}],
        equipment: 'ΚΛΙΒΑΝΟΣ 1',
        cycleNumber,
        program: '134°C',
        chemicalIndicatorResult,
      }),
    );
  const release = (loadId: string, over: Partial<ReleaseProcessLoadPayload> = {}) =>
    act1(() => s().releaseProcessLoad(loadId, {...passingRelease, ...over}));
  const deliver = () => act1(() => s().completeDeliveryToDepartment(kind, asset.id, receiver));
  /** Runs the asset through to a sterilization load awaiting release. */
  const toAwaitingRelease = () => {
    send();
    receive();
    wash();
    prepare();
    pack();
    return sterilize()!;
  };
  return {
    s,
    asset,
    kind,
    state,
    instrument,
    send,
    receive,
    wash,
    prepare,
    pack,
    sterilize,
    release,
    deliver,
    toAwaitingRelease,
  };
};

describe('sterilization flow', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem('surgitrack-demo-role', 'STERILIZATION');
  });

  it('has a plain demo instrument to run the flow with', () => {
    expect(setup().asset).toBeTruthy();
  });

  it('takes an instrument from its department to sterile and back, recording every step', () => {
    const f = setup();
    const movementsBefore = f.s().movements.length;
    expect(f.state()).toBe('IN_DEPARTMENT');

    f.send();
    expect(f.state()).toBe('PENDING_STERILIZATION');

    const receipt = f.receive()!;
    expect(receipt.assetId).toBe(f.asset.id);
    expect(receipt.receivedByName).toBeTruthy();
    expect(f.state()).toBe('IN_WASHING');

    const wash = f.wash()!;
    expect(wash.status).toBe('PASSED');
    expect(f.state()).toBe('IN_PREPARATION');

    f.prepare();
    expect(f.state()).toBe('IN_PACKAGING');

    f.pack();
    expect(f.state()).toBe('IN_STERILIZATION');

    const sterilizationsBefore = f.instrument().sterilizations || 0;
    const load = f.sterilize()!;
    expect(load.status).toBe('AWAITING_RELEASE');
    expect(f.state()).toBe('AWAITING_RELEASE');
    expect(f.instrument().sterilizations).toBe(sterilizationsBefore + 1);

    const released = f.release(load.id)!;
    expect(released.status).toBe('RELEASED');
    expect(released.releasedAt).toBeTruthy();
    expect(f.state()).toBe('READY_FOR_PICKUP');
    expect(f.s().sterilizationReleases.some(r => r.loadId === load.id && r.decision === 'RELEASED')).toBe(true);

    const delivery = f.deliver()!;
    expect(delivery.assetId).toBe(f.asset.id);
    expect(f.state()).toBe('IN_DEPARTMENT');

    // Every step left a traceability entry: dispatch, receipt, wash, preparation, packaging, cycle, release, delivery.
    expect(f.s().movements.length - movementsBefore).toBeGreaterThanOrEqual(8);
    expect(f.s().receipts.some(r => r.assetId === f.asset.id)).toBe(true);
    expect(f.s().preparations.some(p => p.assetId === f.asset.id)).toBe(true);
    expect(f.s().sterilizationCycles.some(c => c.loadId === load.id && c.result === 'PASSED')).toBe(true);
    expect(f.s().deliveries.some(d => d.assetId === f.asset.id)).toBe(true);
  });

  it('only accepts an asset into a load while it is in the matching stage', () => {
    const f = setup();
    // In its department: neither a washing nor a sterilization load may take it.
    const loadsBefore = f.s().processLoads.length;
    expect(f.wash()).toBeUndefined();
    expect(f.sterilize()).toBeUndefined();
    expect(f.s().processLoads.length).toBe(loadsBefore);
    expect(f.state()).toBe('IN_DEPARTMENT');

    // Received but not yet washed: still no sterilization.
    f.send();
    f.receive();
    expect(f.sterilize()).toBeUndefined();
    expect(f.state()).toBe('IN_WASHING');
  });

  it('does not deliver an asset that has not been released', () => {
    const f = setup();
    f.send();
    f.receive();
    const deliveriesBefore = f.s().deliveries.length;
    expect(f.deliver()).toBeUndefined();
    expect(f.s().deliveries.length).toBe(deliveriesBefore);
    expect(f.state()).toBe('IN_WASHING');
  });

  it('refuses a stage checkpoint unless every check is ticked', () => {
    const f = setup();
    f.send();
    f.receive();
    f.wash();
    f.prepare();
    expect(f.state()).toBe('IN_PACKAGING');
    const before = f.s().workflowCheckpoints.length;
    expect(
      f.s().completeWorkflowCheckpoint('TOOL', f.asset.id, {stageId: 'PACKAGING', checks: [true, false, true]}),
    ).toBeUndefined();
    expect(f.s().workflowCheckpoints.length).toBe(before);
    expect(f.state()).toBe('IN_PACKAGING');
  });

  describe('single-asset cycle (outside a load)', () => {
    const toSterilization = () => {
      const f = setup();
      f.send();
      f.receive();
      f.wash();
      f.prepare();
      f.pack();
      return f;
    };
    const cycle = (f: ReturnType<typeof setup>, indicatorResult: 'PASS' | 'FAIL') =>
      act(
        () =>
          void f.s().completeSterilizationCycle(f.kind, f.asset.id, {
            sterilizer: 'ΚΛΙΒΑΝΟΣ 2',
            cycleNumber: 'C-7',
            program: '134°C',
            indicatorResult,
          }),
      );
    const releaseCycle = (f: ReturnType<typeof setup>, over: Partial<ReleaseProcessLoadPayload> = {}) =>
      act(
        () =>
          void f.s().releaseSterilization(f.kind, f.asset.id, {
            ...passingRelease,
            cycleRecordId: f.s().sterilizationCycles.find(c => c.assetId === f.asset.id)!.id,
            ...over,
          }),
      );

    it('passes the cycle on to release, then to pickup', () => {
      const f = toSterilization();
      const before = f.instrument().sterilizations || 0;
      cycle(f, 'PASS');
      expect(f.state()).toBe('AWAITING_RELEASE');
      expect(f.instrument().sterilizations).toBe(before + 1);
      releaseCycle(f);
      expect(f.state()).toBe('READY_FOR_PICKUP');
      expect(f.s().sterilizationReleases[0]).toMatchObject({assetId: f.asset.id, decision: 'RELEASED'});
    });

    it('keeps a failed cycle in reprocessing without counting it', () => {
      const f = toSterilization();
      const before = f.instrument().sterilizations || 0;
      cycle(f, 'FAIL');
      expect(f.s().sterilizationCycles[0].result).toBe('FAILED');
      // Current behaviour: unlike a failed load (which goes back to reprocessing), a failed single
      // cycle leaves the asset in the sterilizer stage to be run again.
      expect(f.state()).toBe('IN_STERILIZATION');
      expect(f.instrument().sterilizations || 0).toBe(before);
      // Nothing is awaiting release, so a release is refused.
      const releases = f.s().sterilizationReleases.length;
      releaseCycle(f);
      expect(f.s().sterilizationReleases.length).toBe(releases);
    });

    it.each([
      ['chemical indicator not acceptable', {chemicalIndicatorOk: false}],
      ['packaging not intact', {packagingIntegrityOk: false}],
      ['physical parameters not acceptable', {physicalParametersOk: false}],
    ])('does not release when %s', (_label, over) => {
      const f = toSterilization();
      cycle(f, 'PASS');
      releaseCycle(f, over);
      expect(f.s().sterilizationReleases[0].decision).toBe('REPROCESS');
      expect(f.state()).toBe('IN_WASHING');
    });
  });

  describe('failed cycle', () => {
    it('returns the load to reprocessing, counts no sterilization and cannot be released', () => {
      const f = setup();
      f.send();
      f.receive();
      f.wash();
      f.prepare();
      f.pack();
      const sterilizationsBefore = f.instrument().sterilizations || 0;

      const load = f.sterilize('FAIL')!;
      expect(load.status).toBe('FAILED');
      expect(f.state()).toBe('IN_WASHING');
      expect(f.instrument().sterilizations || 0).toBe(sterilizationsBefore);
      expect(f.s().sterilizationCycles.find(c => c.loadId === load.id)!.result).toBe('FAILED');

      const releasesBefore = f.s().sterilizationReleases.length;
      expect(f.release(load.id)).toBeUndefined();
      expect(f.s().sterilizationReleases.length).toBe(releasesBefore);
    });
  });

  describe('release gate', () => {
    it.each([
      ['physical parameters not acceptable', {physicalParametersOk: false}],
      ['chemical indicator not acceptable', {chemicalIndicatorOk: false}],
      ['packaging not intact', {packagingIntegrityOk: false}],
      ['biological indicator failed', {biologicalIndicatorResult: 'FAIL' as const}],
      ['the operator chooses to reprocess', {decision: 'REPROCESS' as const}],
    ])('does not release when %s', (_label, over) => {
      const f = setup();
      const load = f.toAwaitingRelease();
      const result = f.release(load.id, over)!;
      expect(result.status).toBe('REPROCESS');
      expect(f.state()).toBe('IN_WASHING');
      expect(f.s().sterilizationReleases.find(r => r.loadId === load.id)!.decision).toBe('REPROCESS');
      // It must go through the whole process again before it can be delivered.
      expect(f.deliver()).toBeUndefined();
    });

    it('releases with only the biological indicator passed, and records both indicators', () => {
      const f = setup();
      const load = f.toAwaitingRelease();
      const result = f.release(load.id, {
        chemicalIndicatorOk: false,
        chemicalIndicatorResult: 'NOT_RECORDED',
        biologicalIndicatorResult: 'PASS',
      })!;
      expect(result.status).toBe('RELEASED');
      expect(result.chemicalIndicatorResult).toBe('NOT_RECORDED');
      expect(result.biologicalIndicatorResult).toBe('PASS');
    });

    it('does not release with no indicator recorded as passed, or with a failed chemical one', () => {
      const none = setup();
      const noneLoad = none.toAwaitingRelease();
      expect(
        none.release(noneLoad.id, {
          chemicalIndicatorOk: false,
          chemicalIndicatorResult: 'NOT_RECORDED',
          biologicalIndicatorResult: 'NOT_REQUIRED',
        })!.status,
      ).toBe('REPROCESS');
      const failed = setup();
      const failedLoad = failed.toAwaitingRelease();
      expect(
        failed.release(failedLoad.id, {
          chemicalIndicatorOk: false,
          chemicalIndicatorResult: 'FAIL',
          biologicalIndicatorResult: 'PASS',
        })!.status,
      ).toBe('REPROCESS');
    });

    it('releases only once: a released load cannot be released again', () => {
      const f = setup();
      const load = f.toAwaitingRelease();
      expect(f.release(load.id)!.status).toBe('RELEASED');
      const count = f.s().sterilizationReleases.length;
      expect(f.release(load.id)).toBeUndefined();
      expect(f.s().sterilizationReleases.length).toBe(count);
    });

    it('ignores a release for a washing load or an unknown load', () => {
      const f = setup();
      f.send();
      f.receive();
      const washing = f.wash()!;
      expect(f.release(washing.id)).toBeUndefined();
      expect(f.release('does-not-exist')).toBeUndefined();
    });
  });

  describe('recall', () => {
    const released = () => {
      const f = setup();
      const load = f.toAwaitingRelease();
      f.release(load.id);
      return {f, load};
    };
    const recall = (f: ReturnType<typeof setup>, loadId: string, reason: string) =>
      act(() => f.s().recallProcessLoad(loadId, reason));

    it('needs a reason and a released load', () => {
      const f = setup();
      const pending = f.toAwaitingRelease();
      recall(f, pending.id, 'Λόγος');
      expect(f.s().recallCases).toHaveLength(0);

      f.release(pending.id);
      recall(f, pending.id, '   ');
      expect(f.s().recallCases).toHaveLength(0);
      expect(f.s().processLoads.find(l => l.id === pending.id)!.status).toBe('RELEASED');
    });

    it('opens one case, pulls the instrument back to reprocessing and blocks its circulation', () => {
      const {f, load} = released();
      f.deliver();
      expect(f.state()).toBe('IN_DEPARTMENT');

      recall(f, load.id, 'Αποτυχία βιολογικού δείκτη');
      const loadAfter = f.s().processLoads.find(l => l.id === load.id)!;
      expect(loadAfter.status).toBe('RECALLED');
      expect(loadAfter.recallReason).toBe('Αποτυχία βιολογικού δείκτη');
      expect(f.s().recallCases).toHaveLength(1);
      const item = f.s().recallCases[0].items[0];
      // It was already out in the department when the recall opened.
      expect(item.status).toBe('OUTSTANDING');
      expect(f.state()).toBe('PENDING_STERILIZATION');

      // The same load cannot be recalled twice.
      recall(f, load.id, 'Ξανά');
      expect(f.s().recallCases).toHaveLength(1);

      // A recalled asset may not circulate (dispatch is refused and nothing is recorded).
      const movements = f.s().movements.length;
      f.send();
      expect(f.s().movements.length).toBe(movements);
    });

    it('closes the case when the recalled instrument is reprocessed and released again', () => {
      const {f, load} = released();
      recall(f, load.id, 'Έλεγχος κλιβάνου');
      expect(f.s().recallCases[0].status).toBe('OPEN');

      // The instrument came back from the shelf: receive it again and run it through the process.
      f.receive();
      expect(f.s().recallCases[0].items[0].status).toBe('REPROCESSING');
      f.wash();
      f.prepare();
      f.pack();
      const again = f.sterilize('PASS', 'S-2')!;
      f.release(again.id);

      expect(f.s().recallCases[0].items[0].status).toBe('CLOSED');
      expect(f.s().recallCases[0].status).toBe('CLOSED');
      expect(f.s().recallCases[0].closedAt).toBeTruthy();
      expect(f.state()).toBe('READY_FOR_PICKUP');
    });
  });

  describe('receipt count', () => {
    const pendingSet = (f: ReturnType<typeof setup>) => f.s().sets.find(x => x.state === 'PENDING_STERILIZATION')!;
    const receiveSet = (f: ReturnType<typeof setup>, over: object) => {
      const set = pendingSet(f);
      act(() => void f.s().receiveAtSterilization('SET', set.id, {...deliverer, checkPerformed: true, ...over}));
      return set;
    };

    it('opens an issue and corrects the set when pieces are missing', () => {
      const f = setup();
      const set = pendingSet(f);
      const expected = f.s().tools.filter(t => t.setId === set.id).length;
      expect(expected).toBeGreaterThan(1);
      const issuesBefore = f.s().issues.length;

      receiveSet(f, {checkedCount: expected - 1, checkResult: 'MISSING', checkNote: 'Λείπει ένα εργαλείο'});

      const receipt = f.s().receipts.find(r => r.assetId === set.id)!;
      expect(receipt.checkResult).toBe('MISSING');
      expect(receipt.expected).toBe(expected);
      expect(receipt.checkedCount).toBe(expected - 1);
      expect(f.s().sets.find(x => x.id === set.id)!.actual).toBe(expected - 1);
      expect(f.s().issues.length).toBe(issuesBefore + 1);
      expect(f.s().issues[0]).toMatchObject({status: 'OPEN', type: 'Έλλειψη', note: 'Λείπει ένα εργαλείο'});
      expect(f.s().sets.find(x => x.id === set.id)!.state).toBe('IN_WASHING');
    });

    it('opens no issue when the count is complete', () => {
      const f = setup();
      const set = pendingSet(f);
      const expected = f.s().tools.filter(t => t.setId === set.id).length;
      const issuesBefore = f.s().issues.length;

      receiveSet(f, {checkedCount: expected, checkResult: 'OK'});

      expect(f.s().issues.length).toBe(issuesBefore);
      expect(f.s().receipts.find(r => r.assetId === set.id)!.checkResult).toBe('OK');
    });
  });
});
