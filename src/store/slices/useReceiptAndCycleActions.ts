import type {
  AssetKind,
  PreparationRecord,
  ReceiptRecord,
  SterilizationCycleRecord,
  SterilizationReleaseRecord,
} from '../../types/domain';
import {formatStoreDateTime, uniqueStamp} from '../helpers';
import type {
  PreparationPayload,
  ReceivePayload,
  SterilizationCompletionPayload,
  SterilizationReleasePayload,
} from '../types';
import {workflowStageState} from '../../core/workflow';
import {tr} from '../../i18n';
import type {useSurgiSession} from './useSurgiSession';
import type {useSurgiRecords} from './useSurgiRecords';
import type {useSurgiHelpers} from './useSurgiHelpers';

export function useReceiptAndCycleActions(
  p: ReturnType<typeof useSurgiSession> & ReturnType<typeof useSurgiRecords> & ReturnType<typeof useSurgiHelpers>,
) {
  const {
    addMovement,
    assertCirculationAllowed,
    assetName,
    currentUser,
    enabledStages,
    livesConsumedBy,
    nextStateAfter,
    notify,
    reprocessState,
    setIssues,
    setPreparations,
    setRecallCases,
    setReceipts,
    setSets,
    setSterilizationCycles,
    setSterilizationReleases,
    setTools,
    sets,
    sterilizationCycles,
    sterilizationWorkflow,
    tools,
    updateState,
  } = p;

  const sendToSterilization = (kind: AssetKind, id: string, patientCode?: string, note?: string) => {
    const a = assetName(kind, id);
    if (!a || !assertCirculationAllowed(kind, id)) return;
    const limited = livesConsumedBy(kind, id);
    const setLimited = kind === 'SET' && !!sets.find(s => s.id === id)?.maxUses;
    if ((limited.length || setLimited) && !patientCode?.trim()) {
      notify(tr('{0}: απαιτείται κωδικός ασθενούς για εργαλεία περιορισμένων χρήσεων.', a.barcode));
      return;
    }
    const at = formatStoreDateTime();
    const exhausted = limited.filter(t => t.uses + 1 >= (t.maxUses || 0));
    const exhaustedIds = new Set(exhausted.map(t => t.id));
    const limitedIds = new Set(limited.map(t => t.id));
    const dispatchedToolExhausted = kind === 'TOOL' && exhaustedIds.has(id);
    if (!dispatchedToolExhausted) updateState(kind, id, 'PENDING_STERILIZATION');
    if (limited.length) {
      setTools(list =>
        list.map(t => {
          if (!limitedIds.has(t.id)) return t;
          const used = {...t, uses: t.uses + 1};
          return exhaustedIds.has(t.id)
            ? {
                ...used,
                state: 'RETIRED' as const,
                retiredAt: at,
                retiredReason: 'Συμπλήρωση ορίου χρήσεων',
                setId: undefined,
              }
            : used;
        }),
      );
    }
    if (setLimited || (kind === 'SET' && exhausted.length)) {
      setSets(list =>
        list.map(s =>
          s.id === id
            ? {
                ...s,
                uses: setLimited ? (s.uses || 0) + 1 : s.uses,
                actual: Math.max(0, s.actual - exhausted.length),
              }
            : s,
        ),
      );
    }
    addMovement({
      asset: `${a.barcode} · ${a.name}`,
      assetKind: kind,
      from: a.department || currentUser.department || 'Τμήμα',
      to: 'Κεντρική Αποστείρωση',
      status: `Ηλεκτρονική αποστολή · ${currentUser.name} (${currentUser.id}) · αναμονή φυσικής παραλαβής${
        limited.length ? ` · −1 χρήση σε ${limited.length} εργαλεί${limited.length === 1 ? 'ο' : 'α'}` : ''
      }`,
      by: currentUser.name,
      patientCode,
      note,
    });
    exhausted.forEach(t =>
      addMovement({
        asset: `${t.barcode} · ${t.name}`,
        assetKind: 'TOOL',
        from: kind === 'SET' ? `Set ${a.barcode}` : a.department || currentUser.department || 'Τμήμα',
        to: 'Εκτός χρήσης',
        status: `Συμπλήρωση ορίου χρήσεων (${t.maxUses}/${t.maxUses}) · αυτόματα εκτός χρήσης`,
        by: currentUser.name,
        patientCode,
      }),
    );
    notify(
      exhausted.length
        ? tr(
            '{0} προωθήθηκε προς Αποστείρωση. Συμπληρώθηκε το όριο χρήσεων: {1} — τέθηκε εκτός χρήσης.',
            a.barcode,
            exhausted.map(t => t.barcode).join(', '),
          )
        : tr('{0} προωθήθηκε ηλεκτρονικά προς Αποστείρωση από {1}.', a.barcode, currentUser.name),
    );
  };
  /** Sterilization confirms it saw an out-of-use notice (the tool was physically set aside). */
  const acknowledgeOutOfUse = (id: string) =>
    setTools(list =>
      list.map(t =>
        t.id === id && t.state === 'RETIRED'
          ? {...t, retiredNoticeSeenAt: formatStoreDateTime(), retiredNoticeSeenBy: currentUser.name}
          : t,
      ),
    );
  const receiveAtSterilization = (kind: AssetKind, id: string, payload: ReceivePayload) => {
    const a = assetName(kind, id);
    if (!a) return;
    const setAsset = kind === 'SET' ? sets.find(x => x.id === id) : undefined;
    const physicalExpected = setAsset ? tools.filter(t => t.setId === id).length : undefined;
    const checkedCount =
      setAsset && payload.checkPerformed ? (payload.checkedCount ?? physicalExpected ?? setAsset.actual) : undefined;
    const record: ReceiptRecord = {
      id: `r${uniqueStamp()}-${Math.random().toString(36).slice(2, 7)}`,
      workflowVersion: sterilizationWorkflow.version,
      batchId: payload.batchId,
      assetId: id,
      assetKind: kind,
      barcode: a.barcode,
      assetName: a.name,
      fromDepartment: a.department || 'Τμήμα',
      toDepartment: 'Κεντρική Αποστείρωση',
      deliveredByUserId: payload.deliveredByUserId,
      deliveredByName: payload.deliveredByName,
      deliveredByDepartment: payload.deliveredByDepartment,
      receivedByUserId: currentUser.id,
      receivedByName: currentUser.name,
      receivedByDepartment: currentUser.department,
      at: formatStoreDateTime(),
      note: payload.note,
      visibleDeviation: payload.visibleDeviation ?? false,
      departmentMismatch: payload.departmentMismatch ?? false,
      departmentMismatchReason: payload.departmentMismatchReason,
      expected: physicalExpected,
      actual: setAsset ? (checkedCount ?? physicalExpected ?? setAsset.actual) : undefined,
      checkPerformed: payload.checkPerformed,
      checkedCount,
      checkResult: payload.checkPerformed ? payload.checkResult || 'OK' : undefined,
      checkNote: payload.checkPerformed ? payload.checkNote : undefined,
      itemChecks: payload.checkPerformed ? payload.itemChecks : undefined,
      setChecks: payload.checkPerformed ? payload.setChecks : undefined,
    };
    setReceipts(x => [record, ...x]);
    setRecallCases(cases =>
      cases.map(c =>
        c.status !== 'OPEN'
          ? c
          : {
              ...c,
              items: c.items.map(item =>
                item.assetKind === kind && item.assetId === id
                  ? {...item, status: 'REPROCESSING', returnedAt: record.at}
                  : item,
              ),
            },
      ),
    );
    if (kind === 'SET' && payload.checkPerformed && checkedCount !== undefined)
      setSets(x => x.map(s => (s.id === id ? {...s, actual: checkedCount} : s)));
    if (payload.checkPerformed && payload.checkResult && payload.checkResult !== 'OK') {
      const issueType =
        payload.checkResult === 'MISSING'
          ? 'Έλλειψη'
          : payload.checkResult === 'DAMAGE'
            ? 'Βλάβη'
            : 'Παρατήρηση παραλαβής';
      setIssues(x => [
        {
          id: `i${uniqueStamp()}`,
          asset: `${a.barcode} · ${a.name}`,
          type: issueType,
          status: 'OPEN',
          created: formatStoreDateTime(),
          department: a.department || 'Τμήμα',
          note:
            payload.checkNote ||
            `${kind === 'SET' ? `Αναμενόμενα ${physicalExpected} / παραλήφθηκαν ${checkedCount}` : 'Πρόβλημα κατά την παραλαβή'}`,
        },
        ...x,
      ]);
    }
    updateState(kind, id, nextStateAfter('RECEIPT'));
    addMovement({
      asset: `${a.barcode} · ${a.name}`,
      assetKind: kind,
      from: a.department || 'Τμήμα',
      to:
        sterilizationWorkflow.stages.find(
          stage => stage.id === enabledStages[enabledStages.findIndex(stage => stage.id === 'RECEIPT') + 1]?.id,
        )?.labelEl || 'Επόμενο στάδιο',
      status: payload.visibleDeviation
        ? 'Φυσική παραλαβή · εμφανής απόκλιση'
        : payload.checkPerformed
          ? 'Φυσική παραλαβή + καταμέτρηση'
          : 'Φυσική παραλαβή · χωρίς εμφανή απόκλιση',
      by: `${currentUser.name} · παρέδωσε ${payload.deliveredByName}`,
    });
    notify(
      payload.checkPerformed
        ? tr('Παραλήφθηκε {0} από την Αποστείρωση και καταγράφηκε ο έλεγχος.', a.barcode)
        : tr('Παραλήφθηκε {0} από την Αποστείρωση.', a.barcode),
    );
    return record;
  };
  const recordPreparation = (kind: AssetKind, id: string, payload: PreparationPayload) => {
    const a = assetName(kind, id);
    if (!a) return;
    const record: PreparationRecord = {
      id: `p${uniqueStamp()}`,
      workflowVersion: sterilizationWorkflow.version,
      assetId: id,
      assetKind: kind,
      barcode: a.barcode,
      assetName: a.name,
      department: a.department || 'Τμήμα',
      preparedByUserId: currentUser.id,
      preparedByName: currentUser.name,
      preparedByDepartment: currentUser.department,
      at: formatStoreDateTime(),
      toolIds: payload.toolIds,
      checkedToolIds: payload.checkedToolIds,
      allOk: payload.allOk,
      processChecks: payload.processChecks,
      note: payload.note,
    };
    setPreparations(x => [record, ...x]);
    updateState(kind, id, nextStateAfter('PREPARATION'));
    addMovement({
      asset: `${a.barcode} · ${a.name}`,
      assetKind: kind,
      from: 'Σύνθεση & Προετοιμασία',
      to:
        sterilizationWorkflow.stages.find(stage => workflowStageState[stage.id] === nextStateAfter('PREPARATION'))
          ?.labelEl || 'Επόμενο στάδιο',
      status: 'Σύνθεση / προετοιμασία ολοκληρώθηκε · προς κλιβανισμό',
      by: currentUser.name,
    });
    notify(tr('Η σύνθεση / προετοιμασία του {0} καταγράφηκε.', a.barcode));
    return record;
  };
  const completeSterilizationCycle = (kind: AssetKind, id: string, payload: SterilizationCompletionPayload) => {
    const a = assetName(kind, id);
    if (!a) return;
    const toolIds = kind === 'SET' ? tools.filter(t => t.setId === id).map(t => t.id) : [id];
    const record: SterilizationCycleRecord = {
      id: `sc${uniqueStamp()}`,
      workflowVersion: sterilizationWorkflow.version,
      loadId: payload.loadId,
      assetId: id,
      assetKind: kind,
      barcode: a.barcode,
      assetName: a.name,
      department: a.department || 'Τμήμα',
      sterilizer: payload.sterilizer,
      cycleNumber: payload.cycleNumber,
      program: payload.program,
      indicatorResult: payload.indicatorResult,
      result: payload.indicatorResult === 'FAIL' ? 'FAILED' : 'PASSED',
      note: payload.note,
      completedByUserId: currentUser.id,
      completedByName: currentUser.name,
      completedByDepartment: currentUser.department,
      completedAt: formatStoreDateTime(),
      toolIds,
    };
    setSterilizationCycles(x => [record, ...x]);
    if (record.result === 'FAILED') {
      addMovement({
        asset: `${a.barcode} · ${a.name}`,
        assetKind: kind,
        from: 'Αποστείρωση',
        to: 'Αποστείρωση',
        status: `Αποτυχία κύκλου ${payload.cycleNumber} · ${payload.sterilizer}`,
        by: currentUser.name,
      });
      notify(
        tr(
          'Ο κύκλος {0} καταγράφηκε ως αποτυχημένος. Το {1} παραμένει προς επανεπεξεργασία.',
          payload.cycleNumber,
          a.barcode,
        ),
      );
      return record;
    }
    setTools(list =>
      list.map(tool => (toolIds.includes(tool.id) ? {...tool, sterilizations: (tool.sterilizations || 0) + 1} : tool)),
    );
    updateState(kind, id, nextStateAfter('STERILIZATION'));
    addMovement({
      asset: `${a.barcode} · ${a.name}`,
      assetKind: kind,
      from: 'Αποστείρωση',
      to:
        sterilizationWorkflow.stages.find(stage => workflowStageState[stage.id] === nextStateAfter('STERILIZATION'))
          ?.labelEl || 'Επόμενο στάδιο',
      status: `Κύκλος ολοκληρώθηκε · ${payload.sterilizer} · ${payload.cycleNumber} · ${payload.program}`,
      by: currentUser.name,
    });
    notify(tr('{0}: ο κύκλος ολοκληρώθηκε και αναμένει έλεγχο αποδέσμευσης.', a.barcode));
    return record;
  };
  const releaseSterilization = (kind: AssetKind, id: string, payload: SterilizationReleasePayload) => {
    const a = assetName(kind, id);
    if (!a || a.state !== 'AWAITING_RELEASE') return;
    const cycle = sterilizationCycles.find(c => c.id === payload.cycleRecordId && c.assetId === id);
    if (!cycle) return;
    const policy = sterilizationWorkflow.releasePolicy || {
      requireChemicalIndicator: true,
      biologicalIndicator: 'OPTIONAL' as const,
      allowReleaseWhileBiPending: false,
    };
    const chemicalOk = !policy.requireChemicalIndicator || payload.chemicalIndicatorOk;
    const biologicalOk =
      policy.biologicalIndicator === 'NOT_REQUIRED' ||
      payload.biologicalIndicatorResult === 'PASS' ||
      (policy.biologicalIndicator === 'OPTIONAL' && payload.biologicalIndicatorResult === 'NOT_REQUIRED') ||
      (policy.allowReleaseWhileBiPending && payload.biologicalIndicatorResult === 'PENDING');
    const canRelease =
      payload.physicalParametersOk &&
      chemicalOk &&
      payload.packagingIntegrityOk &&
      biologicalOk &&
      payload.decision === 'RELEASED';
    const decision = canRelease ? 'RELEASED' : 'REPROCESS';
    const record: SterilizationReleaseRecord = {
      id: `sr${uniqueStamp()}`,
      workflowVersion: sterilizationWorkflow.version,
      loadId: payload.loadId,
      assetId: id,
      assetKind: kind,
      barcode: a.barcode,
      assetName: a.name,
      department: a.department || 'Τμήμα',
      cycleRecordId: cycle.id,
      cycleNumber: cycle.cycleNumber,
      sterilizer: cycle.sterilizer,
      physicalParametersOk: payload.physicalParametersOk,
      chemicalIndicatorOk: payload.chemicalIndicatorOk,
      packagingIntegrityOk: payload.packagingIntegrityOk,
      biologicalIndicatorResult: payload.biologicalIndicatorResult,
      decision,
      note: payload.note,
      releasedByUserId: currentUser.id,
      releasedByName: currentUser.name,
      releasedByDepartment: currentUser.department,
      releasedAt: formatStoreDateTime(),
    };
    setSterilizationReleases(x => [record, ...x]);
    if (decision === 'RELEASED') {
      updateState(kind, id, nextStateAfter('RELEASE'));
      addMovement({
        asset: `${a.barcode} · ${a.name}`,
        assetKind: kind,
        from: 'Αποδέσμευση',
        to:
          sterilizationWorkflow.stages.find(stage => workflowStageState[stage.id] === nextStateAfter('RELEASE'))
            ?.labelEl || 'Έτοιμα για παραλαβή',
        status: `Αποδεσμεύτηκε · κύκλος ${cycle.cycleNumber} · ${cycle.sterilizer}`,
        by: currentUser.name,
      });
      notify(tr('{0}: αποδεσμεύτηκε και είναι έτοιμο για παραλαβή.', a.barcode));
      return record;
    }
    updateState(kind, id, reprocessState());
    addMovement({
      asset: `${a.barcode} · ${a.name}`,
      assetKind: kind,
      from: 'Αποδέσμευση',
      to:
        sterilizationWorkflow.stages.find(stage => workflowStageState[stage.id] === reprocessState())?.labelEl ||
        'Επανεπεξεργασία',
      status: `Μη αποδέσμευση · προς επανεπεξεργασία · κύκλος ${cycle.cycleNumber}`,
      by: currentUser.name,
    });
    notify(tr('{0}: δεν αποδεσμεύτηκε και επέστρεψε για επανεπεξεργασία.', a.barcode));
    return record;
  };
  return {
    acknowledgeOutOfUse,
    completeSterilizationCycle,
    receiveAtSterilization,
    recordPreparation,
    releaseSterilization,
    sendToSterilization,
  };
}
