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
