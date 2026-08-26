import type {UserRole} from '../store/types';
import type {LibraryItem} from './libraries';
import type {SterilizationWorkflowConfig, SterilizationWorkflowVersion} from './workflow';
import type {Permission} from './permissions';

export type Organization = {
  id: string;
  name: string;
  code: string;
  active: boolean;
  demoEnabled: boolean;
};
export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  active: boolean;
  organizationId: string;
  demoEnabled: boolean;
};
export type RolePermissionAudit = {id: string; role: UserRole; at: string; by: string; permissions: Permission[]};
export type SystemSettings = {usageWarningThreshold: number};
export type ConfigurationAuditEvent = {
  id: string;
  entityType: 'WORKFLOW' | 'SYSTEM_SETTING' | 'LIBRARY' | 'USER' | 'ORGANIZATION' | 'ROLE_PERMISSIONS';
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESET';
  at: string;
  by: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
};
export type LibraryKey =
  'departments' | 'specialties' | 'manufacturers' | 'suppliers' | 'toolCategories' | 'sterilizers';
export type LibraryState = {
  departments: LibraryItem[];
  specialties: LibraryItem[];
  manufacturers: LibraryItem[];
  suppliers: LibraryItem[];
  toolCategories: LibraryItem[];
  sterilizers: LibraryItem[];
  organizations: Organization[];
  users: AdminUser[];
  rolePermissions: Record<UserRole, Permission[]>;
  rolePermissionAudit: RolePermissionAudit[];
  configurationAudit: ConfigurationAuditEvent[];
  workflowVersions: SterilizationWorkflowVersion[];
  sterilizationWorkflow: SterilizationWorkflowConfig;
  systemSettings: SystemSettings;
};
