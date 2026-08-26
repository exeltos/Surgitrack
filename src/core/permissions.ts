import type {UserRole} from '../store/types';

export const permissionKeys = [
  'asset.registry.view',
  'asset.detail.view',
  'asset.create',
  'asset.edit',
  'asset.delete',
  'asset.duplicate',
  'asset.photos.manage',
  'asset.barcode.reissue',
  'asset.usage.configure',
  'stock.manage',
  'department.workspace',
  'department.dispatch',
  'sterilization.workspace',
  'sterilization.receive',
  'sterilization.prepare',
  'sterilization.cycle',
  'sterilization.deliver',
  'issue.view',
  'issue.create',
  'history.view',
  'reports.view',
  'traceability.view',
  'counts.record',
  'studio.manage',
] as const;

export type Permission = (typeof permissionKeys)[number];

export type PermissionGroup = 'ASSETS' | 'WORKFLOW' | 'TRACEABILITY' | 'ADMIN';
export type PermissionDescriptor = {
  key: Permission;
  group: PermissionGroup;
  el: string;
  en: string;
  hintEl: string;
  hintEn: string;
};

export const permissionCatalog: readonly PermissionDescriptor[] = [
  {
    key: 'asset.registry.view',
    group: 'ASSETS',
    el: 'Προβολή μητρώου assets',
    en: 'View asset registry',
    hintEl: 'Λίστες εργαλείων, Σετ και βασικά φίλτρα.',
    hintEn: 'Instrument and Set lists with core filters.',
  },
  {
    key: 'asset.detail.view',
    group: 'ASSETS',
    el: 'Προβολή καρτέλας asset',
    en: 'View asset details',
    hintEl: 'Άνοιγμα πλήρους καρτέλας Σετ ή εργαλείου.',
    hintEn: 'Open full Set or instrument card.',
  },
  {
    key: 'asset.create',
    group: 'ASSETS',
    el: 'Δημιουργία assets',
    en: 'Create assets',
    hintEl: 'Νέα Σετ και εργαλεία.',
    hintEn: 'Create new Sets and instruments.',
  },
  {
    key: 'asset.edit',
    group: 'ASSETS',
    el: 'Επεξεργασία στοιχείων',
    en: 'Edit asset data',
    hintEl: 'Αλλαγή επιτρεπόμενων βασικών στοιχείων.',
    hintEn: 'Edit allowed core asset fields.',
  },
  {
    key: 'asset.delete',
    group: 'ASSETS',
    el: 'Διαγραφή assets',
    en: 'Delete assets',
    hintEl: 'Οριστική διαγραφή με επιβεβαίωση.',
    hintEn: 'Permanent deletion with confirmation.',
  },
  {
    key: 'asset.duplicate',
    group: 'ASSETS',
    el: 'Διπλασιασμός assets',
    en: 'Duplicate assets',
    hintEl: 'Δημιουργία νέου φυσικού asset από υπάρχον.',
    hintEn: 'Create a new physical asset from an existing one.',
  },
  {
    key: 'asset.photos.manage',
    group: 'ASSETS',
    el: 'Διαχείριση φωτογραφιών',
    en: 'Manage photos',
    hintEl: 'Λήψη, upload και διαχείριση φωτογραφιών.',
    hintEn: 'Capture, upload and manage photos.',
  },
  {
    key: 'asset.barcode.reissue',
    group: 'ASSETS',
    el: 'Επανέκδοση barcode',
    en: 'Reissue barcode',
    hintEl: 'Εκτύπωση / επανέκδοση ετικέτας barcode.',
    hintEn: 'Print or reissue barcode label.',
  },
  {
    key: 'asset.usage.configure',
    group: 'ASSETS',
    el: 'Ρύθμιση ορίου χρήσεων',
    en: 'Configure usage limit',
    hintEl: 'Ορισμός ή μεταβολή περιορισμένων χρήσεων.',
    hintEn: 'Set or change limited-use thresholds.',
  },
  {
    key: 'stock.manage',
    group: 'ASSETS',
    el: 'Διαχείριση Stock',
    en: 'Manage stock',
    hintEl: 'Μετακινήσεις και διαθέσιμα εργαλεία Stock.',
    hintEn: 'Stock availability and movements.',
  },
  {
    key: 'department.workspace',
    group: 'WORKFLOW',
    el: 'Χώρος εργασίας Τμήματος',
    en: 'Department workspace',
    hintEl: 'Πρόσβαση στο ειδικό workspace του Τμήματος.',
    hintEn: 'Access the Department workspace.',
  },
  {
    key: 'department.dispatch',
    group: 'WORKFLOW',
    el: 'Αποστολή προς Αποστείρωση',
    en: 'Dispatch to Sterilization',
    hintEl: 'Ηλεκτρονική προώθηση με chain of custody.',
    hintEn: 'Electronic dispatch with chain of custody.',
  },
  {
    key: 'sterilization.workspace',
    group: 'WORKFLOW',
    el: 'Χώρος Αποστείρωσης',
    en: 'Sterilization workspace',
    hintEl: 'Πρόσβαση στη βασική ροή CSSD.',
    hintEn: 'Access the core CSSD workflow.',
  },
  {
    key: 'sterilization.receive',
    group: 'WORKFLOW',
    el: 'Φυσική παραλαβή',
    en: 'Physical receipt',
    hintEl: 'Παραλαβή από Τμήμα και ταυτοποίηση παραδίδοντα.',
    hintEn: 'Department receipt and handover verification.',
  },
  {
    key: 'sterilization.prepare',
    group: 'WORKFLOW',
    el: 'Έλεγχος & Σύνθεση',
    en: 'Inspection & Assembly',
    hintEl: 'Έλεγχος, αποκλίσεις, αντικαταστάσεις και σύνθεση.',
    hintEn: 'Inspection, deviations, replacement and assembly.',
  },
  {
    key: 'sterilization.cycle',
    group: 'WORKFLOW',
    el: 'Καταγραφή κύκλου',
    en: 'Record sterilization cycle',
    hintEl: 'Κλίβανος, κύκλος, δείκτες και αποδέσμευση.',
    hintEn: 'Sterilizer, cycle, indicators and release.',
  },
  {
    key: 'sterilization.deliver',
    group: 'WORKFLOW',
    el: 'Παράδοση προς Τμήμα',
    en: 'Deliver to Department',
    hintEl: 'Τελική παράδοση και κλείσιμο chain of custody.',
    hintEn: 'Final delivery and chain-of-custody closure.',
  },
  {
    key: 'issue.view',
    group: 'TRACEABILITY',
    el: 'Προβολή εκκρεμοτήτων',
    en: 'View issues',
    hintEl: 'Προβολή αναφορών και ανοικτών αποκλίσεων.',
    hintEn: 'View reports and open deviations.',
  },
  {
    key: 'issue.create',
    group: 'TRACEABILITY',
    el: 'Δημιουργία αναφοράς',
    en: 'Create issue report',
    hintEl: 'Αναφορά βλάβης, απώλειας ή άλλης απόκλισης.',
    hintEn: 'Report damage, loss or other deviation.',
  },
  {
    key: 'history.view',
    group: 'TRACEABILITY',
    el: 'Προβολή ιστορικού',
    en: 'View history',
    hintEl: 'Ιστορικό κινήσεων και ενεργειών.',
    hintEn: 'Movement and action history.',
  },
  {
    key: 'reports.view',
    group: 'TRACEABILITY',
    el: 'Αναφορές & στατιστικά',
    en: 'Reports & analytics',
    hintEl: 'Πρόσβαση σε συγκεντρωτικές αναφορές.',
    hintEn: 'Access consolidated reports.',
  },
  {
    key: 'traceability.view',
    group: 'TRACEABILITY',
    el: 'Πλήρης ιχνηλασιμότητα',
    en: 'Full traceability',
    hintEl: 'Chain of custody και ιστορικό φυσικού asset.',
    hintEn: 'Chain of custody and physical asset traceability.',
  },
  {
    key: 'counts.record',
    group: 'TRACEABILITY',
    el: 'Καταμέτρηση / χειρουργική χρήση',
    en: 'Record counts',
    hintEl: 'Καταγραφή χρήσης και καταμέτρησης όπου εφαρμόζεται.',
    hintEn: 'Usage/count recording where applicable.',
  },
  {
    key: 'studio.manage',
    group: 'ADMIN',
    el: 'SurgiTrack Studio',
    en: 'SurgiTrack Studio',
    hintEl: 'Βιβλιοθήκες, χρήστες, ρόλοι και ρυθμίσεις.',
    hintEn: 'Libraries, users, roles and settings.',
  },
];

