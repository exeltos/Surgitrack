import {createContext, useContext, useMemo, useState, type ReactNode} from 'react';
import {getAdminRepository} from '../data/adminRepositories';
import type {SurgiDataMode} from '../data/repositories';
import type {LibraryItem} from './libraries';
import type {AdminUser, ConfigurationAuditEvent, LibraryKey, LibraryState, Organization} from './libraryTypes';
import type {Permission} from './permissions';
import {defaultRolePermissions, sanitizeRolePermissions} from './permissions';
import type {UserRole} from '../store/types';
import type {SterilizationWorkflowConfig, WorkflowStageId} from './workflow';

export type {AdminUser, LibraryKey, LibraryState, Organization} from './libraryTypes';

type LibraryStore = LibraryState & {
  dataMode: SurgiDataMode;
  addItem: (key: LibraryKey, item: Omit<LibraryItem, 'id'>) => void;
  updateItem: (key: LibraryKey, id: string, item: Partial<LibraryItem>) => void;
  removeItem: (key: LibraryKey, id: string) => void;
  addOrganization: (organization: Omit<Organization, 'id'>) => void;
  updateOrganization: (id: string, patch: Partial<Organization>) => void;
  removeOrganization: (id: string) => void;
  addUser: (user: Omit<AdminUser, 'id'>) => void;
  updateUser: (id: string, patch: Partial<AdminUser>) => void;
  removeUser: (id: string) => void;
  updateRolePermissions: (role: UserRole, permissions: Permission[], actor: string) => void;
  resetRolePermissions: (role: UserRole, actor: string) => void;
  updateSterilizationWorkflow: (patch: Partial<SterilizationWorkflowConfig>, actor?: string, reason?: string) => void;
  setWorkflowStageEnabled: (id: WorkflowStageId, enabled: boolean, actor?: string, reason?: string) => void;
  resetSterilizationWorkflow: (actor?: string, reason?: string) => void;
  updateSystemSettings: (patch: Partial<LibraryState['systemSettings']>, actor?: string, reason?: string) => void;
  resetData: () => void;
};
const Ctx = createContext<LibraryStore | null>(null);

const load = (repository: ReturnType<typeof getAdminRepository>): LibraryState => {
  const initial = repository.getInitialData();
  try {
    const raw = localStorage.getItem(repository.storageKey);
    if (raw) {
      const saved = JSON.parse(raw);
      const organizations = Array.isArray(saved.organizations) ? saved.organizations : initial.organizations;
      const defaultOrganizationId = organizations[0]?.id || '';
      return {
        ...initial,
        ...saved,
        organizations,
        users: (saved.users || initial.users).map((user: AdminUser) => ({
          ...user,
          organizationId: user.organizationId || defaultOrganizationId,
          demoEnabled: user.demoEnabled ?? user.role === 'ADMIN',
        })),
        systemSettings: {...initial.systemSettings, ...(saved.systemSettings || {})},
      } as LibraryState;
    }
    for (const legacyKey of repository.legacyStorageKeys || []) {
      const legacyRaw = localStorage.getItem(legacyKey);
      if (!legacyRaw) continue;
      const migrated = {...initial, ...JSON.parse(legacyRaw)} as LibraryState;
      localStorage.setItem(repository.storageKey, JSON.stringify(migrated));
      return migrated;
    }
  } catch {
    // Corrupt/unreadable localStorage payload: fall through to a clean initial state
    // instead of crashing the app on load.
  }
  return initial;
};

