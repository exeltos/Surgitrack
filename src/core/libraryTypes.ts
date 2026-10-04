import type {UserRole} from '../store/types';
import type {LibraryItem} from './libraries';
import type {SterilizationWorkflowConfig, SterilizationWorkflowVersion} from './workflow';
import type {Permission} from './permissions';
import type {ColorTape} from './colorTapes';

export type Organization = {
  id: string;
  name: string;
  code: string;
  active: boolean;
  demoEnabled: boolean;
  /** Standard use, or a trial that locks the hospital after trialEndsAt. */
  plan?: 'STANDARD' | 'TRIAL';
  trialEndsAt?: string;
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
  /** Sterilization supervisor (registers assets and changes Sets). */
  supervisor?: boolean;
};
export type RolePermissionAudit = {id: string; role: UserRole; at: string; by: string; permissions: Permission[]};
/** What the top of a barcode label shows. */
export type LabelHeader = 'BRAND' | 'LOGO' | 'TEXT' | 'NONE';
/** SMALL 50×25 mm, MEDIUM 70×35 mm, SHEET 100×50 mm (one large + two small labels). */
export type LabelSize = 'SMALL' | 'MEDIUM' | 'SHEET';
export type LabelSettings = {
  size: LabelSize;
  header: LabelHeader;
  /** Custom header text (e.g. the hospital's name). */
  text?: string;
  /** Hospital logo as a small image data URL. */
  logo?: string;
  /** Uses / tool count line. */
  showDetails: boolean;
};
export const DEFAULT_LABEL_SETTINGS: LabelSettings = {size: 'SMALL', header: 'BRAND', showDetails: true};
export type SystemSettings = {usageWarningThreshold: number; label?: LabelSettings};
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
  /** The hospital's color tape palette for instrument and Set markers. */
  colorTapes: ColorTape[];
  organizations: Organization[];
  users: AdminUser[];
  rolePermissions: Record<UserRole, Permission[]>;
  rolePermissionAudit: RolePermissionAudit[];
  configurationAudit: ConfigurationAuditEvent[];
  workflowVersions: SterilizationWorkflowVersion[];
  sterilizationWorkflow: SterilizationWorkflowConfig;
  systemSettings: SystemSettings;
};
