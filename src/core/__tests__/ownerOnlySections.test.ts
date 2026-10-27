import {describe, expect, it} from 'vitest';
import {isOwnerOnlyPath, isOwnerOnlyTab} from '../ownerOnlySections';
import {navigationFor, ownerNavigation} from '../../config/navigation';

describe('the Studio sections only the platform owner works in', () => {
  it('are the Sterilization flow, the roles & permissions and the settings', () => {
    for (const tab of ['workflow', 'ROLES', 'System']) expect(isOwnerOnlyTab(tab)).toBe(true);
    for (const tab of ['libraries', 'LIBRARIES', 'platform', 'users', '', null, undefined])
      expect(isOwnerOnlyTab(tab)).toBe(false);
  });

  it('are told apart in menu addresses', () => {
    expect(['/studio?tab=workflow', '/studio?tab=roles', '/studio?tab=system'].every(isOwnerOnlyPath)).toBe(true);
    expect(isOwnerOnlyPath('/studio?tab=libraries')).toBe(false);
    expect(isOwnerOnlyPath('/hospital')).toBe(false);
  });

  it('cover exactly those entries of the hospital admin menu and of the platform owner menu', () => {
    const adminMenu = navigationFor('ADMIN').filter(item => isOwnerOnlyPath(item.to));
    expect(adminMenu.map(item => item.label)).toEqual(['Ροή Αποστείρωσης', 'Ρόλοι & δικαιώματα', 'Ρυθμίσεις']);
    expect(ownerNavigation.filter(item => isOwnerOnlyPath(item.to))).toHaveLength(3);
  });
});
