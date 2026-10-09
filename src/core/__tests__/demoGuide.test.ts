import {describe, expect, it} from 'vitest';
import {guideProgress, guideSteps, visitStepsFor} from '../demoGuide';

describe('first-steps guide', () => {
  it('gives each role its own steps; the Demo admin also invites a colleague', () => {
    expect(guideSteps('STERILIZATION').map(s => s.key)).toEqual([
      'receive',
      'prepare',
      'cycle',
      'release',
      'deliver',
      'trace',
      'reports',
    ]);
    expect(guideSteps('ADMIN').map(s => s.key)).toContain('invite');
    expect(guideSteps('DEPARTMENT').map(s => s.key)).toEqual(['department', 'dispatch', 'count', 'issue', 'history']);
    expect(guideSteps('VIEWER').every(s => s.check.kind === 'visit')).toBe(true);
  });

  it('keeps every key unique and short enough for the database', () => {
    for (const role of ['ADMIN', 'STERILIZATION', 'DEPARTMENT', 'VIEWER'] as const) {
      const keys = guideSteps(role).map(s => s.key);
      expect(new Set(keys).size).toBe(keys.length);
      keys.forEach(k => expect(k).toMatch(/^[a-z_]{2,40}$/));
    }
  });

  it('completes visit steps on their screen and below it', () => {
    const steps = guideSteps('DEPARTMENT');
    expect(visitStepsFor(steps, '/movements').map(s => s.key)).toEqual(['history']);
    expect(visitStepsFor(steps, '/department/x').map(s => s.key)).toEqual(['department']);
    expect(visitStepsFor(steps, '/departments')).toEqual([]);
  });

  it('counts progress and points at the next step', () => {
    const steps = guideSteps('VIEWER');
    expect(guideProgress(steps, new Set(['overview']))).toMatchObject({done: 1, total: 3, next: steps[1]});
    expect(guideProgress(steps, new Set(steps.map(s => s.key))).next).toBeUndefined();
  });
});
