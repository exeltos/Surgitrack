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

type Item = {id: string} & Record<string, unknown>;

/**
 * SCREENS_SCALE=n: the sample hospital n times over (each Set with its instruments, standalone and Stock
 * instruments, their movements and issues), with new ids and barcodes, to see the app at a large hospital's
 * size (n = 40 gives ~13,000 instruments).
 */
function scaled(store: Record<string, Item[]>, n: number) {
  if (n <= 1) return store;
  const bump = (code: unknown, k: number) =>
    typeof code === 'string' && /^[ST]\d{6}$/.test(code)
      ? `${code[0]}${String(Number(code.slice(1)) + k * 20000).padStart(6, '0')}`
      : code;
  const copy = (items: Item[], k: number, fix: (x: Item) => Item) =>
    items.map(x => fix({...x, id: k ? `${x.id}~${k}` : x.id}));
  const out = {...store};
  out.sets = [];
  out.tools = [];
  out.movements = [];
  out.issues = [];
  for (let k = 0; k < n; k++) {
    out.sets.push(...copy(store.sets, k, x => ({...x, barcode: bump(x.barcode, k)})));
    out.tools.push(
      ...copy(store.tools, k, x => ({
        ...x,
        barcode: bump(x.barcode, k),
        ...(x.setId && k ? {setId: `${x.setId}~${k}`} : {}),
      })),
    );
    out.movements.push(
      ...copy(store.movements || [], k, x => ({
        ...x,
        asset: bump(String(x.asset).slice(0, 7), k) + String(x.asset).slice(7),
      })),
    );
    out.issues.push(
      ...copy(store.issues || [], k, x => ({
        ...x,
        asset: bump(String(x.asset).slice(0, 7), k) + String(x.asset).slice(7),
      })),
    );
  }
  return out;
}

export function buildSeed(organizationId: string, scale = 1) {
  const store = scaled(demoSurgiRepository.getInitialData() as unknown as Record<string, Item[]>, scale);
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
  // Errors users met, for Studio → Errors (platform owner).
  const ago = (min: number) => new Date(now - min * 60_000).toISOString();
  const error = (id: string, min: number, kind: string, message: string, route: string) => ({
    id,
    organization_id: organizationId,
    user_id: null,
    occurred_at: ago(min),
    kind,
    message,
    detail: kind === 'render' ? `TypeError: ${message}\n    at SetDetailPage (SetDetailPage.tsx:212:31)` : null,
    route,
    app_version: '0.29.6',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0',
  });
  tables.client_errors = [
    error('e1', 12, 'render', "Cannot read properties of undefined (reading 'barcode')", '/sets/s3'),
    error('e2', 95, 'render', "Cannot read properties of undefined (reading 'barcode')", '/sets/s7'),
    error('e3', 240, 'sync', 'permission: Σετ S000321 · ΟΡΘΟΠΕΔΙΚΟ ΒΑΣΙΚΟ', '/sterilization'),
    error('e4', 1500, 'rejection', 'Unexpected token \'<\', "<!doctype "... is not valid JSON', '/reports'),
  ];
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
