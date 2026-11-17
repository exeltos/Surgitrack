import type {Asset} from '../../../types/domain';
import {handoverCheck, signatureExempt} from '../../../core/handoverPolicy';
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
    deliveryMismatchReason,
    setDeliveryMismatchReason,
    deliveryBatchMismatchReason,
    setDeliveryBatchMismatchReason,
    sterilizationWorkflow,
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

  const handoverPolicy = sterilizationWorkflow.receiptPolicy;
  // Their own department, or an exempt one: «OK». Another one: a reason where the hospital allows it, else refused.
  const receiverCheck =
    deliveryDraft && receiver
      ? handoverCheck(receiver.department, deliveryDraft.asset.department, handoverPolicy, 'DELIVERY')
      : 'OK';
  const receiverMatches = receiverCheck === 'OK';
  // A department without the check at delivery takes its Sets without a signature.
  const deliverySignatureFree =
    !!deliveryDraft && signatureExempt(deliveryDraft.asset.department, handoverPolicy, 'DELIVERY');
  const receiverAllowed =
    deliverySignatureFree ||
    (!!receiver && (receiverMatches || (receiverCheck === 'REASON' && !!deliveryMismatchReason.trim())));
  const deliverySelectedAssets = ready.filter(item => deliverySelected.has(`${item.kind}:${item.id}`));
  const deliveryBatchDepartment = deliverySelectedAssets[0]?.department || '';
  const deliveryBatchReceiverCheck =
    deliveryBatchReceiver && deliveryBatchDepartment
      ? handoverCheck(deliveryBatchReceiver.department, deliveryBatchDepartment, handoverPolicy, 'DELIVERY')
      : 'BLOCKED';
  const deliveryBatchReceiverMatches = deliveryBatchReceiverCheck === 'OK';
  const deliveryBatchSignatureFree =
    !!deliveryBatchDepartment && signatureExempt(deliveryBatchDepartment, handoverPolicy, 'DELIVERY');
  const deliveryBatchReceiverAllowed =
    deliveryBatchSignatureFree ||
    (!!deliveryBatchReceiver &&
      (deliveryBatchReceiverMatches ||
        (deliveryBatchReceiverCheck === 'REASON' && !!deliveryBatchMismatchReason.trim())));
  /** The receiving side of a delivery without a signature: the department itself. */
  const unsignedReceiver = (department: string) => ({
    handoverSignatureId: undefined,
    receivedByUserId: '',
    receivedByName: department,
    receivedByDepartment: department,
  });
  const UNSIGNED = 'Χωρίς υπογραφή · τμήμα χωρίς έλεγχο στην παράδοση';
  /** The delivery's note, with the reason it went to someone of another department. */
  const withReason = (note: string, reason: string, matches: boolean, department?: string) =>
    [note.trim(), matches ? '' : `Παράδοση σε χρήστη άλλου τμήματος (${department || ''}): ${reason.trim()}`]
      .filter(Boolean)
      .join(' · ') || undefined;
  const openDelivery = (kind: Kind, asset: Asset) => {
    const draft = resolveAssetDraft(kind, asset.id);
    if (!draft) return;
    setDeliveryDraft(draft);
    setReceiver(null);
    setDeliveryNote('');
    setDeliveryMismatchReason('');
  };
  const closeDelivery = () => {
    setDeliveryDraft(null);
    setReceiver(null);
    setDeliveryNote('');
    setDeliveryMismatchReason('');
  };
  const completeDelivery = () => {
    if (!deliveryDraft || !receiverAllowed) return;
    const department = deliveryDraft.asset.department || '';
    const done = completeDeliveryToDepartment(
      deliveryDraft.kind,
      deliveryDraft.asset.id,
      deliverySignatureFree || !receiver
        ? {...unsignedReceiver(department), note: [deliveryNote.trim(), UNSIGNED].filter(Boolean).join(' · ')}
        : {
            handoverSignatureId: receiver.signatureId,
            receivedByUserId: receiver.userId,
            receivedByName: receiver.name,
            receivedByDepartment: receiver.department,
            note: withReason(deliveryNote, deliveryMismatchReason, receiverMatches, receiver.department),
          },
    );
    if (!done) return;
    closeDelivery();
    setQueue('READY');
  };
  /** The batch delivery; with a department, everything ready for it is picked already. */
  const openDeliveryBatch = (department?: string) => {
    setDeliveryBatchOpen(true);
    setDeliverySelected(
      new Set(department ? ready.filter(x => x.department === department).map(x => `${x.kind}:${x.id}`) : []),
    );
    setDeliveryBatchReceiver(null);
    setDeliveryBatchNote('');
    setDeliveryBatchMismatchReason('');
    setDeliveryScanFeedback(null);
  };
  const closeDeliveryBatch = () => {
    setDeliveryBatchOpen(false);
    setDeliverySelected(new Set());
    setDeliveryBatchReceiver(null);
    setDeliveryBatchNote('');
    setDeliveryBatchMismatchReason('');
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
  /** Everything ready for one department, at once (a delivery goes to one department). */
  const selectDeliveryDepartment = (department: string) => {
    if (deliveryBatchDepartment && deliveryBatchDepartment !== department) return;
    const keys = ready.filter(x => x.department === department).map(x => `${x.kind}:${x.id}`);
    setDeliverySelected(current => new Set([...current, ...keys]));
    setDeliveryBatchReceiver(null);
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
    if (!deliverySelectedAssets.length || !deliveryBatchReceiverAllowed) return;
    const batchId = `DB-${Date.now()}`;
    let completed = 0;
    const signer = deliveryBatchSignatureFree ? null : deliveryBatchReceiver;
    deliverySelectedAssets.forEach(item => {
      const done = completeDeliveryToDepartment(
        item.kind,
        item.id,
        signer
          ? {
              batchId,
              handoverSignatureId: signer.signatureId,
              receivedByUserId: signer.userId,
              receivedByName: signer.name,
              receivedByDepartment: signer.department,
              note: withReason(
                deliveryBatchNote,
                deliveryBatchMismatchReason,
                deliveryBatchReceiverMatches,
                signer.department,
              ),
            }
          : {
              batchId,
              ...unsignedReceiver(deliveryBatchDepartment),
              note: [deliveryBatchNote.trim(), UNSIGNED].filter(Boolean).join(' · '),
            },
      );
      if (done) completed += 1;
    });
    if (completed === deliverySelectedAssets.length) closeDeliveryBatch();
  };
  return {
    deliverySignatureFree,
    deliveryBatchSignatureFree,
    receiverCheck,
    receiverAllowed,
    deliveryBatchReceiverCheck,
    deliveryBatchReceiverAllowed,
    selectDeliveryDepartment,
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
