import type {Asset, AssetKind, SetAsset, Tool} from '../types/domain';
import type {LifecycleAlert, SessionUser, UserRole} from './types';

export const formatStoreDateTime = () => new Date().toLocaleString('el-GR', {dateStyle: 'short', timeStyle: 'short'});

export const getActiveDepartment = (role: UserRole) => (role === 'DEPARTMENT' ? 'Αίθουσα Τοκετών' : 'Όλα τα τμήματα');

export const getDemoSessionUser = (role: UserRole): SessionUser => {
  if (role === 'STERILIZATION') {
    return {
      id: 'u-ster-01',
      name: 'Demo Χρήστης Αποστείρωσης',
      role,
      department: 'Κεντρική Αποστείρωση',
    };
  }

  if (role === 'ADMIN') {
    return {
      id: 'u-admin-01',
      name: 'Demo Διαχειριστής',
      role,
      department: 'Διαχείριση',
    };
  }

  return {
    id: 'u-dept-01',
    name: 'Demo Χρήστης Τμήματος',
    role,
    department: 'Αίθουσα Τοκετών',
  };
};

export const findAsset = (kind: AssetKind, id: string, sets: SetAsset[], tools: Tool[]): Asset | undefined =>
  kind === 'SET' ? sets.find(item => item.id === id) : tools.find(item => item.id === id);

export const normalizeUsageLimit = (maxUses?: number) =>
  maxUses !== undefined && Number.isFinite(maxUses) && maxUses > 0 ? Math.floor(maxUses) : undefined;

export const getLifecycleAlerts = (sets: SetAsset[], tools: Tool[], warningThreshold = 3): LifecycleAlert[] => {
  const setAlerts: LifecycleAlert[] = sets
    .filter(set => set.maxUses !== undefined && set.maxUses > 0)
    .map(set => ({
      id: `usage-set-${set.id}`,
      assetId: set.id,
      assetKind: 'SET' as const,
      barcode: set.barcode,
      name: set.name,
      remaining: Math.max(0, set.maxUses! - (set.uses || 0)),
      maxUses: set.maxUses!,
    }))
    .filter(alert => alert.remaining <= warningThreshold);

  const toolAlerts: LifecycleAlert[] = tools
    .filter(tool => tool.maxUses !== undefined && tool.maxUses > 0)
    .map(tool => ({
      id: `usage-tool-${tool.id}`,
      assetId: tool.id,
      assetKind: 'TOOL' as const,
      barcode: tool.barcode,
      name: tool.name,
      remaining: Math.max(0, tool.maxUses! - tool.uses),
      maxUses: tool.maxUses!,
    }))
    .filter(alert => alert.remaining <= warningThreshold);

  return [...setAlerts, ...toolAlerts];
};
