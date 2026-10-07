import {describe, expect, it} from 'vitest';
import {releaseIndicatorVerdict, type ReleasePolicy} from '../releaseIndicators';

const open: ReleasePolicy = {
  requireChemicalIndicator: false,
  biologicalIndicator: 'OPTIONAL',
  allowReleaseWhileBiPending: false,
};

describe('releaseIndicatorVerdict', () => {
  it('lets either indicator alone release the load', () => {
    expect(releaseIndicatorVerdict(open, 'PASS', 'NOT_REQUIRED')).toEqual({ok: true});
    expect(releaseIndicatorVerdict(open, 'NOT_RECORDED', 'PASS')).toEqual({ok: true});
    expect(releaseIndicatorVerdict(open, 'PASS', 'PASS')).toEqual({ok: true});
  });
  it('needs at least one indicator', () => {
    expect(releaseIndicatorVerdict(open, 'NOT_RECORDED', 'NOT_REQUIRED')).toEqual({ok: false, reason: 'NEEDS_ONE'});
    expect(releaseIndicatorVerdict(open, 'NOT_RECORDED', 'PENDING')).toEqual({ok: false, reason: 'NEEDS_ONE'});
  });
  it('is blocked by a failed indicator even when the other passes', () => {
    expect(releaseIndicatorVerdict(open, 'FAIL', 'PASS')).toEqual({ok: false, reason: 'FAILED'});
    expect(releaseIndicatorVerdict(open, 'PASS', 'FAIL')).toEqual({ok: false, reason: 'FAILED'});
  });
  it('honours what the unit requires', () => {
    const chem = {...open, requireChemicalIndicator: true};
    expect(releaseIndicatorVerdict(chem, 'NOT_RECORDED', 'PASS')).toEqual({ok: false, reason: 'CHEMICAL_REQUIRED'});
    const bio = {...open, biologicalIndicator: 'REQUIRED' as const};
    expect(releaseIndicatorVerdict(bio, 'PASS', 'NOT_REQUIRED')).toEqual({ok: false, reason: 'BIOLOGICAL_REQUIRED'});
    expect(releaseIndicatorVerdict(bio, 'PASS', 'PENDING')).toEqual({ok: false, reason: 'BIOLOGICAL_REQUIRED'});
    expect(releaseIndicatorVerdict({...bio, allowReleaseWhileBiPending: true}, 'PASS', 'PENDING')).toEqual({ok: true});
  });
});

describe('load release is a required stage', () => {
  it('turns a saved workflow that left release off back on and locked', async () => {
    const {defaultSterilizationWorkflow, nextStateAfter, upgradeWorkflowLabels} = await import('../workflow');
    const saved = {
      ...defaultSterilizationWorkflow,
      stages: defaultSterilizationWorkflow.stages.map(stage =>
        stage.id === 'RELEASE' ? {...stage, enabled: false, locked: false} : stage,
      ),
    };
    expect(nextStateAfter(saved.stages, 'STERILIZATION')).toBe('READY_FOR_PICKUP');
    const upgraded = upgradeWorkflowLabels(saved);
    expect(upgraded.stages.find(stage => stage.id === 'RELEASE')).toMatchObject({enabled: true, locked: true});
    expect(nextStateAfter(upgraded.stages, 'STERILIZATION')).toBe('AWAITING_RELEASE');
    expect(upgradeWorkflowLabels(defaultSterilizationWorkflow)).toBe(defaultSterilizationWorkflow);
  });
});
