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
  type LucideIcon,
} from 'lucide-react';
import type {UserRole} from '../store/SurgiStore';
import type {Permission} from '../core/permissions';
import {hasPermission} from '../core/permissions';

export type NavigationItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  exactSearch?: string;
  permission: Permission;
};

const assetNavigation: NavigationItem[] = [
  {to: '/sterilization', label: 'Αποστείρωση', icon: Sparkles, permission: 'sterilization.workspace'},
  {to: '/devices', label: 'Συσκευές', icon: Cable, permission: 'sterilization.workspace'},
  {to: '/tools', label: 'Εργαλεία', icon: Wrench, exactSearch: '', permission: 'asset.registry.view'},
  {to: '/sets', label: 'Σετ εργαλείων', icon: Layers3, permission: 'asset.registry.view'},
  {to: '/standalone-tools', label: 'Μεμονωμένα', icon: Wrench, permission: 'asset.registry.view'},
  {to: '/stock', label: 'Απόθεμα εργαλείων', icon: Warehouse, permission: 'stock.manage'},
  {to: '/issues', label: 'Εκκρεμότητες', icon: TriangleAlert, permission: 'issue.view'},
  {to: '/reports', label: 'Αναφορές', icon: BarChart3, permission: 'reports.view'},
  {to: '/movements', label: 'Ιστορικό', icon: History, permission: 'history.view'},
  {to: '/bin', label: 'Κάδος', icon: Trash2, permission: 'asset.delete'},
];

export const navigationFor = (role: UserRole, can?: (permission: Permission) => boolean): NavigationItem[] => {
  const allowed = (permission: Permission) => (can ? can(permission) : hasPermission(role, permission));
  const overview: NavigationItem = {
    to: '/overview',
    label: 'Επισκόπηση',
    icon: LayoutDashboard,
    permission: 'overview.view',
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
    {to: '/hospital', label: 'Χρήστες & Τμήματα', icon: Building2, permission: 'studio.manage'},
    {to: '/hospitals', label: 'Νοσοκομεία', icon: Hospital, permission: 'studio.manage'},
    {to: '/studio', label: 'SurgiTrack Studio', icon: Settings, permission: 'studio.manage'},
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