const departmentPermissions: readonly Permission[] = [
  'asset.detail.view',
  'department.workspace',
  'department.dispatch',
  'issue.view',
  'issue.create',
  'history.view',
  'counts.record',
];

const sterilizationPermissions: readonly Permission[] = [
  'asset.registry.view',
  'asset.detail.view',
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
  'issue.view',
  'issue.create',
  'history.view',
  'reports.view',
  'traceability.view',
  'counts.record',
];

export const defaultRolePermissions: Record<UserRole, readonly Permission[]> = {
  DEPARTMENT: departmentPermissions,
  STERILIZATION: sterilizationPermissions,
  ADMIN: permissionKeys,
};

// These permissions protect tenant isolation and the minimum chain-of-custody path.
export const protectedRolePermissions: Record<UserRole, readonly Permission[]> = {
  ADMIN: permissionKeys,
  STERILIZATION: [
    'asset.detail.view',
    'sterilization.workspace',
    'sterilization.receive',
    'sterilization.cycle',
    'sterilization.deliver',
    'history.view',
    'traceability.view',
  ],
  DEPARTMENT: ['asset.detail.view', 'department.workspace', 'department.dispatch', 'issue.create', 'history.view'],
};

export const rolePermissions = defaultRolePermissions;
export const roleUnavailablePermissions: Record<UserRole, readonly Permission[]> = {
  ADMIN: [],
  STERILIZATION: ['department.workspace', 'department.dispatch', 'studio.manage'],
  DEPARTMENT: [
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
  ],
};
export const permissionAvailableForRole = (role: UserRole, permission: Permission) =>
  !roleUnavailablePermissions[role].includes(permission);

