import {describe, expect, it} from 'vitest';
import {guideSteps} from '../demoGuide';
import {MODULES, modulesToRate, npsGroup, suggestFinal} from '../demoFeedback';

describe('Demo feedback', () => {
  it('offers a part of the app for rating once one of its steps is done', () => {
    const steps = guideSteps('STERILIZATION');
    expect(modulesToRate(steps, new Set())).toEqual([]);
    expect(modulesToRate(steps, new Set(['cycle', 'trace'])).map(m => m.key)).toEqual([
      'sterilization',
      'traceability',
    ]);
  });

  it("never offers a part outside the person's own steps", () => {
    const keys = modulesToRate(guideSteps('DEPARTMENT'), new Set(['dispatch', 'invite', 'trace'])).map(m => m.key);
    expect(keys).toEqual(['department']);
  });

  it('covers every guide step with exactly one part', () => {
    const all = ['ADMIN', 'STERILIZATION', 'DEPARTMENT', 'VIEWER'].flatMap(r =>
      guideSteps(r as 'ADMIN').map(s => s.key),
    );
    for (const key of new Set(all)) expect(MODULES.filter(m => m.steps.includes(key))).toHaveLength(1);
    for (const m of MODULES) expect(m.key).toMatch(/^[a-z_]{2,40}$/);
  });

  it('suggests the final evaluation near the end of the guide or of the Demo', () => {
    expect(suggestFinal({done: 2, total: 8}, 10)).toBe(false);
    expect(suggestFinal({done: 7, total: 8}, 10)).toBe(true);
    expect(suggestFinal({done: 0, total: 8}, 3)).toBe(true);
    expect(suggestFinal({done: 0, total: 0}, 1)).toBe(false);
  });

  it('groups NPS answers', () => {
    expect([10, 9, 8, 7, 6, 0].map(npsGroup)).toEqual([
      'PROMOTER',
      'PROMOTER',
      'PASSIVE',
      'PASSIVE',
      'DETRACTOR',
      'DETRACTOR',
    ]);
  });
});
