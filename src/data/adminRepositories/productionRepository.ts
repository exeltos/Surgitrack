import type {AdminRepository} from './types';
import type {LibraryState} from '../../core/libraryTypes';
import {defaultSterilizationWorkflow} from '../../core/workflow';
import {defaultRolePermissions} from '../../core/permissions';

export const productionAdminRepository: AdminRepository = {
  mode: 'PRODUCTION',
  storageKey: 'surgitrack-admin-core-production-v1',
  getInitialData: (): LibraryState => ({
    departments: [],
    specialties: [],
    manufacturers: [],
    suppliers: [],
    toolCategories: [],
    sterilizers: [],
    organizations: [],
    users: [
      {
        id: 'platform-admin',
        name: 'Platform Admin',
        email: 'admin@surgitrack.demo',
        role: 'ADMIN',
        department: 'Platform',
        active: true,
        organizationId: '',
        demoEnabled: false,
      },
    ],
    rolePermissions: {
      ADMIN: [...defaultRolePermissions.ADMIN],
      STERILIZATION: [...defaultRolePermissions.STERILIZATION],
      DEPARTMENT: [...defaultRolePermissions.DEPARTMENT],
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
  }),
};
