import {describe, expect, it} from 'vitest';
import {reprocessReason} from '../reprocessReason';
import type {
  ProcessLoadRecord,
  RecallCase,
  SterilizationCycleRecord,
  SterilizationReleaseRecord,
} from '../../types/domain';

const cycle = (over: Partial<SterilizationCycleRecord>): SterilizationCycleRecord =>
  ({
    id: 'c1',
    loadId: 'L1',
    assetId: 'S1',
    sterilizer: 'Κλίβανος 1',
    cycleNumber: '0815',
    result: 'PASSED',
    ...over,
  }) as SterilizationCycleRecord;
const release = (over: Partial<SterilizationReleaseRecord>): SterilizationReleaseRecord =>
  ({
    id: 'r1',
    loadId: 'L1',
    assetId: 'S1',
    cycleRecordId: 'c1',
    physicalParametersOk: true,
    chemicalIndicatorOk: true,
    packagingIntegrityOk: true,
    biologicalIndicatorResult: 'NOT_REQUIRED',
    decision: 'RELEASED',
    ...over,
  }) as SterilizationReleaseRecord;

describe('why an item must be processed again', () => {
  it('says nothing for an item that never went through the sterilizer, or whose last cycle passed and was released', () => {
    expect(reprocessReason('S1', [], [])).toBeUndefined();
    expect(reprocessReason('S1', [cycle({})], [release({})])).toBeUndefined();
    expect(reprocessReason('S1', [cycle({})], [])).toBeUndefined();
  });

  it('names a failed cycle', () => {
    expect(reprocessReason('S1', [cycle({result: 'FAILED', note: 'Συναγερμός'})], [])).toEqual({
      kind: 'CYCLE_FAILED',
      sterilizer: 'Κλίβανος 1',
      cycleNumber: '0815',
      note: 'Συναγερμός',
    });
  });

  it('names a load not released, with the checks that failed', () => {
    const loads = [{id: 'L1', chemicalIndicatorResult: 'FAIL'} as ProcessLoadRecord];
    const reason = reprocessReason(
      'S1',
      [cycle({})],
      [release({decision: 'REPROCESS', biologicalIndicatorResult: 'FAIL', chemicalIndicatorOk: false})],
      loads,
    );
    expect(reason).toMatchObject({kind: 'NOT_RELEASED', failedChecks: ['CHEMICAL', 'BIOLOGICAL']});
  });

  it('forgets the old failure once a newer cycle passes', () => {
    const cycles = [cycle({id: 'c2'}), cycle({id: 'c1', result: 'FAILED'})];
    expect(reprocessReason('S1', cycles, [])).toBeUndefined();
  });

  it('names a released load that was recalled (a failed biological indicator)', () => {
    const recalls = [{loadId: 'L1', reason: 'Ανεπιτυχής βιολογικός δείκτης', items: [{assetId: 'S1'}]} as RecallCase];
    expect(reprocessReason('S1', [cycle({})], [release({})], [], recalls)).toMatchObject({
      kind: 'RECALLED',
      note: 'Ανεπιτυχής βιολογικός δείκτης',
    });
  });
});
