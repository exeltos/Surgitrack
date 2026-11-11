import {describe, expect, it} from 'vitest';
import {assetLifecycle, queueOfStage} from '../assetLifecycle';
import {defaultSterilizationWorkflow} from '../workflow';

const stages = defaultSterilizationWorkflow.stages;

describe('where an item is on its way round', () => {
  it('starts in the department and lists every stage that is on, in order', () => {
    const life = assetLifecycle(stages, 'IN_DEPARTMENT')!;
    expect(life.current).toBe(0);
    // Storage is off by default.
    expect(life.steps).toEqual([
      'DEPARTMENT',
      'RECEIPT',
      'WASHING',
      'PREPARATION',
      'PACKAGING',
      'STERILIZATION',
      'RELEASE',
      'DELIVERY',
    ]);
  });

  it('puts an item at the stage it waits for or is in', () => {
    const at = (state: string) => assetLifecycle(stages, state)!.steps[assetLifecycle(stages, state)!.current];
    expect(at('PENDING_STERILIZATION')).toBe('RECEIPT');
    expect(at('IN_WASHING')).toBe('WASHING');
    expect(at('IN_PREPARATION')).toBe('PREPARATION');
    expect(at('IN_STERILIZATION')).toBe('STERILIZATION');
    expect(at('AWAITING_RELEASE')).toBe('RELEASE');
    expect(at('READY_FOR_PICKUP')).toBe('DELIVERY');
  });

  it('hands an item left in a stage that was turned off to the next stage that is on', () => {
    const noPacking = stages.map(stage => (stage.id === 'PACKAGING' ? {...stage, enabled: false} : stage));
    const life = assetLifecycle(noPacking, 'IN_PACKAGING')!;
    expect(life.steps).not.toContain('PACKAGING');
    expect(life.steps[life.current]).toBe('STERILIZATION');
  });

  it('has nothing for what is not on that way', () => {
    for (const state of ['IN_STOCK', 'SERVICE', 'LOST', 'RETIRED']) expect(assetLifecycle(stages, state)).toBeNull();
  });

  it('knows the Sterilization queue of every stage', () => {
    expect(Object.keys(queueOfStage).sort()).toEqual(stages.map(stage => stage.id).sort());
  });
});
