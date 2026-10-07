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
  /** The Set's or instrument's code above its name ("cod. 041993"). */
  showCode?: boolean;
  /** Paper size in mm when it differs from the size's own (e.g. the printer's label roll). */
  width?: number;
  height?: number;
  /** Space kept empty on the right of each label (mm), e.g. for a pre-printed indicator strip. */
  reserveRight?: number;
  /** 1 + 2 layout: the large label's share of the height, in percent. */
  mainShare?: number;
};
export const DEFAULT_LABEL_SETTINGS: LabelSettings = {size: 'SMALL', header: 'BRAND', showDetails: true};
export type SystemSettings = {
  usageWarningThreshold: number;
  label?: LabelSettings;
  /** The least the hospital wants in Stock of each instrument kind (key: see kindKey in core/replacements). */
  stockMinimums?: Record<string, number>;
  /** How new sterilizers are named (base name and A, B, C… or 1, 2, 3…). */
  sterilizerNaming?: import('./sterilizerNaming').SterilizerNaming;
};
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
