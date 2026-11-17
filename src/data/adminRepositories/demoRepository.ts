import {departments, specialties, manufacturers, suppliers, toolCategories, demoUsers} from '../../core/libraries';
import type {AdminUser, LibraryState} from '../../core/libraryTypes';
import type {AdminRepository} from './types';
import {defaultSterilizationWorkflow} from '../../core/workflow';
import {defaultRolePermissions} from '../../core/permissions';

/** The sample hospital of the local Demo: a neutral name, never a real hospital's. */
export const DEMO_ORGANIZATION = {id: 'org-demo-main', name: 'SurgiTrack Demo', code: 'SURGITRACK-DEMO'};
/** Ids an earlier Demo stored in this browser for its sample hospital. */
export const LEGACY_DEMO_ORGANIZATION_IDS = ['org-iaso-thessalias'];
import {colorTapeCatalog} from '../../core/colorTapes';
import {demoSterilizers, demoWashers} from './demoEquipment';

const cloneItems = <T extends {id: string}>(items: readonly T[]): T[] => items.map(item => ({...item}));

const createDemoInitialData = (): LibraryState => ({
  departments: cloneItems(departments),
  specialties: cloneItems(specialties),
  manufacturers: cloneItems(manufacturers),
  suppliers: cloneItems(suppliers),
  toolCategories: cloneItems(toolCategories),
  sterilizers: demoSterilizers(),
  washers: demoWashers(),
  colorTapes: colorTapeCatalog.map(tape => ({...tape, colors: [...tape.colors]})),
  organizations: [
    {
      id: DEMO_ORGANIZATION.id,
      name: DEMO_ORGANIZATION.name,
      code: DEMO_ORGANIZATION.code,
      active: true,
      demoEnabled: true,
    },
    {id: 'org-demo-athens', name: 'Demo Hospital Athens', code: 'DEMO-ATH', active: true, demoEnabled: false},
    {id: 'org-demo-north', name: 'Demo Hospital North', code: 'DEMO-NORTH', active: true, demoEnabled: false},
  ],
  users: demoUsers.map(user => ({
    ...user,
    active: true,
    organizationId: DEMO_ORGANIZATION.id,
    demoEnabled: user.role === 'ADMIN',
  })) as AdminUser[],
  rolePermissions: {
    ADMIN: [...defaultRolePermissions.ADMIN],
    STERILIZATION: [...defaultRolePermissions.STERILIZATION],
    DEPARTMENT: [...defaultRolePermissions.DEPARTMENT],
    VIEWER: [...defaultRolePermissions.VIEWER],
  },
  rolePermissionAudit: [],
  configurationAudit: [],
  workflowVersions: [
    {
      id: 'wf-1-initial',
      version: 1,
      profileName: defaultSterilizationWorkflow.profileName,
      effectiveFrom: '',
      changedBy: 'System',
      changeReason: 'Initial workflow',
      snapshot: {
        ...defaultSterilizationWorkflow,
        stages: defaultSterilizationWorkflow.stages.map(stage => ({
          ...stage,
          checksEl: [...stage.checksEl],
          checksEn: [...stage.checksEn],
        })),
      },
    },
  ],
  systemSettings: {
    usageWarningThreshold: 3,
    sterileShelfLifeMonths: 6,
    // The wards that count the instruments when they send a Set (the Orthopaedic one did, and found one missing).
    surgicalCountDepartments: ['Ορθοπεδική Κλινική', 'Χειρουργείο'],
    hospitalDetails: {address: 'Οδός Δοκιμής 1, Λάρισα', phone: '2410 000000', contactName: 'Γραφείο Αποστείρωσης'},
  },
  sterilizationWorkflow: {
    ...defaultSterilizationWorkflow,
    // The ICU hands over without a signature: its electronic dispatch is enough (Settings → Sterilization).
    receiptPolicy: {...defaultSterilizationWorkflow.receiptPolicy, receiptExemptDepartments: ['ΜΕΘ']},
    stages: defaultSterilizationWorkflow.stages.map(stage => ({...stage})),
  },
});

export const demoAdminRepository: AdminRepository = {
  mode: 'DEMO',
  // v2: the fuller sample hospital (equipment with tests, a plasma sterilizer); an older saved Demo starts afresh.
  storageKey: 'surgitrack-admin-core-demo-v2',
  getInitialData: createDemoInitialData,
};
