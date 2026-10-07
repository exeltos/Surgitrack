import {tr} from '../../../i18n';
import type {useSterilizationState} from './useSterilizationState';
import type {useSterilizationQueues} from './useSterilizationQueues';
import type {usePreparationChecks} from './usePreparationChecks';
import type {useIssueReport} from './useIssueReport';
import type {useReceiptFlow} from './useReceiptFlow';
import type {usePreparationFlow} from './usePreparationFlow';
import type {useCycleFlow} from './useCycleFlow';
import type {useLoadFlow} from './useLoadFlow';
import type {useDeliveryFlow} from './useDeliveryFlow';

export function useScanFlow(
  p: ReturnType<typeof useSterilizationState> &
    ReturnType<typeof useSterilizationQueues> &
    ReturnType<typeof usePreparationChecks> &
    ReturnType<typeof useIssueReport> &
    ReturnType<typeof useReceiptFlow> &
    ReturnType<typeof usePreparationFlow> &
    ReturnType<typeof useCycleFlow> &
    ReturnType<typeof useLoadFlow> &
    ReturnType<typeof useDeliveryFlow>,
) {
  const {
    all,
    openCheckpoint,
    openDelivery,
    openPreparation,
    openReceipt,
    openRelease,
    query,
    quickBarcode,
    setQueue,
    setQuickBarcode,
    setQuickScanFeedback,
  } = p;

  const openBarcodeAsset = (raw: string) => {
    const q = raw.trim().toUpperCase();
    if (!q) return false;
    const found = all.find(x => x.barcode.toUpperCase() === q);
    if (!found) return false;
    if (found.state === 'PENDING_STERILIZATION') {
      setQueue('INCOMING');
      openReceipt(found.kind, found);
    } else if (found.state === 'IN_WASHING') {
      setQueue('WASHING');
      openCheckpoint(found.kind, found, 'WASHING');
    } else if (found.state === 'IN_PREPARATION') {
      setQueue('PREP');
      openPreparation(found.kind, found);
    } else if (found.state === 'IN_PACKAGING') {
      setQueue('PACKAGING');
      openCheckpoint(found.kind, found, 'PACKAGING');
    } else if (found.state === 'IN_STERILIZATION') {
      // In a running load it stays locked; otherwise it is loaded into the sterilizer.
      if (p.inSterilizer.some(x => x.kind === found.kind && x.id === found.id)) setQueue('IN_STERILIZER');
      else {
        setQueue('PROCESS');
        p.openLoad('STERILIZATION', [`${found.kind}:${found.id}`]);
      }
    } else if (found.state === 'AWAITING_RELEASE') {
      setQueue('RELEASE');
      const load = p.awaitingLoads.find(l => l.items.some(i => i.assetKind === found.kind && i.assetId === found.id));
      if (load) p.openLoadRelease(load.id);
      else openRelease(found.kind, found);
    } else if (found.state === 'IN_STORAGE') {
      setQueue('STORAGE');
      openCheckpoint(found.kind, found, 'STORAGE');
    } else if (found.state === 'READY_FOR_PICKUP') {
      setQueue('READY');
      openDelivery(found.kind, found);
    }
    return true;
  };
  const scan = () => openBarcodeAsset(query);
  const quickScan = () => {
    const raw = quickBarcode.trim();
    if (!raw) return;
    const ok = openBarcodeAsset(raw);
    setQuickScanFeedback(ok ? tr('Το barcode αναγνωρίστηκε.') : tr('Το barcode δεν βρέθηκε στην ενεργή ροή.'));
    if (ok) setQuickBarcode('');
  };
  return {quickScan, scan};
}
