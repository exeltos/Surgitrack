import type {UserRole} from '../../../store/types';
import {
  defaultRolePermissions,
  permissionAvailableForRole,
  permissionCatalog,
  permissionKeys,
  protectedRolePermissions,
  isSupervisorOnly,
  type Permission,
  type PermissionGroup,
} from '../../../core/permissions';
import {permissionGroupMeta} from '../studioMeta';
import type {useStudioState} from './useStudioState';
import type {useStudioCloud} from './useStudioCloud';
import type {useStudioOrganizations} from './useStudioOrganizations';
import type {useStudioLibraries} from './useStudioLibraries';

export function useStudioRoles(
  p: ReturnType<typeof useStudioState> &
    ReturnType<typeof useStudioCloud> &
    ReturnType<typeof useStudioOrganizations> &
    ReturnType<typeof useStudioLibraries>,
) {
  const {currentUser, libs, roleDraft, selectedRole, setRoleDraft, setSelectedRole} = p;

  const currentRolePermissions = (libs.rolePermissions?.[selectedRole] ||
    defaultRolePermissions[selectedRole]) as readonly Permission[];
  const protectedPermissionSet = new Set<Permission>(protectedRolePermissions[selectedRole]);
  const roleDirty = permissionKeys.some(
    permission => roleDraft.includes(permission) !== currentRolePermissions.includes(permission),
  );
  const selectRole = (role: UserRole) => {
    setSelectedRole(role);
    setRoleDraft([...(libs.rolePermissions?.[role] || defaultRolePermissions[role])]);
  };
  // In Sterilization these follow who the hospital admin names supervisor, not the role settings.
  const supervisorOnlyFor = (permission: Permission) =>
    selectedRole === 'STERILIZATION' && isSupervisorOnly(permission);
  const toggleRolePermission = (permission: Permission) => {
    if (
      protectedPermissionSet.has(permission) ||
      supervisorOnlyFor(permission) ||
      !permissionAvailableForRole(selectedRole, permission)
    )
      return;
    setRoleDraft(current =>
      current.includes(permission) ? current.filter(p => p !== permission) : [...current, permission],
    );
  };
  const saveRolePermissions = () => {
    libs.updateRolePermissions(selectedRole, roleDraft, currentUser.name);
    setRoleDraft([...roleDraft]);
  };
  const resetSelectedRole = () => {
    libs.resetRolePermissions(selectedRole, currentUser.name);
    setRoleDraft([...defaultRolePermissions[selectedRole]]);
  };
  const visiblePermissionGroups = (Object.keys(permissionGroupMeta) as PermissionGroup[])
    .map(group => ({
      group,
      permissions: permissionCatalog.filter(
        item => item.group === group && permissionAvailableForRole(selectedRole, item.key),
      ),
    }))
    .filter(item => item.permissions.length > 0);
  return {
    protectedPermissionSet,
    resetSelectedRole,
    roleDirty,
    saveRolePermissions,
    selectRole,
    supervisorOnlyFor,
    toggleRolePermission,
    visiblePermissionGroups,
  };
}
