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
  {to: '/tools', label: 'Εργαλεία', icon: Wrench, exactSearch: '', permission: 'asset.registry.view'},
  {to: '/sets', label: 'Σετ εργαλείων', icon: Layers3, permission: 'asset.registry.view'},
  {to: '/standalone-tools', label: 'Μεμονωμένα σε χρήση', icon: Wrench, permission: 'asset.registry.view'},
  {to: '/stock', label: 'Stock εργαλείων', icon: Warehouse, permission: 'stock.manage'},
  {to: '/issues', label: 'Εκκρεμότητες', icon: TriangleAlert, permission: 'issue.view'},
  {to: '/reports', label: 'Αναφορές', icon: BarChart3, permission: 'reports.view'},
  {to: '/movements', label: 'Ιστορικό', icon: History, permission: 'history.view'},
];

export const navigationFor = (role: UserRole, can?: (permission: Permission) => boolean): NavigationItem[] => {
  const allowed = (permission: Permission) => (can ? can(permission) : hasPermission(role, permission));
  if (role === 'STERILIZATION') return assetNavigation.filter(item => allowed(item.permission));
  if (role === 'DEPARTMENT') {
    const departmentNavigation: NavigationItem[] = [
      {to: '/department', label: 'Σετ & Εργαλεία', icon: PackageSearch, permission: 'department.workspace'},
      {to: '/issues', label: 'Εκκρεμότητες', icon: TriangleAlert, permission: 'issue.view'},
      {to: '/movements', label: 'Ιστορικό', icon: History, permission: 'history.view'},
    ];
    return departmentNavigation.filter(item => allowed(item.permission));
  }
  const adminNavigation: NavigationItem[] = [
    ...assetNavigation,
    {to: '/studio', label: 'SurgiTrack Studio', icon: Settings, permission: 'studio.manage'},
  ];
  return adminNavigation.filter(item => allowed(item.permission));
};
