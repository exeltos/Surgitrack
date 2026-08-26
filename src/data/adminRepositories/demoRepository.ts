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

const cloneItems = <T extends {id: string}>(items: readonly T[]): T[] => items.map(item => ({...item}));

const createDemoInitialData = (): LibraryState => ({
  departments: cloneItems(departments),
  specialties: cloneItems(specialties),
  manufacturers: cloneItems(manufacturers),
  suppliers: cloneItems(suppliers),
  toolCategories: cloneItems(toolCategories),
  sterilizers: cloneItems(sterilizers),
  users: demoUsers.map(user => ({...user, active: true})) as AdminUser[],
  rolePermissions: {
    ADMIN: [...defaultRolePermissions.ADMIN],
    STERILIZATION: [...defaultRolePermissions.STERILIZATION],
    DEPARTMENT: [...defaultRolePermissions.DEPARTMENT],
  },
  rolePermissionAudit: [],
  configurationAudit: [],
  workflowVersions: [{version: defaultSterilizationWorkflow.version, effectiveFrom: new Date().toISOString(), changedBy: 'System', reason: 'Initial workflow', config: {...defaultSterilizationWorkflow, stages: defaultSterilizationWorkflow.stages.map(stage => ({...stage}))}}],
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
