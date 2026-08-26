import {describe, expect, it} from 'vitest';
import {
  defaultRolePermissions,
  hasPermission,
  permissionAvailableForRole,
  permissionKeys,
  permissionsForRole,
  protectedRolePermissions,
  roleHomePath,
  roleUnavailablePermissions,
  sanitizeRolePermissions,
  type Permission,
} from '../permissions';

describe('sanitizeRolePermissions', () => {
  it('always grants ADMIN every permission, regardless of what is passed in', () => {
    expect(sanitizeRolePermissions('ADMIN', [])).toEqual([...permissionKeys]);
    expect(sanitizeRolePermissions('ADMIN', ['asset.create'])).toEqual([...permissionKeys]);
  });

  it('never lets DEPARTMENT gain CSSD, studio, or asset-management permissions', () => {
    // Attempt to smuggle in every permission, as if a compromised or buggy client
    // sent an unrestricted payload to updateRolePermissions.
    const result = sanitizeRolePermissions('DEPARTMENT', [...permissionKeys]);
    const forbidden: Permission[] = [
      'asset.registry.view',
      'asset.create',
      'asset.edit',
      'asset.delete',
      'asset.duplicate',
      'asset.photos.manage',
      'asset.barcode.reissue',
      'asset.usage.configure',
      'stock.manage',
      'sterilization.workspace',
      'sterilization.receive',
      'sterilization.prepare',
      'sterilization.cycle',
      'sterilization.deliver',
      'reports.view',
      'traceability.view',
      'studio.manage',
    ];
    forbidden.forEach(permission => expect(result).not.toContain(permission));
  });

  it('never lets STERILIZATION gain department-workspace or studio permissions', () => {
    const result = sanitizeRolePermissions('STERILIZATION', [...permissionKeys]);
    expect(result).not.toContain('department.workspace');
    expect(result).not.toContain('department.dispatch');
    expect(result).not.toContain('studio.manage');
  });

  it("always keeps each role's protected chain-of-custody permissions, even if explicitly removed", () => {
    // Simulate someone trying to strip the core chain-of-custody permissions out of
    // STERILIZATION and DEPARTMENT by submitting an empty permission set.
    const sterilization = sanitizeRolePermissions('STERILIZATION', []);
    protectedRolePermissions.STERILIZATION.forEach(permission => expect(sterilization).toContain(permission));

    const department = sanitizeRolePermissions('DEPARTMENT', []);
    protectedRolePermissions.DEPARTMENT.forEach(permission => expect(department).toContain(permission));
  });

  it('drops permission keys that are not part of the known catalog', () => {
    const result = sanitizeRolePermissions('STERILIZATION', [
      'asset.registry.view',
      'not.a.real.permission' as Permission,
    ]);
    expect(result).toContain('asset.registry.view');
    expect(result).not.toContain('not.a.real.permission');
  });

  it('returns permissions in the canonical catalog order, not insertion order', () => {
    const result = sanitizeRolePermissions('STERILIZATION', ['reports.view', 'asset.registry.view']);
    const indexOfRegistry = result.indexOf('asset.registry.view');
    const indexOfReports = result.indexOf('reports.view');
    expect(indexOfRegistry).toBeGreaterThanOrEqual(0);
    expect(indexOfReports).toBeGreaterThan(indexOfRegistry);
  });
});

describe('permissionAvailableForRole / roleUnavailablePermissions', () => {
  it('agrees with sanitizeRolePermissions about what DEPARTMENT can never hold', () => {
    // These two mechanisms are independent (defense-in-depth) and must not drift apart:
    // the Studio UI hides+locks permissions using roleUnavailablePermissions, while
    // sanitizeRolePermissions is the actual enforcement. If they disagree, the UI could
    // show a permission as grantable that the sanitizer silently strips.
    roleUnavailablePermissions.DEPARTMENT.forEach(permission => {
      expect(permissionAvailableForRole('DEPARTMENT', permission)).toBe(false);
      const sanitized = sanitizeRolePermissions('DEPARTMENT', [...permissionKeys]);
      expect(sanitized).not.toContain(permission);
    });
  });

  it('agrees with sanitizeRolePermissions about what STERILIZATION can never hold', () => {
    roleUnavailablePermissions.STERILIZATION.forEach(permission => {
      expect(permissionAvailableForRole('STERILIZATION', permission)).toBe(false);
      const sanitized = sanitizeRolePermissions('STERILIZATION', [...permissionKeys]);
      expect(sanitized).not.toContain(permission);
    });
  });

  it('ADMIN has every permission available', () => {
    permissionKeys.forEach(permission => expect(permissionAvailableForRole('ADMIN', permission)).toBe(true));
  });
});

describe('hasPermission / permissionsForRole', () => {
  it('reflects the default role permissions when no overrides are given', () => {
    expect(hasPermission('STERILIZATION', 'sterilization.cycle')).toBe(true);
    expect(hasPermission('DEPARTMENT', 'sterilization.cycle')).toBe(false);
    expect(hasPermission('DEPARTMENT', 'department.dispatch')).toBe(true);
  });

  it('respects an admin-configured override, sanitized', () => {
    const overrides = {DEPARTMENT: ['department.workspace', 'issue.create'] as Permission[]};
    expect(hasPermission('DEPARTMENT', 'issue.create', overrides)).toBe(true);
    expect(hasPermission('DEPARTMENT', 'history.view', overrides)).toBe(true); // protected, re-added by sanitize
    expect(hasPermission('DEPARTMENT', 'asset.create', overrides)).toBe(false); // forbidden even via override
  });

  it('falls back to the default set for a role with no override entry', () => {
    const result = permissionsForRole('STERILIZATION', {});
    expect(result).toEqual(sanitizeRolePermissions('STERILIZATION', [...defaultRolePermissions.STERILIZATION]));
  });
});

describe('roleHomePath', () => {
  it('routes each role to its dedicated workspace', () => {
    expect(roleHomePath('STERILIZATION')).toBe('/sterilization');
    expect(roleHomePath('DEPARTMENT')).toBe('/department');
    expect(roleHomePath('ADMIN')).toBe('/studio');
  });
});
