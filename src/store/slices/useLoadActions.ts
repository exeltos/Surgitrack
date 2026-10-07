import {releaseIndicatorVerdict} from '../../core/releaseIndicators';
import type {
  AssetKind,
  AssetState,
  DeliveryRecord,
  SterilizationCycleRecord,
  SterilizationReleaseRecord,
  WorkflowCheckpointRecord,
  ProcessLoadRecord,
  RecallCase,
} from '../../types/domain';
import {formatStoreDateTime, uniqueStamp} from '../helpers';
import type {
  CreateProcessLoadPayload,
  DeliveryPayload,
  ReleaseProcessLoadPayload,
  WorkflowCheckpointPayload,
} from '../types';
import {workflowStageState} from '../../core/workflow';
import {tr} from '../../i18n';
import type {useSurgiSession} from './useSurgiSession';
import type {useSurgiRecords} from './useSurgiRecords';
import type {useSurgiHelpers} from './useSurgiHelpers';
import type {useReceiptAndCycleActions} from './useReceiptAndCycleActions';

export function useLoadActions(
  p: ReturnType<typeof useSurgiSession> &
    ReturnType<typeof useSurgiRecords> &
    ReturnType<typeof useSurgiHelpers> &
    ReturnType<typeof useReceiptAndCycleActions>,
) {
  const {
    addMovement,
    assertCirculationAllowed,
    assetName,
    currentUser,
    nextStateAfter,
    notify,
    processLoads,
    recallCases,
    reprocessState,
    setDeliveries,
    setProcessLoads,
    setRecallCases,
    setSterilizationCycles,
    setSterilizationReleases,
    setTools,
    setWorkflowCheckpoints,
    sterilizationCycles,
    sterilizationWorkflow,
    tools,
    updateState,
    releaseShelfLife,
    chooseShelfLife,
  } = p;

  const createProcessLoad = (payload: CreateProcessLoadPayload) => {
    const expectedState: AssetState = payload.kind === 'WASHING' ? 'IN_WASHING' : 'IN_STERILIZATION';
    const refs = payload.assetRefs
      .map(ref => ({ref, asset: assetName(ref.kind, ref.id)}))
      .filter(
        (entry): entry is {ref: {kind: AssetKind; id: string}; asset: NonNullable<ReturnType<typeof assetName>>} =>
          !!entry.asset && entry.asset.state === expectedState,
      );
    if (!refs.length) {
      notify(tr('Δεν επιλέχθηκαν έγκυρα αντικείμενα για το φορτίο.'));
      return;
    }
    const loadId = `L${uniqueStamp()}`;
    const items = refs.map(({ref, asset}) => ({
      assetId: ref.id,
      assetKind: ref.kind,
      barcode: asset.barcode,
      assetName: asset.name,
      department: asset.department || 'Τμήμα',
    }));
    const now = formatStoreDateTime();
    if (payload.kind === 'WASHING') {
      const stage = sterilizationWorkflow.stages.find(stage => stage.id === 'WASHING');
      refs.forEach(({ref, asset}) => {
        const checkpoint: WorkflowCheckpointRecord = {
          id: `wc${uniqueStamp()}-${ref.id}`,
          workflowVersion: sterilizationWorkflow.version,
          assetId: ref.id,
          assetKind: ref.kind,
          barcode: asset.barcode,
          assetName: asset.name,
          department: asset.department || 'Τμήμα',
          stageId: 'WASHING',
          checks: (stage?.checksEl || []).map(() => true),
          note: `Φορτίο ${loadId} · ${payload.equipment} · κύκλος ${payload.cycleNumber}${payload.note ? ` · ${payload.note}` : ''}`,
          completedByUserId: currentUser.id,
          completedByName: currentUser.name,
          completedByDepartment: currentUser.department,
          completedAt: now,
        };
        setWorkflowCheckpoints(list => [checkpoint, ...list]);
        updateState(ref.kind, ref.id, nextStateAfter('WASHING'));
        addMovement({
          asset: `${asset.barcode} · ${asset.name}`,
          assetKind: ref.kind,
          from: 'Καθαρισμός & Απολύμανση',
          to:
            sterilizationWorkflow.stages.find(s => workflowStageState[s.id] === nextStateAfter('WASHING'))?.labelEl ||
            'Επόμενο στάδιο',
          status: `Φορτίο πλυντηρίου ${loadId} · ${payload.equipment} · ${payload.cycleNumber} · ${payload.program}`,
          by: currentUser.name,
        });
      });
      const record: ProcessLoadRecord = {
        id: loadId,
        workflowVersion: sterilizationWorkflow.version,
        kind: 'WASHING',
        equipment: payload.equipment,
        cycleNumber: payload.cycleNumber,
        program: payload.program,
        status: 'PASSED',
        items,
        note: payload.note,
        createdByUserId: currentUser.id,
        createdByName: currentUser.name,
        createdAt: now,
        completedAt: now,
      };
      setProcessLoads(list => [record, ...list]);
      notify(tr('Το φορτίο {0} ολοκληρώθηκε για {1} αντικείμενα.', loadId, items.length));
      return record;
    }
    const result = payload.chemicalIndicatorResult === 'FAIL' ? 'FAILED' : 'PASSED';
    refs.forEach(({ref, asset}, index) => {
      const toolIds = ref.kind === 'SET' ? tools.filter(t => t.setId === ref.id).map(t => t.id) : [ref.id];
      const cycle: SterilizationCycleRecord = {
        id: `sc${uniqueStamp()}-${index}`,
        workflowVersion: sterilizationWorkflow.version,
        loadId,
        assetId: ref.id,
        assetKind: ref.kind,
        barcode: asset.barcode,
        assetName: asset.name,
        department: asset.department || 'Τμήμα',
        sterilizer: payload.equipment,
        cycleNumber: payload.cycleNumber,
        program: payload.program,
        indicatorResult: payload.chemicalIndicatorResult || 'NOT_RECORDED',
        result,
        note: payload.note,
        completedByUserId: currentUser.id,
        completedByName: currentUser.name,
        completedByDepartment: currentUser.department,
        completedAt: now,
        toolIds,
      };
      setSterilizationCycles(list => [cycle, ...list]);
      if (result === 'PASSED') {
        setTools(list =>
          list.map(tool =>
            toolIds.includes(tool.id) ? {...tool, sterilizations: (tool.sterilizations || 0) + 1} : tool,
          ),
        );
        updateState(ref.kind, ref.id, nextStateAfter('STERILIZATION'));
      } else updateState(ref.kind, ref.id, reprocessState());
      addMovement({
        asset: `${asset.barcode} · ${asset.name}`,
        assetKind: ref.kind,
        from: 'Αποστείρωση',
        to:
          result === 'PASSED'
            ? sterilizationWorkflow.stages.find(s => workflowStageState[s.id] === nextStateAfter('STERILIZATION'))
                ?.labelEl || 'Αποδέσμευση'
            : 'Επανεπεξεργασία',
        status: `Φορτίο ${loadId} · ${payload.equipment} · ${payload.cycleNumber} · ${result === 'PASSED' ? 'επιτυχές' : 'ΑΠΟΤΥΧΙΑ'}`,
        by: currentUser.name,
      });
    });
    const record: ProcessLoadRecord = {
      id: loadId,
      workflowVersion: sterilizationWorkflow.version,
      kind: 'STERILIZATION',
      equipment: payload.equipment,
      cycleNumber: payload.cycleNumber,
      program: payload.program,
      status: result === 'PASSED' ? 'AWAITING_RELEASE' : 'FAILED',
      items,
      chemicalIndicatorResult: payload.chemicalIndicatorResult,
      biologicalIndicatorResult: payload.biologicalIndicatorResult,
      note: payload.note,
      createdByUserId: currentUser.id,
      createdByName: currentUser.name,
      createdAt: now,
      completedAt: now,
    };
    setProcessLoads(list => [record, ...list]);
    notify(
      result === 'PASSED'
        ? tr('Το φορτίο {0} ολοκληρώθηκε και αναμένει αποδέσμευση.', loadId)
        : tr('Το φορτίο {0} απέτυχε και επέστρεψε σε επανεπεξεργασία.', loadId),
    );
    return record;
  };
  const releaseProcessLoad = (loadId: string, payload: ReleaseProcessLoadPayload) => {
    const load = processLoads.find(item => item.id === loadId && item.kind === 'STERILIZATION');
    if (!load || load.status !== 'AWAITING_RELEASE') return;
    const policy = sterilizationWorkflow.releasePolicy || {
      requireChemicalIndicator: true,
      biologicalIndicator: 'OPTIONAL' as const,
      allowReleaseWhileBiPending: false,
    };
    const chemical = payload.chemicalIndicatorResult ?? (payload.chemicalIndicatorOk ? 'PASS' : 'NOT_RECORDED');
    const canRelease =
      payload.physicalParametersOk &&
      payload.packagingIntegrityOk &&
      releaseIndicatorVerdict(policy, chemical, payload.biologicalIndicatorResult).ok &&
      payload.decision === 'RELEASED';
    const decision = canRelease ? 'RELEASED' : 'REPROCESS';
    const now = formatStoreDateTime();
    load.items.forEach((item, index) => {
      const cycle = sterilizationCycles.find(
        c => c.loadId === loadId && c.assetId === item.assetId && c.result === 'PASSED',
      );
      if (!cycle) return;
      const shelfLife = decision === 'RELEASED' ? releaseShelfLife(item.assetKind, item.assetId) : undefined;
      const record: SterilizationReleaseRecord = {
        id: `sr${uniqueStamp()}-${index}`,
        workflowVersion: sterilizationWorkflow.version,
        loadId,
        assetId: item.assetId,
        assetKind: item.assetKind,
        barcode: item.barcode,
        assetName: item.assetName,
        department: item.department,
        cycleRecordId: cycle.id,
        cycleNumber: cycle.cycleNumber,
        sterilizer: cycle.sterilizer,
        physicalParametersOk: payload.physicalParametersOk,
        chemicalIndicatorOk: chemical === 'PASS',
        packagingIntegrityOk: payload.packagingIntegrityOk,
        biologicalIndicatorResult: payload.biologicalIndicatorResult,
        decision,
        note: payload.note,
        releasedByUserId: currentUser.id,
        releasedByName: currentUser.name,
        releasedByDepartment: currentUser.department,
        releasedAt: now,
        ...shelfLife,
      };
      setSterilizationReleases(list => [record, ...list]);
      if (shelfLife) updateState(item.assetKind, item.assetId, nextStateAfter('RELEASE'), shelfLife);
      else updateState(item.assetKind, item.assetId, reprocessState());
      addMovement({
        asset: `${item.barcode} · ${item.assetName}`,
        assetKind: item.assetKind,
        from: 'Αποδέσμευση φορτίου',
        to:
          decision === 'RELEASED'
            ? sterilizationWorkflow.stages.find(s => workflowStageState[s.id] === nextStateAfter('RELEASE'))?.labelEl ||
              'Έτοιμα'
            : 'Επανεπεξεργασία',
        status: `${decision === 'RELEASED' ? 'Αποδέσμευση' : 'Μη αποδέσμευση'} φορτίου ${loadId} · κύκλος ${load.cycleNumber}`,
        by: currentUser.name,
      });
    });
    const updated: ProcessLoadRecord = {
      ...load,
      status: decision,
      physicalParametersOk: payload.physicalParametersOk,
      packagingIntegrityOk: payload.packagingIntegrityOk,
      chemicalIndicatorResult: chemical,
      biologicalIndicatorResult: payload.biologicalIndicatorResult,
      note: payload.note || load.note,
      releasedAt: now,
    };
    setProcessLoads(list => list.map(item => (item.id === loadId ? updated : item)));
    if (decision === 'RELEASED') {
      const releasedKeys = new Set(load.items.map(item => `${item.assetKind}:${item.assetId}`));
      setRecallCases(cases =>
        cases.map(recall => {
          if (recall.status !== 'OPEN') return recall;
          const items = recall.items.map(item =>
            releasedKeys.has(`${item.assetKind}:${item.assetId}`) ? {...item, status: 'CLOSED' as const} : item,
          );
          const closed = items.every(item => item.status === 'CLOSED');
          return {
            ...recall,
            items,
            status: closed ? ('CLOSED' as const) : ('OPEN' as const),
            closedAt: closed ? now : recall.closedAt,
          };
        }),
      );
    }
    notify(
      decision === 'RELEASED'
        ? tr('Το φορτίο {0} αποδεσμεύτηκε ({1} αντικείμενα).', loadId, load.items.length)
        : tr('Το φορτίο {0} δεν αποδεσμεύτηκε και επέστρεψε σε επανεπεξεργασία.', loadId),
    );
    return updated;
  };
  const recallProcessLoad = (loadId: string, reason: string) => {
    const load = processLoads.find(item => item.id === loadId && item.kind === 'STERILIZATION');
    if (!load || load.status !== 'RELEASED' || !reason.trim()) return;
    if (recallCases.some(c => c.loadId === loadId && c.status === 'OPEN')) {
      notify(tr('Υπάρχει ήδη ενεργή ανάκληση για το φορτίο {0}.', loadId));
      return;
    }
    const now = formatStoreDateTime();
    const caseItems = load.items.map(item => {
      const asset = assetName(item.assetKind, item.assetId);
      const currentState = asset?.state || ('IN_DEPARTMENT' as AssetState);
      return {
        ...item,
        currentState,
        patientCode: asset && 'patientCode' in asset ? asset.patientCode : undefined,
        status: (currentState === 'IN_DEPARTMENT' ? 'OUTSTANDING' : 'REPROCESSING') as 'OUTSTANDING' | 'REPROCESSING',
      };
    });
    const recallCase: RecallCase = {
      id: `recall-${uniqueStamp()}`,
      loadId,
      cycleNumber: load.cycleNumber,
      sterilizer: load.equipment,
      reason: reason.trim(),
      openedAt: now,
      openedByUserId: currentUser.id,
      openedByName: currentUser.name,
      status: 'OPEN',
      items: caseItems,
    };
    setRecallCases(list => [recallCase, ...list]);
    load.items.forEach(item => {
      const asset = assetName(item.assetKind, item.assetId);
      if (!asset) return;
      updateState(
        item.assetKind,
        item.assetId,
        asset.state === 'IN_DEPARTMENT' ? 'PENDING_STERILIZATION' : reprocessState(),
      );
      addMovement({
        asset: `${item.barcode} · ${item.assetName}`,
        assetKind: item.assetKind,
        from: asset.department || 'Κυκλοφορία',
        to: 'Ανάκληση / Επανεπεξεργασία',
        status: `ΑΝΑΚΛΗΣΗ ${recallCase.id} · φορτίο ${loadId} · ${reason.trim()}`,
        by: currentUser.name,
        patientCode: asset && 'patientCode' in asset ? asset.patientCode : undefined,
      });
    });
    setProcessLoads(list =>
      list.map(item =>
        item.id === loadId ? {...item, status: 'RECALLED', recalledAt: now, recallReason: reason.trim()} : item,
      ),
    );
    notify(tr('Άνοιξε η ανάκληση {0} για το φορτίο {1} ({2} αντικείμενα).', recallCase.id, loadId, load.items.length));
  };
  const completeWorkflowCheckpoint = (kind: AssetKind, id: string, payload: WorkflowCheckpointPayload) => {
    const a = assetName(kind, id);
    if (!a) return;
    const stage = sterilizationWorkflow.stages.find(s => s.id === payload.stageId);
    if (!stage) return;
    const requiredCount = stage.checksEl.length;
    if (payload.checks.length < requiredCount || payload.checks.slice(0, requiredCount).some(value => !value)) return;
    const record: WorkflowCheckpointRecord = {
      id: `wc${uniqueStamp()}`,
      workflowVersion: sterilizationWorkflow.version,
      assetId: id,
      assetKind: kind,
      barcode: a.barcode,
      assetName: a.name,
      department: a.department || 'Τμήμα',
      stageId: payload.stageId,
      checks: payload.checks,
      note: payload.note,
      ...(payload.stageId === 'PACKAGING' && payload.shelfLifeMonths ? {shelfLifeMonths: payload.shelfLifeMonths} : {}),
      completedByUserId: currentUser.id,
      completedByName: currentUser.name,
      completedByDepartment: currentUser.department,
      completedAt: formatStoreDateTime(),
    };
    setWorkflowCheckpoints(x => [record, ...x]);
    if (payload.stageId === 'PACKAGING') chooseShelfLife(kind, id, payload.shelfLifeMonths);
    const nextState = nextStateAfter(payload.stageId);
    updateState(kind, id, nextState);
    addMovement({
      asset: `${a.barcode} · ${a.name}`,
      assetKind: kind,
      from: stage.labelEl,
      to: sterilizationWorkflow.stages.find(s => workflowStageState[s.id] === nextState)?.labelEl || 'Επόμενο στάδιο',
      status: `Ολοκλήρωση ελέγχου · ${stage.labelEl}`,
      by: currentUser.name,
    });
    notify(tr('{0}: ολοκληρώθηκε το στάδιο «{1}».', a.barcode, stage.labelEl));
    return record;
  };
  const completeDeliveryToDepartment = (kind: AssetKind, id: string, payload: DeliveryPayload) => {
    const a = assetName(kind, id);
    if (!a || a.state !== 'READY_FOR_PICKUP' || !assertCirculationAllowed(kind, id)) return;
    const record: DeliveryRecord = {
      id: `d${uniqueStamp()}-${Math.random().toString(36).slice(2, 6)}`,
      workflowVersion: sterilizationWorkflow.version,
      batchId: payload.batchId,
      assetId: id,
      assetKind: kind,
      barcode: a.barcode,
      assetName: a.name,
      department: a.department || 'Τμήμα',
      deliveredByUserId: currentUser.id,
      deliveredByName: currentUser.name,
      deliveredByDepartment: currentUser.department,
      receivedByUserId: payload.receivedByUserId,
      receivedByName: payload.receivedByName,
      receivedByDepartment: payload.receivedByDepartment,
      at: formatStoreDateTime(),
      note: payload.note,
    };
    setDeliveries(x => [record, ...x]);
    updateState(kind, id, 'IN_DEPARTMENT');
    addMovement({
      asset: `${a.barcode} · ${a.name}`,
      assetKind: kind,
      from: 'Κεντρική Αποστείρωση',
      to: a.department || 'Τμήμα',
      status: `Παράδοση / παραλαβή ολοκληρώθηκε · παρέδωσε ${currentUser.name} · παρέλαβε ${payload.receivedByName}`,
      by: currentUser.name,
    });
    notify(tr('Η παράδοση του {0} στο {1} ολοκληρώθηκε.', a.barcode, a.department || 'τμήμα'));
    return record;
  };
  return {
    completeDeliveryToDepartment,
    completeWorkflowCheckpoint,
    createProcessLoad,
    recallProcessLoad,
    releaseProcessLoad,
  };
}
