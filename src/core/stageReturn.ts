import {effectiveState, workflowStageState, type WorkflowStageConfig, type WorkflowStageId} from './workflow';

/**
 * Returning a Set or instrument to an earlier stage of Sterilization by hand (put through a stage by mistake,
 * or received on the wrong tablet). Only who may correct uses (the owner, the hospital admin and the
 * Sterilization supervisor) does it, with a reason, and the move is recorded in the history.
 */

export type ReturnTargetId = WorkflowStageId | 'DEPARTMENT';
export type ReturnTarget = {
  id: ReturnTargetId;
  state: string;
  label: string;
  /** For the return to the department: which one (shown on its own, after «Τμήμα»). */
  department?: string;
};

/** The stage the release waits in: it belongs to a whole load, so an item is never put back into it. */
const NOT_A_TARGET: readonly WorkflowStageId[] = ['RELEASE'];

/**
 * Where an item in `state` may be put back to: every enabled earlier stage, nearest first, and its department
 * (sent to Sterilization or released by mistake). A delivered item (at its department) may go back to any stage,
 * the delivery included. The release is never a target. Nothing for an item elsewhere (in Service, retired).
 */
export function returnTargets(
  stages: readonly WorkflowStageConfig[],
  state: string,
  department = 'Τμήμα',
): ReturnTarget[] {
  const stageTargets = (list: readonly WorkflowStageConfig[]): ReturnTarget[] =>
    list
      .filter(stage => stage.enabled && !NOT_A_TARGET.includes(stage.id))
      .map(stage => ({id: stage.id, state: workflowStageState[stage.id], label: stage.labelEl}))
      .reverse();
  if (state === 'IN_DEPARTMENT') return stageTargets(stages);
  const current = effectiveState(stages, state);
  const index = stages.findIndex(stage => workflowStageState[stage.id] === current);
  if (index < 0) return [];
  return [
    ...stageTargets(stages.slice(0, index)),
    {id: 'DEPARTMENT', state: 'IN_DEPARTMENT', label: `Τμήμα · ${department}`, department},
  ];
}

export type ReturnRefusal =
  /** Loaded in a sterilizer whose cycle is still running: take it out of the load or end the cycle first. */
  | 'IN_RUNNING_LOAD'
  /** The only item left of a load waiting for release: that load is released as «Μη αποδέσμευση». */
  | 'LAST_IN_LOAD'
  | 'NO_TARGET';

export const returnRefusalText = (reason: ReturnRefusal) =>
  reason === 'IN_RUNNING_LOAD'
    ? 'Είναι σε κλίβανο με κύκλο σε εξέλιξη: χρησιμοποιήστε «Αναίρεση φόρτωσης» ή τερματίστε τον κύκλο.'
    : reason === 'LAST_IN_LOAD'
      ? 'Είναι το μόνο που απομένει στο φορτίο: αποδεσμεύστε το φορτίο ως «Μη αποδέσμευση» για να γυρίσει σε επανεπεξεργασία.'
      : 'Δεν υπάρχει προηγούμενο στάδιο.';
