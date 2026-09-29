import {
  departments,
  specialties,
  manufacturers,
  suppliers,
  toolCategories,
  sterilizers,
  demoUsers,
} from '../../core/libraries';
import type {AdminUser, LibraryState} from '../../core/libraryTypes';
import type {AdminRepository} from './types';
import {defaultSterilizationWorkflow} from '../../core/workflow';
import {defaultRolePermissions} from '../../core/permissions';
import {colorTapeCatalog} from '../../core/colorTapes';

const cloneItems = <T extends {id: string}>(items: readonly T[]): T[] => items.map(item => ({...item}));

const createDemoInitialData = (): LibraryState => ({
  departments: cloneItems(departments),
  specialties: cloneItems(specialties),
  manufacturers: cloneItems(manufacturers),
  suppliers: cloneItems(suppliers),
  toolCategories: cloneItems(toolCategories),
  sterilizers: cloneItems(sterilizers),
  colorTapes: colorTapeCatalog.map(tape => ({...tape, colors: [...tape.colors]})),
  organizations: [
    {id: 'org-iaso-thessalias', name: 'ΙΑΣΩ Θεσσαλίας', code: 'IASO-TH', active: true, demoEnabled: true},
    {id: 'org-demo-athens', name: 'Demo Hospital Athens', code: 'DEMO-ATH', active: true, demoEnabled: false},
    {id: 'org-demo-north', name: 'Demo Hospital North', code: 'DEMO-NORTH', active: true, demoEnabled: false},
  ],
  users: demoUsers.map((user, index) => ({
    ...user,
    active: true,
    organizationId: index === 0 ? 'org-iaso-thessalias' : 'org-iaso-thessalias',
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
  systemSettings: {usageWarningThreshold: 3},
  sterilizationWorkflow: {
    ...defaultSterilizationWorkflow,
    stages: defaultSterilizationWorkflow.stages.map(stage => ({...stage})),
  },
});

export const demoAdminRepository: AdminRepository = {
  mode: 'DEMO',
  storageKey: 'surgitrack-admin-core-demo-v1',
  legacyStorageKeys: ['surgitrack-admin-core-v1'],
  getInitialData: createDemoInitialData,
};
