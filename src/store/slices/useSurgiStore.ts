import {useSurgiSession} from './useSurgiSession';
import {useSurgiRecords} from './useSurgiRecords';
import {useSurgiHelpers} from './useSurgiHelpers';
import {useReceiptAndCycleActions} from './useReceiptAndCycleActions';
import {useLoadActions} from './useLoadActions';
import {useAssetHelpers} from './useAssetHelpers';
import {useAssetCatalogActions} from './useAssetCatalogActions';
import {useAssetStatusActions} from './useAssetStatusActions';
import {useAssetEditActions} from './useAssetEditActions';
import {usePurchaseActions} from './usePurchaseActions';
import {useRecycleBinActions} from './useRecycleBinActions';
import type {SurgiDataMode} from '../../data/repositories';
import type {CloudWorkspace} from '../../data/cloud/CloudWorkspaceGate';

/** The store's state and actions, built slice by slice; each slice gets what the ones before it returned. */
export function useSurgiStore(args: {dataMode: SurgiDataMode; cloud?: CloudWorkspace | null}) {
  const s0 = useSurgiSession(args);
  const s1 = {...s0, ...useSurgiRecords(s0)};
  const s2 = {...s1, ...useSurgiHelpers(s1)};
  const s3 = {...s2, ...useReceiptAndCycleActions(s2)};
  const s4 = {...s3, ...useLoadActions(s3)};
  const s5 = {...s4, ...useAssetHelpers(s4)};
  const s6 = {...s5, ...useAssetCatalogActions(s5)};
  const s7 = {...s6, ...useAssetStatusActions(s6)};
  const s8 = {...s7, ...useAssetEditActions(s7)};
  const s9 = {...s8, ...usePurchaseActions(s8)};
  const s10 = {...s9, ...useRecycleBinActions(s9)};
  return s10;
}
