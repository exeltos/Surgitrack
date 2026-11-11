import {effectiveState, workflowStageState} from './workflow';
import type {WorkflowStageConfig, WorkflowStageId} from './workflow';
import type {Queue} from '../modules/sterilization/sterilizationTypes';

export type LifecycleStepId = 'DEPARTMENT' | WorkflowStageId;

/**
 * Where a Set or instrument is on its way round: in the department, then every stage the hospital has on, in order
 * (Receipt … Delivery), and back to the department. `current` is the step it is at now (waiting for it or in it).
 * Null for what is not on that way: Stock, Service, lost or out of use.
 */
export function assetLifecycle(
  stages: readonly WorkflowStageConfig[],
  state: string,
): {steps: LifecycleStepId[]; current: number} | null {
  const enabled = stages.filter(stage => stage.enabled);
  const steps: LifecycleStepId[] = ['DEPARTMENT', ...enabled.map(stage => stage.id)];
  const handledIn = effectiveState(stages, state);
  if (handledIn === 'IN_DEPARTMENT') return {steps, current: 0};
  const index = enabled.findIndex(stage => workflowStageState[stage.id] === handledIn);
  return index < 0 ? null : {steps, current: index + 1};
}

/** The Sterilization screen's queue where an item at this stage is handled. */
export const queueOfStage: Record<WorkflowStageId, Queue> = {
  RECEIPT: 'INCOMING',
  WASHING: 'WASHING',
  PREPARATION: 'PREP',
  PACKAGING: 'PACKAGING',
  STERILIZATION: 'PROCESS',
  RELEASE: 'RELEASE',
  STORAGE: 'STORAGE',
  DELIVERY: 'READY',
};
