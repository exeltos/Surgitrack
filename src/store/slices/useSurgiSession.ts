import {useMemo, useState} from 'react';
import {getSurgiRepository, type SurgiDataMode} from '../../data/repositories';
import type {AssetState} from '../../types/domain';
import {getActiveDepartment, getDemoSessionUser} from '../helpers';
import {hasPermission, permissionsForRole} from '../../core/permissions';
import type {SurgiInitialData} from '../../data/repositories';
import type {CloudWorkspace} from '../../data/cloud/CloudWorkspaceGate';
import {applyDemoSessionUser} from '../../config/demoRoles';
import type {SessionUser, UserRole} from '../types';
import {useLibraries} from '../../core/LibraryStore';
import {
  nextStateAfter as nextStateAfterStage,
  reprocessState as reprocessStateForStages,
  type WorkflowStageId,
} from '../../core/workflow';

export function useSurgiSession(args: {dataMode: SurgiDataMode; cloud?: CloudWorkspace | null}) {
  const {dataMode, cloud} = args;

  const repository = useMemo(() => getSurgiRepository(dataMode), [dataMode]);
  const {sterilizationWorkflow, rolePermissions, systemSettings} = useLibraries();
  const enabledStages = sterilizationWorkflow.stages.filter(stage => stage.enabled);
  const nextStateAfter = (stageId: WorkflowStageId): AssetState =>
    nextStateAfterStage(sterilizationWorkflow.stages, stageId) as AssetState;
  const reprocessState = (): AssetState => reprocessStateForStages(sterilizationWorkflow.stages) as AssetState;
  // With a cloud workspace every collection starts from what is stored for the organization.
  const [initialData] = useState(() =>
    cloud ? (cloud.records as unknown as SurgiInitialData) : repository.getInitialData(),
  );
  const [role, setRole] = useState<UserRole>(
    () => (sessionStorage.getItem('surgitrack-demo-role') as UserRole) || 'STERILIZATION',
  );
  // Bumped when the demo identity changes without a role change (one department to another).
  const [identityVersion, setIdentityVersion] = useState(0);
  const currentUser = getDemoSessionUser(role);
  const switchIdentity = (user: SessionUser) => {
    applyDemoSessionUser(user);
    setRole(user.role);
    setIdentityVersion(v => v + 1);
  };
  const activeDepartment = getActiveDepartment(role, currentUser);
  const supervisor = !!currentUser.supervisor;
  const permissions = permissionsForRole(role, rolePermissions, supervisor);
  const can = (permission: import('../../core/permissions').Permission) =>
    hasPermission(role, permission, rolePermissions, supervisor);
  return {
    activeDepartment,
    can,
    cloud,
    currentUser,
    enabledStages,
    identityVersion,
    initialData,
    nextStateAfter,
    permissions,
    reprocessState,
    role,
    setRole,
    sterilizationWorkflow,
    switchIdentity,
    systemSettings,
  };
}
