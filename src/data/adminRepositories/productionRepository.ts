import type {AdminRepository} from './types';
import {defaultSterilizationWorkflow} from '../../core/workflow';
import {defaultRolePermissions} from '../../core/permissions';

export const productionAdminRepository: AdminRepository = {
  mode: 'PRODUCTION',
  storageKey: 'surgitrack-admin-core-production-v1',
  getInitialData: () => ({
    departments: [],
    specialties: [],
    manufacturers: [],
    suppliers: [],
    toolCategories: [],
    sterilizers: [],
    users: [],
    rolePermissions: {
      ADMIN: [...defaultRolePermissions.ADMIN],
      STERILIZATION: [...defaultRolePermissions.STERILIZATION],
      DEPARTMENT: [...defaultRolePermissions.DEPARTMENT],
    },
    rolePermissionAudit: [],
    systemSettings: {usageWarningThreshold: 3},
    sterilizationWorkflow: {
      ...defaultSterilizationWorkflow,
      stages: defaultSterilizationWorkflow.stages.map(stage => ({...stage})),
    },
  }),
};
