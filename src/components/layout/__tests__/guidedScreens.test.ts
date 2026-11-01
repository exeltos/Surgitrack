import {describe, expect, it} from 'vitest';
import {GUIDED_SCREENS, hasScreenGuide} from '../guidedScreens';
import {screenSection} from '../screenSection';
import {helpManual} from '../../../core/help/helpManual';

describe('which screens have a guide', () => {
  it("lists exactly the manual's menu screens, with their permissions", () => {
    const fromManual = helpManual.filter(s => !s.guide && !s.detailOf).map(s => [s.to, s.permission]);
    expect(GUIDED_SCREENS.map(([path, permission]) => [path, permission])).toEqual(fromManual);
  });

  it('answers like the manual for every screen and permission', () => {
    for (const path of [...GUIDED_SCREENS.map(([p]) => p), '/start', '/tools/abc', '/nowhere']) {
      for (const can of [() => true, () => false]) {
        expect(hasScreenGuide(path, can), path).toBe(!!screenSection(path, can));
      }
    }
  });
});
