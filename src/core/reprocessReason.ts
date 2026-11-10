import type {
  ProcessLoadRecord,
  RecallCase,
  SterilizationCycleRecord,
  SterilizationReleaseRecord,
} from '../types/domain';

/** Why an item is back in the stages before the sterilizer: its last cycle failed, or its load was not released. */
export type ReprocessReason = {
  kind: 'CYCLE_FAILED' | 'NOT_RELEASED' | 'RECALLED';
  sterilizer: string;
  cycleNumber: string;
  note?: string;
  /** For a load not released: the checks that were not OK. */
  failedChecks?: Array<'PHYSICAL' | 'CHEMICAL' | 'PACKAGING' | 'BIOLOGICAL'>;
};

/**
 * The reason an item must be processed again, from its newest cycle (the lists keep the newest first): a failed
 * cycle, or a passed one whose load was not released. Nothing once a newer cycle has passed.
 */
export function reprocessReason(
  assetId: string,
  cycles: readonly SterilizationCycleRecord[],
  releases: readonly SterilizationReleaseRecord[],
  /** The loads, for the chemical indicator's result (the release only keeps whether it passed). */
  loads: readonly ProcessLoadRecord[] = [],
  /** The recalls (a released load called back, e.g. a failed biological indicator). */
  recalls: readonly RecallCase[] = [],
): ReprocessReason | undefined {
  const cycle = cycles.find(item => item.assetId === assetId);
  if (!cycle) return undefined;
  if (cycle.result === 'FAILED')
    return {kind: 'CYCLE_FAILED', sterilizer: cycle.sterilizer, cycleNumber: cycle.cycleNumber, note: cycle.note};
  const release = releases.find(item => item.assetId === assetId && item.cycleRecordId === cycle.id);
  if (release?.decision === 'RELEASED') {
    const recall = recalls.find(item => item.loadId === cycle.loadId && item.items.some(i => i.assetId === assetId));
    return recall
      ? {kind: 'RECALLED', sterilizer: cycle.sterilizer, cycleNumber: cycle.cycleNumber, note: recall.reason}
      : undefined;
  }
  if (release?.decision !== 'REPROCESS') return undefined;
  const failedChecks: NonNullable<ReprocessReason['failedChecks']> = [];
  if (!release.physicalParametersOk) failedChecks.push('PHYSICAL');
  if (loads.find(load => load.id === cycle.loadId)?.chemicalIndicatorResult === 'FAIL') failedChecks.push('CHEMICAL');
  if (!release.packagingIntegrityOk) failedChecks.push('PACKAGING');
  if (release.biologicalIndicatorResult === 'FAIL') failedChecks.push('BIOLOGICAL');
  return {
    kind: 'NOT_RELEASED',
    sterilizer: cycle.sterilizer,
    cycleNumber: cycle.cycleNumber,
    note: release.note,
    failedChecks,
  };
}
