import type {Permission} from '../../core/permissions';

/**
 * The menu screens that have a screen guide, and the permission that opens each. This small list is all the
 * shell needs to know whether to offer the guide: the guide itself (ScreenGuide) reads the manual, a large file
 * that is loaded only when someone opens it. A test keeps the list equal to the manual's menu sections.
 */
export const GUIDED_SCREENS: ReadonlyArray<readonly [path: string, permission: Permission | undefined]> = [
  ['/overview', 'overview.view'],
  ['/department', 'department.workspace'],
  ['/sterilization', 'sterilization.workspace'],
  ['/issues', 'issue.view'],
  ['/replacements', 'stock.manage'],
  ['/expiry', 'asset.registry.view'],
  ['/sets', 'asset.registry.view'],
  ['/tools', 'asset.registry.view'],
  ['/standalone-tools', 'asset.registry.view'],
  ['/stock', 'stock.manage'],
  ['/sterilizers', 'sterilization.workspace'],
  ['/traceability', 'traceability.view'],
  ['/reports', 'reports.view'],
  ['/movements', 'history.view'],
  ['/hospital', 'studio.manage'],
  ['/hospitals', 'studio.manage'],
  ['/studio', 'studio.manage'],
  ['/import', 'asset.create'],
  ['/tools/names', 'asset.edit'],
  ['/bin', 'asset.delete'],
];

/** Whether this screen has a guide the person may open. */
export const hasScreenGuide = (pathname: string, can: (p: Permission) => boolean) =>
  GUIDED_SCREENS.some(([path, permission]) => path === pathname && (!permission || can(permission)));