const sanitize = (role: UserRole, permissions: readonly Permission[]) => {
  if (role === 'ADMIN') return [...permissionKeys] as Permission[];
  const allowed = new Set<Permission>(permissions.filter((p): p is Permission => permissionKeys.includes(p)));
  protectedRolePermissions[role].forEach(p => allowed.add(p));
  // Department role can never be elevated into administrative/CSSD management.
  if (role === 'DEPARTMENT') {
    const denied: Permission[] = [
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
    denied.forEach(p => allowed.delete(p));
  }
  if (role === 'STERILIZATION') {
    (['department.workspace', 'department.dispatch', 'studio.manage'] as Permission[]).forEach(p => allowed.delete(p));
  }
  return permissionKeys.filter(p => allowed.has(p));
};

export const sanitizeRolePermissions = sanitize;
export const permissionsForRole = (role: UserRole, overrides?: Partial<Record<UserRole, readonly Permission[]>>) =>
  sanitize(role, overrides?.[role] || defaultRolePermissions[role]);
export const hasPermission = (
  role: UserRole,
  permission: Permission,
  overrides?: Partial<Record<UserRole, readonly Permission[]>>,
) => permissionsForRole(role, overrides).includes(permission);

export const roleHomePath = (role: UserRole) =>
  role === 'STERILIZATION' ? '/sterilization' : role === 'DEPARTMENT' ? '/department' : '/studio';
