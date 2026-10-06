import type {Asset} from '../../../types/domain';
import {tr, trData} from '../../../i18n';
import type {Kind, SterilizationRow} from '../sterilizationTypes';
import type {useSterilizationState} from './useSterilizationState';
import type {useSterilizationQueues} from './useSterilizationQueues';
import type {usePreparationChecks} from './usePreparationChecks';
import type {useIssueReport} from './useIssueReport';
import type {useReceiptFlow} from './useReceiptFlow';
import type {usePreparationFlow} from './usePreparationFlow';
import type {useCycleFlow} from './useCycleFlow';
import type {useLoadFlow} from './useLoadFlow';

export function useDeliveryFlow(
  p: ReturnType<typeof useSterilizationState> &
    ReturnType<typeof useSterilizationQueues> &
    ReturnType<typeof usePreparationChecks> &
    ReturnType<typeof useIssueReport> &
    ReturnType<typeof useReceiptFlow> &
    ReturnType<typeof usePreparationFlow> &
    ReturnType<typeof useCycleFlow> &
    ReturnType<typeof useLoadFlow>,
) {
  const {
    all,
    completeDeliveryToDepartment,
    deliveryBatchNote,
    deliveryBatchReceiver,
    deliveryDraft,
    deliveryNote,
    deliverySelected,
    ready,
    receiver,
    resolveAssetDraft,
    setDeliveryBatchNote,
    setDeliveryBatchOpen,
    setDeliveryBatchReceiver,
    setDeliveryDraft,
    setDeliveryNote,
    setDeliveryScanFeedback,
    setDeliverySelected,
    setQueue,
    setReceiver,
    tools,
  } = p;

  const receiverMatches = !deliveryDraft || !receiver || receiver.department === deliveryDraft.asset.department;
  const deliverySelectedAssets = ready.filter(item => deliverySelected.has(`${item.kind}:${item.id}`));
  const deliveryBatchDepartment = deliverySelectedAssets[0]?.department || '';
  const deliveryBatchReceiverMatches =
    !!deliveryBatchReceiver &&
    !!deliveryBatchDepartment &&
    deliveryBatchReceiver.department === deliveryBatchDepartment;
  const openDelivery = (kind: Kind, asset: Asset) => {
    const draft = resolveAssetDraft(kind, asset.id);
    if (!draft) return;
    setDeliveryDraft(draft);
    setReceiver(null);
    setDeliveryNote('');
  };
  const closeDelivery = () => {
    setDeliveryDraft(null);
    setReceiver(null);
    setDeliveryNote('');
  };
  const completeDelivery = () => {
    if (!deliveryDraft || !receiver || !receiverMatches) return;
    const done = completeDeliveryToDepartment(deliveryDraft.kind, deliveryDraft.asset.id, {
      receivedByUserId: receiver.userId,
      receivedByName: receiver.name,
      receivedByDepartment: receiver.department,
      note: deliveryNote,
    });
    if (!done) return;
    closeDelivery();
    setQueue('READY');
  };
  const openDeliveryBatch = () => {
    setDeliveryBatchOpen(true);
    setDeliverySelected(new Set());
    setDeliveryBatchReceiver(null);
    setDeliveryBatchNote('');
    setDeliveryScanFeedback(null);
  };
  const closeDeliveryBatch = () => {
    setDeliveryBatchOpen(false);
    setDeliverySelected(new Set());
    setDeliveryBatchReceiver(null);
    setDeliveryBatchNote('');
    setDeliveryScanFeedback(null);
  };
  const addBarcodeToDelivery = (raw: string) => {
    const barcode = raw.trim().toUpperCase();
    if (!barcode) return false;
    const eligible = ready.find(item => item.barcode.toUpperCase() === barcode);
    if (!eligible) {
      const known =
        all.find(item => item.barcode.toUpperCase() === barcode) ||
        tools.find(item => item.barcode.toUpperCase() === barcode);
      setDeliveryScanFeedback({
        type: 'ERROR',
        message: known
          ? tr('{0} αναγνωρίστηκε, αλλά δεν είναι αποδεσμευμένο / έτοιμο για παράδοση.', barcode)
          : tr('{0} δεν βρέθηκε στο μητρώο.', barcode),
      });
      return false;
    }
    const key = `${eligible.kind}:${eligible.id}`;
    if (deliverySelected.has(key)) {
      setDeliveryScanFeedback({type: 'WARN', message: tr('{0} έχει ήδη σαρωθεί για αυτή την παράδοση.', barcode)});
      return false;
    }
    if (deliveryBatchDepartment && eligible.department !== deliveryBatchDepartment) {
      setDeliveryScanFeedback({
        type: 'ERROR',
        message: tr(
          '{0} ανήκει στο {1}. Η τρέχουσα παράδοση αφορά το {2}. Ολοκλήρωσε πρώτα αυτή την παράδοση.',
          barcode,
          eligible.department ? trData(eligible.department) : tr('χωρίς τμήμα'),
          trData(deliveryBatchDepartment),
        ),
      });
      return false;
    }
    setDeliverySelected(current => new Set([...current, key]));
    setDeliveryBatchReceiver(null);
    setDeliveryScanFeedback({
      type: 'OK',
      message: tr('{0} · {1} προστέθηκε στην παράδοση προς {2}.', barcode, eligible.name, trData(eligible.department)),
    });
    return true;
  };
  const toggleDeliveryAsset = (item: SterilizationRow) => {
    const key = `${item.kind}:${item.id}`;
    if (deliverySelected.has(key)) {
      setDeliverySelected(current => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
      setDeliveryBatchReceiver(null);
      return;
    }
    if (deliveryBatchDepartment && item.department !== deliveryBatchDepartment) {
      setDeliveryScanFeedback({
        type: 'WARN',
        message: tr(
          'Η τρέχουσα παράδοση αφορά το {0}. Μπορείς να επιλέξεις όσα αντικείμενα θέλεις από το ίδιο τμήμα· για {1} ξεκίνησε ξεχωριστή παράδοση.',
          trData(deliveryBatchDepartment),
          trData(item.department),
        ),
      });
      return;
    }
    setDeliverySelected(current => new Set([...current, key]));
    setDeliveryBatchReceiver(null);
  };
  const toggleAllDeliveryDepartment = () => {
    const department = deliveryBatchDepartment;
    if (!department) return;
    const compatible = ready.filter(item => item.department === department);
    const compatibleKeys = compatible.map(item => `${item.kind}:${item.id}`);
    const allSelected = compatibleKeys.length > 0 && compatibleKeys.every(key => deliverySelected.has(key));
    setDeliverySelected(current => {
      const next = new Set(current);
      if (allSelected) compatibleKeys.forEach(key => next.delete(key));
      else compatibleKeys.forEach(key => next.add(key));
      return next;
    });
    setDeliveryBatchReceiver(null);
  };
  const completeDeliveryBatch = () => {
    if (!deliverySelectedAssets.length || !deliveryBatchReceiver || !deliveryBatchReceiverMatches) return;
    const batchId = `DB-${Date.now()}`;
    let completed = 0;
    deliverySelectedAssets.forEach(item => {
      const done = completeDeliveryToDepartment(item.kind, item.id, {
        batchId,
        receivedByUserId: deliveryBatchReceiver.userId,
        receivedByName: deliveryBatchReceiver.name,
        receivedByDepartment: deliveryBatchReceiver.department,
        note: deliveryBatchNote.trim() || undefined,
      });
      if (done) completed += 1;
    });
    if (completed === deliverySelectedAssets.length) closeDeliveryBatch();
  };
  return {
    addBarcodeToDelivery,
    closeDelivery,
    closeDeliveryBatch,
    completeDelivery,
    completeDeliveryBatch,
    deliveryBatchDepartment,
    deliveryBatchReceiverMatches,
    deliverySelectedAssets,
    openDelivery,
    openDeliveryBatch,
    receiverMatches,
    toggleAllDeliveryDepartment,
    toggleDeliveryAsset,
  };
}
