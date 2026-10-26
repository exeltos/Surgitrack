import {describe, expect, it} from 'vitest';
import {navSectionFor, navigationFor} from '../navigation';
import type {Permission} from '../../core/permissions';

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

describe('History in the menu', () => {
  const paths = (can: (permission: Permission) => boolean) => navigationFor('ADMIN', can).map(item => item.to);

  it('is a tab of Traceability for whoever has Traceability', () => {
    const all = paths(() => true);
    expect(all).toContain('/traceability');
    expect(all).not.toContain('/movements');
  });

  it('stays in the menu when Traceability is taken away', () => {
    const noTrace = paths(permission => permission !== 'traceability.view');
    expect(noTrace).not.toContain('/traceability');
    expect(noTrace).toContain('/movements');
  });
});

describe('the department menu', () => {
  it('starts with its Home, then the Sets and the standalone instruments as two entries', () => {
    const items = navigationFor('DEPARTMENT').map(item => [item.to, item.label]);
    expect(items.slice(0, 3)).toEqual([
      ['/department/home', 'Αρχική'],
      ['/department', 'Σετ εργαλείων'],
      ['/department/tools', 'Μεμονωμένα εργαλεία'],
    ]);
  });
});
