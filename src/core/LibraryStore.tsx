import {createContext, useContext, useMemo, useState, type ReactNode} from 'react';
import {getAdminRepository} from '../data/adminRepositories';
import type {SurgiDataMode} from '../data/repositories';
import type {LibraryItem} from './libraries';
import type {AdminUser, LibraryKey, LibraryState} from './libraryTypes';
import type {Permission} from './permissions';
import {defaultRolePermissions, sanitizeRolePermissions} from './permissions';
import type {UserRole} from '../store/types';
import type {SterilizationWorkflowConfig, WorkflowStageId} from './workflow';

export type {AdminUser, LibraryKey, LibraryState} from './libraryTypes';

type LibraryStore = LibraryState & {
  dataMode: SurgiDataMode;
  addItem: (key: LibraryKey, item: Omit<LibraryItem, 'id'>) => void;
  updateItem: (key: LibraryKey, id: string, item: Partial<LibraryItem>) => void;
  removeItem: (key: LibraryKey, id: string) => void;
  addUser: (user: Omit<AdminUser, 'id'>) => void;
  updateUser: (id: string, patch: Partial<AdminUser>) => void;
  removeUser: (id: string) => void;
  updateRolePermissions: (role: UserRole, permissions: Permission[], actor: string) => void;
  resetRolePermissions: (role: UserRole, actor: string) => void;
  updateSterilizationWorkflow: (patch: Partial<SterilizationWorkflowConfig>) => void;
  setWorkflowStageEnabled: (id: WorkflowStageId, enabled: boolean) => void;
  resetSterilizationWorkflow: () => void;
  updateSystemSettings: (patch: Partial<LibraryState['systemSettings']>) => void;
  resetData: () => void;
};
const Ctx = createContext<LibraryStore | null>(null);

const load = (repository: ReturnType<typeof getAdminRepository>): LibraryState => {
  const initial = repository.getInitialData();
  try {
    const raw = localStorage.getItem(repository.storageKey);
    if (raw) {
      const saved = JSON.parse(raw);
      return {
        ...initial,
        ...saved,
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
  const addItem = (key: LibraryKey, item: Omit<LibraryItem, 'id'>) =>
    commit(s => ({...s, [key]: [...s[key], {...item, id: `${key}-${Date.now()}`}]}));
  const updateItem = (key: LibraryKey, id: string, item: Partial<LibraryItem>) =>
    commit(s => ({...s, [key]: s[key].map(x => (x.id === id ? {...x, ...item} : x))}));
  const removeItem = (key: LibraryKey, id: string) => commit(s => ({...s, [key]: s[key].filter(x => x.id !== id)}));
  const addUser = (user: Omit<AdminUser, 'id'>) =>
    commit(s => ({...s, users: [...s.users, {...user, id: `user-${Date.now()}`}]}));
  const updateUser = (id: string, patch: Partial<AdminUser>) =>
    commit(s => ({...s, users: s.users.map(u => (u.id === id ? {...u, ...patch} : u))}));
  const removeUser = (id: string) => commit(s => ({...s, users: s.users.filter(u => u.id !== id)}));
  const updateRolePermissions = (role: UserRole, permissions: Permission[], actor: string) =>
    commit(s => {
      const safe = sanitizeRolePermissions(role, permissions);
      return {
        ...s,
        rolePermissions: {...s.rolePermissions, [role]: safe},
        rolePermissionAudit: [
          {id: `rpa-${Date.now()}`, role, at: new Date().toISOString(), by: actor, permissions: [...safe]},
          ...(s.rolePermissionAudit || []),
        ].slice(0, 100),
      };
    });
  const resetRolePermissions = (role: UserRole, actor: string) =>
    updateRolePermissions(role, [...defaultRolePermissions[role]], actor);
  const updateSterilizationWorkflow = (patch: Partial<SterilizationWorkflowConfig>) =>
    commit(s => ({
      ...s,
      sterilizationWorkflow: {...s.sterilizationWorkflow, ...patch, updatedAt: new Date().toISOString()},
    }));
  const setWorkflowStageEnabled = (id: WorkflowStageId, enabled: boolean) =>
    commit(s => ({
      ...s,
      sterilizationWorkflow: {
        ...s.sterilizationWorkflow,
        updatedAt: new Date().toISOString(),
        version: s.sterilizationWorkflow.version + 1,
        stages: s.sterilizationWorkflow.stages.map(stage =>
          stage.id === id && !stage.locked ? {...stage, enabled} : stage,
        ),
      },
    }));
  const resetSterilizationWorkflow = () =>
    commit(s => ({...s, sterilizationWorkflow: repository.getInitialData().sterilizationWorkflow}));
  const updateSystemSettings = (patch: Partial<LibraryState['systemSettings']>) =>
    commit(s => ({...s, systemSettings: {...s.systemSettings, ...patch}}));
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
