import {
  Layers3,
  Wrench,
  Sparkles,
  Warehouse,
  TriangleAlert,
  BarChart3,
  Settings,
  History,
  PackageSearch,
  Building2,
  Hospital,
  LayoutDashboard,
  Cable,
  Trash2,
  CalendarClock,
  ScanSearch,
  Scissors,
  type LucideIcon,
} from 'lucide-react';
import type {UserRole} from '../store/SurgiStore';
import type {Permission} from '../core/permissions';
import {hasPermission} from '../core/permissions';

/** The menu's sections, in the order of how often they are used: the day's work first, administration last. */
export type NavigationGroup = 'WORK' | 'EQUIPMENT' | 'INSIGHT' | 'ADMIN';
export const navigationGroupLabel: Record<NavigationGroup, [string, string]> = {
  WORK: ['Καθημερινή εργασία', 'Daily work'],
  EQUIPMENT: ['Εξοπλισμός', 'Equipment'],
  INSIGHT: ['Ανάλυση', 'Insight'],
  ADMIN: ['Διαχείριση', 'Administration'],
};

export type NavigationItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  exactSearch?: string;
  permission: Permission;
  group?: NavigationGroup;
};

const assetNavigation: NavigationItem[] = [
  {to: '/sterilization', label: 'Αποστείρωση', icon: Sparkles, permission: 'sterilization.workspace', group: 'WORK'},
  {to: '/issues', label: 'Εκκρεμότητες', icon: TriangleAlert, permission: 'issue.view', group: 'WORK'},
  {to: '/expiry', label: 'Λήξεις', icon: CalendarClock, permission: 'asset.registry.view', group: 'WORK'},
  {to: '/sets', label: 'Σετ εργαλείων', icon: Layers3, permission: 'asset.registry.view', group: 'EQUIPMENT'},
  {
    to: '/tools',
    label: 'Εργαλεία',
    icon: Wrench,
    exactSearch: '',
    permission: 'asset.registry.view',
    group: 'EQUIPMENT',
  },
  {to: '/standalone-tools', label: 'Μεμονωμένα', icon: Scissors, permission: 'asset.registry.view', group: 'EQUIPMENT'},
  {to: '/stock', label: 'Απόθεμα εργαλείων', icon: Warehouse, permission: 'stock.manage', group: 'EQUIPMENT'},
  {to: '/devices', label: 'Συσκευές', icon: Cable, permission: 'sterilization.workspace', group: 'EQUIPMENT'},
  {to: '/traceability', label: 'Ιχνηλάτηση', icon: ScanSearch, permission: 'traceability.view', group: 'INSIGHT'},
  {to: '/reports', label: 'Αναφορές', icon: BarChart3, permission: 'reports.view', group: 'INSIGHT'},
  {to: '/movements', label: 'Ιστορικό', icon: History, permission: 'history.view', group: 'INSIGHT'},
  {to: '/bin', label: 'Κάδος', icon: Trash2, permission: 'asset.delete'},
];
export const navigationFor = (role: UserRole, can?: (permission: Permission) => boolean): NavigationItem[] => {
  const allowed = (permission: Permission) => (can ? can(permission) : hasPermission(role, permission));
  const overview: NavigationItem = {
    to: '/overview',
    label: 'Επισκόπηση',
    icon: LayoutDashboard,
    permission: 'overview.view',
    group: 'WORK',
  };
  if (role === 'STERILIZATION') return [overview, ...assetNavigation].filter(item => allowed(item.permission));
  if (role === 'DEPARTMENT') {
    const departmentNavigation: NavigationItem[] = [
      {to: '/department', label: 'Σετ & Εργαλεία', icon: PackageSearch, permission: 'department.workspace'},
      {to: '/issues', label: 'Εκκρεμότητες', icon: TriangleAlert, permission: 'issue.view'},
      {to: '/movements', label: 'Ιστορικό', icon: History, permission: 'history.view'},
    ];
    return departmentNavigation.filter(item => allowed(item.permission));
  }
  const adminNavigation: NavigationItem[] = [
    overview,
    ...assetNavigation,
    {to: '/hospital', label: 'Χρήστες & Τμήματα', icon: Building2, permission: 'studio.manage', group: 'ADMIN'},
    {to: '/hospitals', label: 'Νοσοκομεία', icon: Hospital, permission: 'studio.manage', group: 'ADMIN'},
    {to: '/studio', label: 'SurgiTrack Studio', icon: Settings, permission: 'studio.manage', group: 'ADMIN'},
  ];
  return adminNavigation.filter(item => allowed(item.permission));
};

/**
 * The menu entry a page belongs to when it is not the entry's own address: opening a Set, an instrument or
 * a "new" form keeps the Sets, Instruments, Standalone or Stock entry lit (an instrument lives in the list
 * that matches where it is: standalone, stock or the general registry).
 */
export const navSectionFor = (
  pathname: string,
  toolMode: (id: string) => 'STANDALONE' | 'SET_MEMBER' | 'STOCK' | undefined,
): string | undefined => {
  if (pathname === '/sets/new' || /^\/sets\/[^/]+$/.test(pathname)) return '/sets';
  if (pathname === '/tools/new' || pathname === '/tools/names') return '/tools';
  const tool = /^\/tools\/([^/]+)$/.exec(pathname);
  if (!tool) return undefined;
  const mode = toolMode(decodeURIComponent(tool[1]));
  return mode === 'STANDALONE' ? '/standalone-tools' : mode === 'STOCK' ? '/stock' : '/tools';
};

/**
 * Where a user lands after signing in: the Overview when their menu has it, otherwise the first entry
 * of their menu (e.g. Sets & Instruments for a department).
 */
export const homePathFor = (role: UserRole, can?: (permission: Permission) => boolean): string | undefined => {
  const items = navigationFor(role, can);
  return (items.find(item => item.to === '/overview') || items[0])?.to;
};
