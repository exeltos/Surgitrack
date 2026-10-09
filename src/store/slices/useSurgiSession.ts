import {useCallback, useMemo, useState} from 'react';
import {getSurgiRepository, type SurgiDataMode} from '../../data/repositories';
import type {AssetState} from '../../types/domain';
import {getActiveDepartment, getDemoSessionUser, readStoredSessionUser, unknownSessionUser} from '../helpers';
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
  // The signed-in user is kept in state (not only in sessionStorage): App sets it after sign-in, and
  // setting the role alone would not re-render when the user's role equals the default one.
  const [sessionUser, setSessionUserState] = useState<SessionUser | undefined>(readStoredSessionUser);
  const setSessionUser = useCallback((user: SessionUser) => {
    setSessionUserState(user);
    setRole(user.role);
  }, []);
  const realUser = sessionUser?.role === role ? sessionUser : undefined;
  // Only Demo has stand-in people; outside it nobody is signed in until App has set the real user.
  const sessionReady = !!realUser || dataMode === 'DEMO';
  const currentUser = realUser ?? (dataMode === 'DEMO' ? getDemoSessionUser(role) : unknownSessionUser(role));
  const switchIdentity = (user: SessionUser) => {
    applyDemoSessionUser(user);
    setSessionUser(user);
  };
  const activeDepartment = getActiveDepartment(role, currentUser);
  const supervisor = !!currentUser.supervisor;
  // Without a known user nothing may be done (and so nothing stamped with an empty name).
  const permissions = sessionReady ? permissionsForRole(role, rolePermissions, supervisor) : [];
  const can = (permission: import('../../core/permissions').Permission) =>
    sessionReady && hasPermission(role, permission, rolePermissions, supervisor);
  return {
    activeDepartment,
    can,
    cloud,
    currentUser,
    enabledStages,
    initialData,
    nextStateAfter,
    permissions,
    reprocessState,
    role,
    sessionReady,
    sessionUser,
    setRole,
    setSessionUser,
    sterilizationWorkflow,
    switchIdentity,
    systemSettings,
  };
}
