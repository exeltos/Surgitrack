import {compositionLines} from '../../core/compositionCheck';
import {effectiveState, type WorkflowStageConfig} from '../../core/workflow';
import type {AssetState, ProcessLoadRecord, SetAsset, Tool} from '../../types/domain';

/**
 * What waits at each scanning station, for the number on its tile: what departments sent (Receive), what is
 * ready for the sterilizer (Load), the cycles to end or release (Release), what is ready for the departments
 * (Delivery), and for a department what it can collect (Pickup). Sets and standalone instruments, each in the
 * stage it is handled in (a stage turned off in Studio counts in the next one).
 */
export function stationCounts(
  sets: SetAsset[],
  tools: Tool[],
  processLoads: ProcessLoadRecord[],
  stages: readonly WorkflowStageConfig[],
  department: string,
): Record<string, number> {
  const all = [
    ...sets.map(x => ({
      key: `SET:${x.id}`,
      state: effectiveState(stages, x.state) as AssetState,
      department: x.department,
    })),
    ...tools
      .filter(t => t.mode === 'STANDALONE')
      .map(x => ({
        key: `TOOL:${x.id}`,
        state: effectiveState(stages, x.state) as AssetState,
        department: x.department,
      })),
  ];
  const sterilizing = processLoads.filter(load => load.kind === 'STERILIZATION');
  const loaded = new Set(
    sterilizing
      .filter(load => load.status === 'OPEN')
      .flatMap(load => load.items.map(i => `${i.assetKind}:${i.assetId}`)),
  );
  const count = (state: AssetState) => all.filter(x => x.state === state).length;
  return {
    receive: count('PENDING_STERILIZATION'),
    load: all.filter(x => x.state === 'IN_STERILIZATION' && !loaded.has(x.key)).length,
    release: sterilizing.filter(load => load.status === 'OPEN' || load.status === 'AWAITING_RELEASE').length,
    deliver: count('READY_FOR_PICKUP'),
    pickup: all.filter(x => x.state === 'READY_FOR_PICKUP' && !!department && x.department === department).length,
  };
}

/** How many instruments a Set misses, counted as its composition sheet counts them. */
export function setMissing(set: SetAsset, tools: Tool[]): number {
  return compositionLines(set.compositionTemplate, tools, new Map()).reduce((sum, line) => sum + line.missing, 0);
}