export function LibraryStoreProvider({children, dataMode = 'DEMO'}: {children: ReactNode; dataMode?: SurgiDataMode}) {
  const repository = useMemo(() => getAdminRepository(dataMode), [dataMode]);
  const [state, setState] = useState<LibraryState>(() => load(repository));
  const commit = (fn: (s: LibraryState) => LibraryState) =>
    setState(s => {
      const next = fn(s);
      localStorage.setItem(repository.storageKey, JSON.stringify(next));
      return next;
    });
  const actorName = (actor?: string) => actor?.trim() || 'Admin';
  const appendAudit = (s: LibraryState, event: Omit<ConfigurationAuditEvent, 'id' | 'at'>): LibraryState => ({
    ...s,
    configurationAudit: [
      {id: `cfg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString(), ...event},
      ...(s.configurationAudit || []),
    ].slice(0, 500),
  });
  const snapshotWorkflow = (workflow: SterilizationWorkflowConfig) => ({
    ...workflow,
    receiptPolicy: {...workflow.receiptPolicy},
    releasePolicy: {...workflow.releasePolicy},
    stages: workflow.stages.map(stage => ({...stage, checksEl: [...stage.checksEl], checksEn: [...stage.checksEn]})),
  });
  const commitWorkflow = (s: LibraryState, next: SterilizationWorkflowConfig, actor?: string, reason?: string) => {
    const by = actorName(actor);
    const at = new Date().toISOString();
    const normalized = {...next, updatedAt: at, updatedBy: by};
    const versionEntry = {
      id: `wf-${normalized.version}-${Date.now()}`,
      version: normalized.version,
      profileName: normalized.profileName,
      effectiveFrom: at,
      changedBy: by,
      changeReason: reason,
      snapshot: snapshotWorkflow(normalized),
    };
    return appendAudit(
      {...s, sterilizationWorkflow: normalized, workflowVersions: [versionEntry, ...(s.workflowVersions || [])].slice(0, 100)},
      {entityType: 'WORKFLOW', entityId: normalized.profileName, action: 'UPDATE', by, before: snapshotWorkflow(s.sterilizationWorkflow), after: snapshotWorkflow(normalized), reason},
    );
  };
  const addItem = (key: LibraryKey, item: Omit<LibraryItem, 'id'>) => commit(s => {
    const created = {...item, id: `${key}-${Date.now()}`};
    return appendAudit({...s, [key]: [...s[key], created]}, {entityType: 'LIBRARY', entityId: `${key}:${created.id}`, action: 'CREATE', by: 'Admin', after: created});
  });
  const updateItem = (key: LibraryKey, id: string, item: Partial<LibraryItem>) => commit(s => {
    const before = s[key].find(x => x.id === id);
    const after = before ? {...before, ...item} : undefined;
    return appendAudit({...s, [key]: s[key].map(x => (x.id === id ? {...x, ...item} : x))}, {entityType: 'LIBRARY', entityId: `${key}:${id}`, action: 'UPDATE', by: 'Admin', before, after});
  });
  const removeItem = (key: LibraryKey, id: string) => commit(s => {
    const before = s[key].find(x => x.id === id);
    return appendAudit({...s, [key]: s[key].filter(x => x.id !== id)}, {entityType: 'LIBRARY', entityId: `${key}:${id}`, action: 'DELETE', by: 'Admin', before});
  });
  const addOrganization = (organization: Omit<Organization, 'id'>) => commit(s => {
    const created = {...organization, id: `org-${Date.now()}`};
    return appendAudit({...s, organizations: [...s.organizations, created]}, {entityType: 'ORGANIZATION', entityId: created.id, action: 'CREATE', by: 'Admin', after: created});
  });
  const updateOrganization = (id: string, patch: Partial<Organization>) => commit(s => {
    const before = s.organizations.find(org => org.id === id);
    const after = before ? {...before, ...patch} : undefined;
    return appendAudit({...s, organizations: s.organizations.map(org => (org.id === id ? {...org, ...patch} : org))}, {entityType: 'ORGANIZATION', entityId: id, action: 'UPDATE', by: 'Admin', before, after});
  });
  const removeOrganization = (id: string) => commit(s => {
    const before = s.organizations.find(org => org.id === id);
    const usersForOrganization = s.users.filter(user => user.organizationId === id);
    if (usersForOrganization.length) return s;
    return appendAudit({...s, organizations: s.organizations.filter(org => org.id !== id)}, {entityType: 'ORGANIZATION', entityId: id, action: 'DELETE', by: 'Admin', before});
  });
  const addUser = (user: Omit<AdminUser, 'id'>) => commit(s => {
    const created = {...user, id: `user-${Date.now()}`};
    return appendAudit({...s, users: [...s.users, created]}, {entityType: 'USER', entityId: created.id, action: 'CREATE', by: 'Admin', after: created});
  });
  const updateUser = (id: string, patch: Partial<AdminUser>) => commit(s => {
    const before = s.users.find(u => u.id === id);
    const after = before ? {...before, ...patch} : undefined;
    return appendAudit({...s, users: s.users.map(u => (u.id === id ? {...u, ...patch} : u))}, {entityType: 'USER', entityId: id, action: 'UPDATE', by: 'Admin', before, after});
  });
  const removeUser = (id: string) => commit(s => {
    const before = s.users.find(u => u.id === id);
    return appendAudit({...s, users: s.users.filter(u => u.id !== id)}, {entityType: 'USER', entityId: id, action: 'DELETE', by: 'Admin', before});
  });
  const updateRolePermissions = (role: UserRole, permissions: Permission[], actor: string) =>
    commit(s => {
      const safe = sanitizeRolePermissions(role, permissions);
      return appendAudit({
        ...s,
        rolePermissions: {...s.rolePermissions, [role]: safe},
        rolePermissionAudit: [
          {id: `rpa-${Date.now()}`, role, at: new Date().toISOString(), by: actor, permissions: [...safe]},
          ...(s.rolePermissionAudit || []),
        ].slice(0, 100),
      }, {entityType: 'ROLE_PERMISSIONS', entityId: role, action: 'UPDATE', by: actor, before: s.rolePermissions[role], after: [...safe]});
    });
  const resetRolePermissions = (role: UserRole, actor: string) =>
    updateRolePermissions(role, [...defaultRolePermissions[role]], actor);
  const updateSterilizationWorkflow = (patch: Partial<SterilizationWorkflowConfig>, actor?: string, reason?: string) =>
    commit(s => commitWorkflow(s, {...s.sterilizationWorkflow, ...patch, version: s.sterilizationWorkflow.version + 1}, actor, reason));
  const setWorkflowStageEnabled = (id: WorkflowStageId, enabled: boolean, actor?: string, reason?: string) =>
    commit(s => {
      const current = s.sterilizationWorkflow.stages.find(stage => stage.id === id);
      if (!current || current.locked || current.enabled === enabled) return s;
      const next = {
        ...s.sterilizationWorkflow,
        version: s.sterilizationWorkflow.version + 1,
        stages: s.sterilizationWorkflow.stages.map(stage => stage.id === id ? {...stage, enabled} : stage),
      };
      return commitWorkflow(s, next, actor, reason || `${current.labelEl}: ${enabled ? 'ενεργοποίηση' : 'απενεργοποίηση'}`);
    });
  const resetSterilizationWorkflow = (actor?: string, reason?: string) =>
    commit(s => {
      const base = repository.getInitialData().sterilizationWorkflow;
      return commitWorkflow(s, {...base, version: s.sterilizationWorkflow.version + 1}, actor, reason || 'Επαναφορά προεπιλεγμένης ροής');
    });
  const updateSystemSettings = (patch: Partial<LibraryState['systemSettings']>, actor?: string, reason?: string) =>
    commit(s => {
      const after = {...s.systemSettings, ...patch};
      return appendAudit({...s, systemSettings: after}, {entityType: 'SYSTEM_SETTING', entityId: 'systemSettings', action: 'UPDATE', by: actorName(actor), before: s.systemSettings, after, reason});
    });
  const resetData = () => {
    localStorage.removeItem(repository.storageKey);
    setState(repository.getInitialData());
  };
  const value = useMemo(
    () => ({
      ...state,
      dataMode,
      addItem,
      updateItem,
      addOrganization,
      updateOrganization,
      removeOrganization,
      removeItem,
      addUser,
      updateUser,
      removeUser,
      updateRolePermissions,
      resetRolePermissions,
      updateSterilizationWorkflow,
      setWorkflowStageEnabled,
      resetSterilizationWorkflow,
      updateSystemSettings,
      resetData,
    }),
    [state, dataMode, repository],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useLibraries() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLibraries must be used inside LibraryStoreProvider');
  return v;
}
