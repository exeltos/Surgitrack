import {describe, expect, it} from 'vitest';
import {navSectionFor} from '../navigation';

describe('navSectionFor', () => {
  const noTool = () => undefined;

  it('keeps Traceability lit on its tabs and on a looked-up item', () => {
    expect(navSectionFor('/traceability', noTool)).toBe('/traceability');
  });

  it('lights Sets for a Set’s page and Instruments for a Set member', () => {
    expect(navSectionFor('/sets/s1', noTool)).toBe('/sets');
    expect(navSectionFor('/tools/t1', () => 'SET_MEMBER')).toBe('/tools');
    expect(navSectionFor('/tools/t1', () => 'STANDALONE')).toBe('/standalone-tools');
  });
});
