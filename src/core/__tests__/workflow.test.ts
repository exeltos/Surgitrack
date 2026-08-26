import {describe, expect, it} from 'vitest';
import {defaultSterilizationWorkflow, nextStateAfter, reprocessState, workflowStageState} from '../workflow';
import type {WorkflowStageConfig} from '../workflow';

const withStages = (overrides: Partial<Record<WorkflowStageConfig['id'], boolean>>): WorkflowStageConfig[] =>
  defaultSterilizationWorkflow.stages.map(stage =>
    stage.id in overrides ? {...stage, enabled: overrides[stage.id]!} : stage,
  );

describe('nextStateAfter', () => {
  it('advances to the very next stage when every stage is enabled', () => {
    const stages = defaultSterilizationWorkflow.stages;
    expect(nextStateAfter(stages, 'RECEIPT')).toBe(workflowStageState.WASHING);
    expect(nextStateAfter(stages, 'WASHING')).toBe(workflowStageState.PREPARATION);
    expect(nextStateAfter(stages, 'STERILIZATION')).toBe(workflowStageState.RELEASE);
  });

  it('skips a disabled stage and lands on the next enabled one', () => {
    // STORAGE is disabled by default in the facility template; PACKAGING should skip
    // straight past it to DELIVERY once RELEASE has completed.
    const stages = defaultSterilizationWorkflow.stages;
    expect(nextStateAfter(stages, 'RELEASE')).toBe(workflowStageState.DELIVERY);
  });

  it('skips multiple consecutive disabled stages', () => {
    const stages = withStages({PACKAGING: false, STERILIZATION: false});
    // After PREPARATION, both PACKAGING and STERILIZATION are off, so the item should
    // land straight on RELEASE.
    expect(nextStateAfter(stages, 'PREPARATION')).toBe(workflowStageState.RELEASE);
  });

  it('falls back to READY_FOR_PICKUP when no enabled stage remains after the given one', () => {
    const stages = withStages({DELIVERY: false});
    expect(nextStateAfter(stages, 'RELEASE')).toBe('READY_FOR_PICKUP');
  });

  it('never routes back into RECEIPT, since a completed stage cannot precede intake', () => {
    // RECEIPT is always first in the configured stage order, so no stage after it
    // should ever resolve back to RECEIPT's state.
    defaultSterilizationWorkflow.stages
      .filter(stage => stage.id !== 'RECEIPT')
      .forEach(stage => {
        expect(nextStateAfter(defaultSterilizationWorkflow.stages, stage.id)).not.toBe(workflowStageState.RECEIPT);
      });
  });
});

describe('reprocessState', () => {
  it('sends a failed load to the first enabled stage after RECEIPT', () => {
    const stages = defaultSterilizationWorkflow.stages;
    expect(reprocessState(stages)).toBe(workflowStageState.WASHING);
  });

  it('never sends a reprocessed load back to RECEIPT, even if RECEIPT is somehow disabled', () => {
    // RECEIPT is a locked/protected stage in the UI and should never be disabled in
    // practice, but the state machine itself must not depend on that — reprocessing
    // must always resume mid-pipeline, not re-trigger physical intake.
    const stages = withStages({RECEIPT: false});
    expect(reprocessState(stages)).not.toBe(workflowStageState.RECEIPT);
    expect(reprocessState(stages)).toBe(workflowStageState.WASHING);
  });

  it('skips disabled intermediate stages to find the first enabled one after RECEIPT', () => {
    const stages = withStages({WASHING: false, PREPARATION: false});
    expect(reprocessState(stages)).toBe(workflowStageState.PACKAGING);
  });

  it('falls back to IN_PREPARATION if every stage after RECEIPT is disabled', () => {
    const stages = withStages({
      WASHING: false,
      PREPARATION: false,
      PACKAGING: false,
      STERILIZATION: false,
      RELEASE: false,
      STORAGE: false,
      DELIVERY: false,
    });
    expect(reprocessState(stages)).toBe('IN_PREPARATION');
  });
});

describe('protected core stages', () => {
  it('RECEIPT, STERILIZATION and DELIVERY are marked locked in the default facility template', () => {
    // These three are the chain-of-custody milestones that Studio explicitly tells
    // the user cannot be turned off (see StudioPage's "Protected core workflow"
    // banner). This test guards against that guarantee silently drifting.
    const locked = defaultSterilizationWorkflow.stages.filter(stage => stage.locked).map(stage => stage.id);
    expect(locked).toEqual(expect.arrayContaining(['RECEIPT', 'STERILIZATION', 'DELIVERY']));
  });

  it('every stage id used in the template has a corresponding asset state mapping', () => {
    defaultSterilizationWorkflow.stages.forEach(stage => {
      expect(workflowStageState[stage.id]).toBeDefined();
    });
  });
});
