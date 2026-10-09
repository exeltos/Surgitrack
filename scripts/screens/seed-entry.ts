/**
 * Bundled by capture.mjs with esbuild (never part of the app build). It reuses the app's own Demo sample
 * hospital (src/data/demo.ts through the demo repositories) so the mocked Supabase serves the same data
 * the Demo would, with dates moved to today.
 */
import {demoSurgiRepository} from '../../src/data/repositories/demoRepository';
import {demoAdminRepository} from '../../src/data/adminRepositories/demoRepository';
import {CLOUD_TABLES, tableToRow} from '../../src/data/cloud/cloudTables';
import {permissionsForRole, type Permission} from '../../src/core/permissions';
import {navigationFor} from '../../src/config/navigation';
import type {UserRole} from '../../src/store/types';

export function buildSeed(organizationId: string) {
  const store = demoSurgiRepository.getInitialData() as unknown as Record<string, Array<{id: string}>>;
  const library = {...demoAdminRepository.getInitialData(), id: 'state'} as unknown as {id: string};
  const collections: Record<string, Array<{id: string}>> = {
    sets: store.sets,
    tools: store.tools,
    movements: store.movements,
    issues: store.issues,
    processLoads: store.processLoads || [],
    receipts: store.receipts || [],
    deliveries: store.deliveries || [],
    purchaseOrders: store.purchaseOrders || [],
    preparations: store.preparations || [],
    sterilizationReleases: store.sterilizationReleases || [],
    counts: store.counts || [],
    library: [library],
  };
  const now = Date.now();
  const tables: Record<string, Array<Record<string, unknown>>> = {};
  for (const [collection, spec] of Object.entries(CLOUD_TABLES)) {
    const items = collections[collection] || [];
    tables[spec.table] = items.map((item, index) => {
      const stamp = new Date(now - index * 1000).toISOString();
      const row = tableToRow(
        organizationId,
        collection as keyof typeof CLOUD_TABLES,
        item as {id: string} & Record<string, unknown>,
        stamp,
      );
      row.updated_at = stamp;
      return row;
    });
  }
  // What each harness role may open: the hospital's role settings (from the seeded library) as the app
  // applies them, the Sterilization supervisor getting the supervisor-only permissions on top.
  const overrides = (library as unknown as {rolePermissions?: Partial<Record<UserRole, Permission[]>>}).rolePermissions;
  const harnessRoles: Array<[string, UserRole, boolean]> = [
    ['ADMIN', 'ADMIN', false],
    ['STERILIZATION', 'STERILIZATION', false],
    ['SUPERVISOR', 'STERILIZATION', true],
    ['DEPARTMENT', 'DEPARTMENT', false],
    ['VIEWER', 'VIEWER', false],
  ];
  const permissions = Object.fromEntries(
    harnessRoles.map(([name, role, supervisor]) => [name, permissionsForRole(role, overrides, supervisor)]),
  );
  const navigation = Object.fromEntries(
    harnessRoles.map(([name, role]) => {
      const allowed = new Set(permissions[name]);
      return [name, navigationFor(role, p => allowed.has(p)).map(item => item.to)];
    }),
  );
  return {
    tables,
    library,
    permissions,
    navigation,
    firstSetId: store.sets[0]?.id,
    firstToolId: store.tools[0]?.id,
  };
}
