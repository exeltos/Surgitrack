import type {Asset, ReceiptCheckResult} from '../../../types/domain';
import {handoverCheck, signatureExempt} from '../../../core/handoverPolicy';
import {electronicDispatch} from '../../../core/electronicDispatch';
import {tr, trData} from '../../../i18n';
import type {Kind, SterilizationRow} from '../sterilizationTypes';
import type {useSterilizationState} from './useSterilizationState';
import type {useSterilizationQueues} from './useSterilizationQueues';
import type {usePreparationChecks} from './usePreparationChecks';
import type {useIssueReport} from './useIssueReport';
import {tellUser} from '../../../components/ui/confirmService';

export function useReceiptFlow(
  p: ReturnType<typeof useSterilizationState> &
    ReturnType<typeof useSterilizationQueues> &
    ReturnType<typeof usePreparationChecks> &
    ReturnType<typeof useIssueReport>,
) {
  const {
    all,
    checkedCount,
    deliverer,
    departmentMismatchReason,
    incoming,
    movements,
    note,
    receiptBatchDeliverer,
    receiptBatchDeviations,
    receiptBatchMismatchReason,
    receiptBatchNote,
    receiptBatchSelected,
    receiptDeviationRecorded,
    receiptDraft,
    receiveAtSterilization,
    resolveAssetDraft,
    setCheckEnabled,
    setCheckNote,
    setCheckResult,
    setCheckedCount,
    setDeliverer,
    setDepartmentMismatchReason,
    setIssueNote,
    setIssueTarget,
    setNote,
    setPrepDraft,
    setReceiptBatchDeliverer,
    setReceiptBatchDeviations,
    setReceiptBatchMismatchReason,
    setReceiptBatchNote,
    setReceiptBatchOpen,
    setReceiptBatchScanFeedback,
    setReceiptBatchSelected,
    setReceiptCheckedToolIds,
    setReceiptDeviationRecorded,
    setReceiptDraft,
    setReceiptNoteOpen,
    setReceiptProblemToolIds,
    setReceiptSetChecks,
    setReceiptView,
    setVisibleDeviation,
    sterilizationWorkflow,
    tools,
    visibleDeviation,
  } = p;

  const receiptPolicy = sterilizationWorkflow.receiptPolicy || {
    countSetsAtReceipt: false,
    allowCrossDepartmentHandover: true,
  };
  // Their own department, or an exempt one: no reason asked.
  const delivererMatches =
    !receiptDraft ||
    !deliverer ||
    handoverCheck(deliverer.department, receiptDraft.asset.department, receiptPolicy, 'RECEIPT') === 'OK';
  const departmentExceptionAllowed =
    !!deliverer && !delivererMatches && receiptPolicy.allowCrossDepartmentHandover && !!departmentMismatchReason.trim();
  // A department without the check at receipt hands over without a signature: the receipt records who sent it.
  const receiptSignatureFree =
    !!receiptDraft && signatureExempt(receiptDraft.asset.department, receiptPolicy, 'RECEIPT');
  const receiptSender = receiptDraft ? electronicDispatch(movements, receiptDraft.asset.barcode) : undefined;
  const receiptIdentityValid =
    receiptSignatureFree || (!!deliverer && (delivererMatches || departmentExceptionAllowed));
  const receiptBatchAssets = incoming.filter(item => receiptBatchSelected.has(`${item.kind}:${item.id}`));
  const receiptBatchDepartment = receiptBatchAssets[0]?.department || '';
  const receiptBatchDelivererMatches =
    !!receiptBatchDeliverer &&
    !!receiptBatchDepartment &&
    handoverCheck(receiptBatchDeliverer.department, receiptBatchDepartment, receiptPolicy, 'RECEIPT') === 'OK';
  const receiptBatchDepartmentException =
    !!receiptBatchDeliverer &&
    !receiptBatchDelivererMatches &&
    receiptPolicy.allowCrossDepartmentHandover &&
    !!receiptBatchMismatchReason.trim();
  const receiptBatchSignatureFree =
    !!receiptBatchDepartment && signatureExempt(receiptBatchDepartment, receiptPolicy, 'RECEIPT');
  const receiptBatchIdentityValid =
    receiptBatchSignatureFree ||
    (!!receiptBatchDeliverer && (receiptBatchDelivererMatches || receiptBatchDepartmentException));
  /** Who hands over: the one who signed, else (no signature asked) whoever sent it electronically. */
  const handoverFrom = (barcode: string, department: string, signer: typeof deliverer) => {
    if (signer)
      return {
        handoverSignatureId: signer.signatureId,
        deliveredByUserId: signer.userId,
        deliveredByName: signer.name,
        deliveredByDepartment: signer.department,
        unsigned: '',
      };
    const sent = electronicDispatch(movements, barcode);
    return {
      handoverSignatureId: undefined,
      deliveredByUserId: '',
      deliveredByName: sent?.by || department,
      deliveredByDepartment: department,
      unsigned: sent
        ? `Χωρίς υπογραφή · ηλεκτρονική αποστολή από ${sent.by} (${sent.at})`
        : 'Χωρίς υπογραφή · τμήμα χωρίς έλεγχο στην παραλαβή',
    };
  };

  const receiptTools = receiptDraft?.kind === 'SET' ? tools.filter(t => t.setId === receiptDraft.asset.id) : [];
  const receiptExpectedCount = receiptDraft?.kind === 'SET' ? receiptTools.length : 1;
  const openReceiptBatch = () => {
    setReceiptBatchOpen(true);
    setReceiptBatchSelected(new Set());
    setReceiptBatchDeliverer(null);
    setReceiptBatchNote('');
    setReceiptBatchMismatchReason('');
    setReceiptBatchDeviations(new Set());
    setReceiptBatchScanFeedback(null);
  };
  const closeReceiptBatch = () => {
    setReceiptBatchOpen(false);
    setReceiptBatchSelected(new Set());
    setReceiptBatchDeliverer(null);
    setReceiptBatchNote('');
    setReceiptBatchMismatchReason('');
    setReceiptBatchDeviations(new Set());
    setReceiptBatchScanFeedback(null);
  };
  const toggleReceiptBatchAsset = (item: SterilizationRow) => {
    const key = `${item.kind}:${item.id}`;
    setReceiptBatchSelected(current => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
        setReceiptBatchDeviations(d => {
          const nd = new Set(d);
          nd.delete(key);
          return nd;
        });
      } else {
        const active = receiptBatchAssets[0];
        if (active && active.department !== item.department) return current;
        next.add(key);
      }
      return next;
    });
  };
  /** Everything waiting from one department, at once (the receipt is one department at a time). */
  const selectReceiptBatchDepartment = (department: string) => {
    if (receiptBatchDepartment && receiptBatchDepartment !== department) return;
    const keys = incoming.filter(x => x.department === department).map(x => `${x.kind}:${x.id}`);
    setReceiptBatchSelected(current => new Set([...current, ...keys]));
  };
  const clearReceiptBatchSelection = () => {
    setReceiptBatchSelected(new Set());
    setReceiptBatchDeviations(new Set());
  };
  const addBarcodeToReceiptBatch = (raw: string) => {
    const barcode = raw.trim().toUpperCase();
    if (!barcode) return false;
    const item = incoming.find(x => x.barcode.toUpperCase() === barcode);
    if (!item) {
      const known = all.find(x => x.barcode.toUpperCase() === barcode);
      setReceiptBatchScanFeedback({
        type: 'ERROR',
        message: known
          ? tr('{0} αναγνωρίστηκε, αλλά δεν βρίσκεται σε αναμονή φυσικής παραλαβής.', barcode)
          : tr('{0} δεν βρέθηκε στο μητρώο.', barcode),
      });
      return false;
    }
    const key = `${item.kind}:${item.id}`;
    if (receiptBatchSelected.has(key)) {
      setReceiptBatchScanFeedback({type: 'WARN', message: tr('{0} είναι ήδη στην παραλαβή.', barcode)});
      return false;
    }
    if (receiptBatchDepartment && item.department !== receiptBatchDepartment) {
      setReceiptBatchScanFeedback({
        type: 'ERROR',
        message: tr(
          'Η τρέχουσα μαζική παραλαβή αφορά το {0}. Ολοκλήρωσέ την πριν παραλάβεις αντικείμενα από {1}.',
          trData(receiptBatchDepartment),
          trData(item.department),
        ),
      });
      return false;
    }
    setReceiptBatchSelected(current => new Set([...current, key]));
    setReceiptBatchScanFeedback({type: 'OK', message: tr('{0} · {1} προστέθηκε στην παραλαβή.', barcode, item.name)});
    return true;
  };
  const completeReceiptBatch = () => {
    if (!receiptBatchAssets.length || !receiptBatchIdentityValid) return;
    // A signature asked: only the one who signed hands over. None asked: each item's electronic sender.
    const signer = receiptBatchSignatureFree ? null : receiptBatchDeliverer;
    if (!receiptBatchSignatureFree && !signer) return;
    const mismatch = !!signer && !receiptBatchDelivererMatches;
    const batchId = `RB-${Date.now()}`;
    receiptBatchAssets.forEach(item => {
      const key = `${item.kind}:${item.id}`;
      const expected = item.kind === 'SET' ? tools.filter(t => t.setId === item.id).length : undefined;
      const {unsigned, ...from} = handoverFrom(item.barcode, item.department || '', signer);
      receiveAtSterilization(item.kind, item.id, {
        batchId,
        ...from,
        note:
          [
            receiptBatchNote.trim(),
            unsigned,
            mismatch ? `Παράδοση από διαφορετικό τμήμα: ${receiptBatchMismatchReason.trim()}` : '',
          ]
            .filter(Boolean)
            .join(' · ') || undefined,
        visibleDeviation: receiptBatchDeviations.has(key),
        departmentMismatch: mismatch,
        departmentMismatchReason: mismatch ? receiptBatchMismatchReason.trim() : undefined,
        checkPerformed: item.kind === 'SET' && receiptPolicy.countSetsAtReceipt,
        checkedCount: item.kind === 'SET' && receiptPolicy.countSetsAtReceipt ? expected : undefined,
        checkResult:
          item.kind === 'SET' && receiptPolicy.countSetsAtReceipt
            ? 'OK'
            : receiptBatchDeviations.has(key)
              ? 'OTHER'
              : undefined,
        checkNote: receiptBatchDeviations.has(key)
          ? 'Δηλώθηκε εμφανής απόκλιση κατά τη μαζική φυσική παραλαβή.'
          : undefined,
      });
    });
    closeReceiptBatch();
  };
  const openReceipt = (kind: Kind, asset: Asset) => {
    const draft = resolveAssetDraft(kind, asset.id);
    if (!draft) return;
    setReceiptDraft(draft);
    setReceiptView(null);
    setPrepDraft(null);
    setDeliverer(null);
    setNote('');
    setReceiptNoteOpen(false);
    setVisibleDeviation(false);
    setReceiptDeviationRecorded(false);
    setDepartmentMismatchReason('');
    setCheckEnabled(receiptPolicy.countSetsAtReceipt && kind === 'SET');
    setCheckedCount(kind === 'SET' ? tools.filter(t => t.setId === asset.id).length : 1);
    setCheckResult('OK');
    setCheckNote('');
    setReceiptCheckedToolIds(new Set());
    setReceiptProblemToolIds(new Set());
    setReceiptSetChecks({containerOk: false, compositionOk: false, visualOk: false});
  };
  const closeReceipt = () => {
    setReceiptDraft(null);
    setReceiptNoteOpen(false);
    setReceiptView(null);
    setDeliverer(null);
    setNote('');
    setVisibleDeviation(false);
    setReceiptDeviationRecorded(false);
    setDepartmentMismatchReason('');
    setCheckEnabled(false);
    setCheckNote('');
    setReceiptCheckedToolIds(new Set());
    setReceiptProblemToolIds(new Set());
    setReceiptSetChecks({containerOk: false, compositionOk: false, visualOk: false});
  };
  const confirmReceipt = () => {
    if (!receiptDraft || !receiptIdentityValid) return;
    const signer = receiptSignatureFree ? null : deliverer;
    if (!receiptSignatureFree && !signer) return;
    const mismatch = !!signer && !delivererMatches;
    if (visibleDeviation && !receiptDeviationRecorded) {
      void tellUser(
        tr('Λείπει η καταγραφή απόκλισης'),
        tr('Κατέγραψε πρώτα την εμφανή απόκλιση με αναφορά στο Σετ ή στο συγκεκριμένο εργαλείο.'),
      );
      return;
    }
    const countPerformed = receiptDraft.kind === 'SET' && receiptPolicy.countSetsAtReceipt;
    const countResult: ReceiptCheckResult =
      countPerformed && checkedCount !== receiptExpectedCount ? 'MISSING' : visibleDeviation ? 'OTHER' : 'OK';
    const {unsigned, ...from} = handoverFrom(receiptDraft.asset.barcode, receiptDraft.asset.department || '', signer);
    const combinedNote = [
      note.trim(),
      unsigned,
      mismatch ? `Παράδοση από διαφορετικό τμήμα: ${departmentMismatchReason.trim()}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    receiveAtSterilization(receiptDraft.kind, receiptDraft.asset.id, {
      ...from,
      note: combinedNote || undefined,
      visibleDeviation: visibleDeviation || (countPerformed && checkedCount !== receiptExpectedCount),
      departmentMismatch: mismatch,
      departmentMismatchReason: mismatch ? departmentMismatchReason.trim() : undefined,
      checkPerformed: countPerformed,
      checkedCount: countPerformed ? checkedCount : undefined,
      checkResult: countPerformed ? countResult : visibleDeviation ? 'OTHER' : undefined,
      checkNote: visibleDeviation ? 'Δηλώθηκε εμφανής απόκλιση κατά τη φυσική παραλαβή.' : undefined,
    });
    setReceiptDraft(null);
    setDeliverer(null);
    setNote('');
    setVisibleDeviation(false);
    setReceiptDeviationRecorded(false);
    setDepartmentMismatchReason('');
    setCheckEnabled(false);
    setCheckNote('');
    setReceiptCheckedToolIds(new Set());
    setReceiptProblemToolIds(new Set());
    setReceiptSetChecks({containerOk: false, compositionOk: false, visualOk: false});
    setIssueTarget(null);
    setIssueNote('');
  };
  return {
    clearReceiptBatchSelection,
    selectReceiptBatchDepartment,
    addBarcodeToReceiptBatch,
    closeReceipt,
    closeReceiptBatch,
    completeReceiptBatch,
    confirmReceipt,
    delivererMatches,
    openReceipt,
    openReceiptBatch,
    receiptBatchAssets,
    receiptBatchDelivererMatches,
    receiptBatchDepartment,
    receiptBatchIdentityValid,
    receiptBatchSignatureFree,
    receiptSender,
    receiptSignatureFree,
    receiptExpectedCount,
    receiptIdentityValid,
    receiptPolicy,
    receiptTools,
    toggleReceiptBatchAsset,
  };
}
