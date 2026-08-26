import {createContext, useContext, useEffect, useMemo, useState, type ReactNode} from 'react';
import {getSurgiRepository, type SurgiDataMode} from '../data/repositories';
import type {
  AssetKind,
  AssetPhoto,
  AssetState,
  DeliveryRecord,
  Issue,
  Movement,
  PreparationRecord,
  ReceiptRecord,
  SetAsset,
  SterilizationCycleRecord,
  SterilizationReleaseRecord,
  Tool,
  WorkflowCheckpointRecord,
  ProcessLoadRecord,
} from '../types/domain';
import {
  findAsset,
  formatStoreDateTime,
  getActiveDepartment,
  getDemoSessionUser,
  getLifecycleAlerts,
  normalizeUsageLimit,
} from './helpers';
import {hasPermission, permissionsForRole} from '../core/permissions';
import type {
  CreateProcessLoadPayload,
  CreateSetPayload,
  CreateToolPayload,
  DeliveryPayload,
  PreparationPayload,
  ReceivePayload,
  ReleaseProcessLoadPayload,
  SetUpdatePatch,
  SterilizationCompletionPayload,
  SterilizationReleasePayload,
  SurgicalCount,
  SurgiStoreValue,
  Toast,
  ToolUpdatePatch,
  UserRole,
  WorkflowCheckpointPayload,
} from './types';
import {useLibraries} from '../core/LibraryStore';
import {
  nextStateAfter as nextStateAfterStage,
  reprocessState as reprocessStateForStages,
  workflowStageState,
  type WorkflowStageId,
} from '../core/workflow';

export type {
  DeliveryPayload,
  PreparationPayload,
  ReceivePayload,
  SessionUser,
  SterilizationCompletionPayload,
  SterilizationReleasePayload,
  SurgicalCount,
  UserRole,
  WorkflowCheckpointPayload,
} from './types';

const Ctx = createContext<SurgiStoreValue | null>(null);
export function SurgiProvider({children, dataMode = 'DEMO'}: {children: ReactNode; dataMode?: SurgiDataMode}) {
  const repository = useMemo(() => getSurgiRepository(dataMode), [dataMode]);
  const {sterilizationWorkflow, rolePermissions, systemSettings} = useLibraries();
  const enabledStages = sterilizationWorkflow.stages.filter(stage => stage.enabled);
  const nextStateAfter = (stageId: WorkflowStageId): AssetState =>
    nextStateAfterStage(sterilizationWorkflow.stages, stageId) as AssetState;
  const reprocessState = (): AssetState => reprocessStateForStages(sterilizationWorkflow.stages) as AssetState;
  const initialData = useMemo(() => repository.getInitialData(), [repository]);
  const [role, setRole] = useState<UserRole>(
    () => (sessionStorage.getItem('surgitrack-demo-role') as UserRole) || 'STERILIZATION',
  );
  const activeDepartment = getActiveDepartment(role);
  const currentUser = getDemoSessionUser(role);
  const permissions = permissionsForRole(role, rolePermissions);
  const can = (permission: import('../core/permissions').Permission) =>
    hasPermission(role, permission, rolePermissions);
  const [sets, setSets] = useState(initialData.sets);
  const [tools, setTools] = useState(() =>
    initialData.tools.map(tool =>
      tool.mode === 'STOCK'
        ? {...tool, department: undefined, state: 'IN_STOCK' as const}
        : tool.mode === 'SET_MEMBER'
          ? {...tool, department: initialData.sets.find(set => set.id === tool.setId)?.department || tool.department}
          : tool,
    ),
  );
  const [movements, setMovements] = useState(initialData.movements);
  const [issues, setIssues] = useState(initialData.issues);
  const [counts, setCounts] = useState<SurgicalCount[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [preparations, setPreparations] = useState<PreparationRecord[]>([]);
  const [sterilizationCycles, setSterilizationCycles] = useState<SterilizationCycleRecord[]>([]);
  const [processLoads, setProcessLoads] = useState<ProcessLoadRecord[]>([]);
  const [sterilizationReleases, setSterilizationReleases] = useState<SterilizationReleaseRecord[]>([]);
  const [workflowCheckpoints, setWorkflowCheckpoints] = useState<WorkflowCheckpointRecord[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [toast, setToast] = useState<Toast>();
  const notify = (text: string) => setToast({id: Date.now(), text});
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(undefined), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const addMovement = (m: Omit<Movement, 'id' | 'at'>) =>
    setMovements(x => [{...m, id: `m${Date.now()}`, at: formatStoreDateTime()}, ...x]);
  const assetName = (kind: AssetKind, id: string) => findAsset(kind, id, sets, tools);
  const updateState = (kind: AssetKind, id: string, state: AssetState) => {
    if (kind === 'SET') {
      setSets(x => x.map(a => (a.id === id ? {...a, state} : a)));
      setTools(x => x.map(t => (t.setId === id ? {...t, state} : t)));
      return;
    }
    setTools(x => x.map(a => (a.id === id ? {...a, state} : a)));
  };
  const sendToSterilization = (kind: AssetKind, id: string, patientCode?: string, note?: string) => {
    const a = assetName(kind, id);
    if (!a) return;
    updateState(kind, id, 'PENDING_STERILIZATION');
    addMovement({
      asset: `${a.barcode} · ${a.name}`,
      assetKind: kind,
      from: a.department || currentUser.department || 'Τμήμα',
      to: 'Κεντρική Αποστείρωση',
      status: `Ηλεκτρονική αποστολή · ${currentUser.name} (${currentUser.id}) · αναμονή φυσικής παραλαβής`,
      by: currentUser.name,
      patientCode,
      note,
    });
    notify(`${a.barcode} προωθήθηκε ηλεκτρονικά προς Αποστείρωση από ${currentUser.name}.`);
  };
  const receiveAtSterilization = (kind: AssetKind, id: string, payload: ReceivePayload) => {
    const a = assetName(kind, id);
    if (!a) return;
    const setAsset = kind === 'SET' ? sets.find(x => x.id === id) : undefined;
    const physicalExpected = setAsset ? tools.filter(t => t.setId === id).length : undefined;
    const checkedCount =
      setAsset && payload.checkPerformed ? (payload.checkedCount ?? physicalExpected ?? setAsset.actual) : undefined;
    const record: ReceiptRecord = {
      id: `r${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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
          id: `i${Date.now()}`,
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
      `Παραλήφθηκε ${a.barcode} από την Αποστείρωση${payload.checkPerformed ? ' και καταγράφηκε ο έλεγχος' : ''}.`,
    );
    return record;
  };
  const recordPreparation = (kind: AssetKind, id: string, payload: PreparationPayload) => {
    const a = assetName(kind, id);
    if (!a) return;
    const record: PreparationRecord = {
      id: `p${Date.now()}`,
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
    notify(`Η σύνθεση / προετοιμασία του ${a.barcode} καταγράφηκε.`);
    return record;
  };
  const completeSterilizationCycle = (kind: AssetKind, id: string, payload: SterilizationCompletionPayload) => {
    const a = assetName(kind, id);
    if (!a) return;
    const toolIds = kind === 'SET' ? tools.filter(t => t.setId === id).map(t => t.id) : [id];
    const record: SterilizationCycleRecord = {
      id: `sc${Date.now()}`,
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
        `Ο κύκλος ${payload.cycleNumber} καταγράφηκε ως αποτυχημένος. Το ${a.barcode} παραμένει προς επανεπεξεργασία.`,
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
    notify(`${a.barcode}: ο κύκλος ολοκληρώθηκε και αναμένει έλεγχο αποδέσμευσης.`);
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
      id: `sr${Date.now()}`,
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
      notify(`${a.barcode}: αποδεσμεύτηκε και είναι έτοιμο για παραλαβή.`);
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
    notify(`${a.barcode}: δεν αποδεσμεύτηκε και επέστρεψε για επανεπεξεργασία.`);
    return record;
  };
  const createProcessLoad = (payload: CreateProcessLoadPayload) => {
    const expectedState: AssetState = payload.kind === 'WASHING' ? 'IN_WASHING' : 'IN_STERILIZATION';
    const refs = payload.assetRefs
      .map(ref => ({ref, asset: assetName(ref.kind, ref.id)}))
      .filter(
        (entry): entry is {ref: {kind: AssetKind; id: string}; asset: NonNullable<ReturnType<typeof assetName>>} =>
          !!entry.asset && entry.asset.state === expectedState,
      );
    if (!refs.length) {
      notify('Δεν επιλέχθηκαν έγκυρα αντικείμενα για το φορτίο.');
      return;
    }
    const loadId = `L${Date.now()}`;
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
          id: `wc${Date.now()}-${ref.id}`,
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
      notify(`Το φορτίο ${loadId} ολοκληρώθηκε για ${items.length} αντικείμενα.`);
      return record;
    }
    const result = payload.chemicalIndicatorResult === 'FAIL' ? 'FAILED' : 'PASSED';
    refs.forEach(({ref, asset}, index) => {
      const toolIds = ref.kind === 'SET' ? tools.filter(t => t.setId === ref.id).map(t => t.id) : [ref.id];
      const cycle: SterilizationCycleRecord = {
        id: `sc${Date.now()}-${index}`,
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
      kind: 'STERILIZATION',
      equipment: payload.equipment,
      cycleNumber: payload.cycleNumber,
      program: payload.program,
      status: result === 'PASSED' ? 'AWAITING_RELEASE' : 'FAILED',
      items,
      chemicalIndicatorResult: payload.chemicalIndicatorResult || 'NOT_RECORDED',
      note: payload.note,
      createdByUserId: currentUser.id,
      createdByName: currentUser.name,
      createdAt: now,
      completedAt: now,
    };
    setProcessLoads(list => [record, ...list]);
    notify(
      result === 'PASSED'
        ? `Το φορτίο ${loadId} ολοκληρώθηκε και αναμένει αποδέσμευση.`
        : `Το φορτίο ${loadId} απέτυχε και επέστρεψε σε επανεπεξεργασία.`,
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
    const now = formatStoreDateTime();
    load.items.forEach((item, index) => {
      const cycle = sterilizationCycles.find(
        c => c.loadId === loadId && c.assetId === item.assetId && c.result === 'PASSED',
      );
      if (!cycle) return;
      const record: SterilizationReleaseRecord = {
        id: `sr${Date.now()}-${index}`,
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
        chemicalIndicatorOk: payload.chemicalIndicatorOk,
        packagingIntegrityOk: payload.packagingIntegrityOk,
        biologicalIndicatorResult: payload.biologicalIndicatorResult,
        decision,
        note: payload.note,
        releasedByUserId: currentUser.id,
        releasedByName: currentUser.name,
        releasedByDepartment: currentUser.department,
        releasedAt: now,
      };
      setSterilizationReleases(list => [record, ...list]);
      updateState(item.assetKind, item.assetId, decision === 'RELEASED' ? nextStateAfter('RELEASE') : reprocessState());
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
      biologicalIndicatorResult: payload.biologicalIndicatorResult,
      note: payload.note || load.note,
      releasedAt: now,
    };
    setProcessLoads(list => list.map(item => (item.id === loadId ? updated : item)));
    notify(
      decision === 'RELEASED'
        ? `Το φορτίο ${loadId} αποδεσμεύτηκε (${load.items.length} αντικείμενα).`
        : `Το φορτίο ${loadId} δεν αποδεσμεύτηκε και επέστρεψε σε επανεπεξεργασία.`,
    );
    return updated;
  };
  const recallProcessLoad = (loadId: string, reason: string) => {
    const load = processLoads.find(item => item.id === loadId && item.kind === 'STERILIZATION');
    if (!load) return;
    const now = formatStoreDateTime();
    load.items.forEach(item => {
      const asset = assetName(item.assetKind, item.assetId);
      if (!asset) return;
      updateState(item.assetKind, item.assetId, reprocessState());
      addMovement({
        asset: `${item.barcode} · ${item.assetName}`,
        assetKind: item.assetKind,
        from: asset.department || 'Κυκλοφορία',
        to: 'Ανάκληση / Επανεπεξεργασία',
        status: `ΑΝΑΚΛΗΣΗ φορτίου ${loadId} · ${reason}`,
        by: currentUser.name,
      });
    });
    setProcessLoads(list =>
      list.map(item =>
        item.id === loadId ? {...item, status: 'RECALLED', recalledAt: now, recallReason: reason} : item,
      ),
    );
    notify(`Το φορτίο ${loadId} ανακλήθηκε και τα αντικείμενα δεσμεύτηκαν για επανεπεξεργασία.`);
  };
  const completeWorkflowCheckpoint = (kind: AssetKind, id: string, payload: WorkflowCheckpointPayload) => {
    const a = assetName(kind, id);
    if (!a) return;
    const stage = sterilizationWorkflow.stages.find(s => s.id === payload.stageId);
    if (!stage) return;
    const requiredCount = stage.checksEl.length;
    if (payload.checks.length < requiredCount || payload.checks.slice(0, requiredCount).some(value => !value)) return;
    const record: WorkflowCheckpointRecord = {
      id: `wc${Date.now()}`,
      assetId: id,
      assetKind: kind,
      barcode: a.barcode,
      assetName: a.name,
      department: a.department || 'Τμήμα',
      stageId: payload.stageId,
      checks: payload.checks,
      note: payload.note,
      completedByUserId: currentUser.id,
      completedByName: currentUser.name,
      completedByDepartment: currentUser.department,
      completedAt: formatStoreDateTime(),
    };
    setWorkflowCheckpoints(x => [record, ...x]);
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
    notify(`${a.barcode}: ολοκληρώθηκε το στάδιο «${stage.labelEl}».`);
    return record;
  };
  const completeDeliveryToDepartment = (kind: AssetKind, id: string, payload: DeliveryPayload) => {
    const a = assetName(kind, id);
    if (!a || a.state !== 'READY_FOR_PICKUP') return;
    const record: DeliveryRecord = {
      id: `d${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
    notify(`Η παράδοση του ${a.barcode} στο ${a.department || 'τμήμα'} ολοκληρώθηκε.`);
    return record;
  };
  const recordCount = (p: Omit<SurgicalCount, 'id' | 'at' | 'by' | 'signed'>) => {
    const c: SurgicalCount = {...p, id: `c${Date.now()}`, at: formatStoreDateTime(), by: 'OR User', signed: true};
    setCounts(x => [c, ...x]);
    const s = sets.find(x => x.id === p.setId);
    if (s) {
      setSets(x => x.map(a => (a.id === p.setId ? {...a, actual: p.counted, patientCode: p.patientCode} : a)));
      if (p.counted !== p.expected || p.result !== 'OK')
        setIssues(x => [
          {
            id: `i${Date.now()}`,
            asset: `${s.barcode} · ${s.name}`,
            type: p.result === 'DAMAGE' ? 'Βλάβη' : 'Έλλειψη',
            status: 'OPEN',
            created: formatStoreDateTime(),
            department: s.department,
            note: p.note || `Αναμενόμενα ${p.expected} / καταμετρημένα ${p.counted}`,
          },
          ...x,
        ]);
      addMovement({
        asset: `${s.barcode} · ${s.name}`,
        assetKind: 'SET',
        from: s.department,
        to: s.department,
        status: 'Καταμέτρηση χειρουργείου υπογεγραμμένη',
        by: 'OR User',
        patientCode: p.patientCode,
      });
      notify(`Η καταμέτρηση ${s.barcode} καταγράφηκε και υπογράφηκε.`);
    }
  };
  const moveTool = (toolId: string, destination: 'STOCK' | 'SET' | 'SERVICE' | 'REMOVE', setId?: string) => {
    const t = tools.find(x => x.id === toolId);
    if (!t) return;
    const sourceSetId = t.mode === 'SET_MEMBER' ? t.setId : undefined;
    const sourceSet = sourceSetId ? sets.find(s => s.id === sourceSetId) : undefined;
    const from = sourceSet ? `Set ${sourceSet.barcode}` : t.mode === 'STOCK' ? 'Stock' : t.department || 'Τμήμα';
    if (destination === 'SET') {
      const target = sets.find(x => x.id === setId);
      if (!target || target.id === sourceSetId) return;
      setTools(x =>
        x.map(a =>
          a.id === toolId
            ? {...a, mode: 'SET_MEMBER', setId: target.id, department: target.department, state: target.state}
            : a,
        ),
      );
      setSets(x =>
        x.map(a =>
          a.id === sourceSetId
            ? {...a, actual: Math.max(0, a.actual - 1)}
            : a.id === target.id
              ? {...a, actual: a.actual + 1}
              : a,
        ),
      );
      addMovement({
        asset: `${t.barcode} · ${t.name}`,
        assetKind: 'TOOL',
        from,
        to: `Set ${target.barcode}`,
        status: 'Μεταφορά εργαλείου σε Set',
        by: currentUser.name,
      });
      notify(`${t.barcode} μετακινήθηκε στο ${target.barcode}.`);
      return;
    }
    if (destination === 'STOCK') {
      setTools(x =>
        x.map(a =>
          a.id === toolId ? {...a, mode: 'STOCK', setId: undefined, department: undefined, state: 'IN_STOCK'} : a,
        ),
      );
      if (sourceSetId) setSets(x => x.map(a => (a.id === sourceSetId ? {...a, actual: Math.max(0, a.actual - 1)} : a)));
      addMovement({
        asset: `${t.barcode} · ${t.name}`,
        assetKind: 'TOOL',
        from,
        to: 'Stock',
        status: 'Μεταφορά εργαλείου στο Stock',
        by: currentUser.name,
      });
      notify(`${t.barcode} μετακινήθηκε στο Stock.`);
      return;
    }
    if (destination === 'REMOVE') {
      setTools(x =>
        x.map(a =>
          a.id === toolId
            ? {
                ...a,
                mode: 'STANDALONE',
                setId: undefined,
                department: sourceSet?.department || a.department,
                state: 'IN_DEPARTMENT',
              }
            : a,
        ),
      );
      if (sourceSetId) setSets(x => x.map(a => (a.id === sourceSetId ? {...a, actual: Math.max(0, a.actual - 1)} : a)));
      addMovement({
        asset: `${t.barcode} · ${t.name}`,
        assetKind: 'TOOL',
        from,
        to: sourceSet?.department || 'Εκτός Set',
        status: 'Αφαίρεση εργαλείου από Set',
        by: currentUser.name,
      });
      notify(`${t.barcode} αφαιρέθηκε από το Set.`);
      return;
    }
    setTools(x =>
      x.map(a =>
        a.id === toolId ? {...a, mode: 'STANDALONE', setId: undefined, department: 'Service', state: 'SERVICE'} : a,
      ),
    );
    if (sourceSetId) setSets(x => x.map(a => (a.id === sourceSetId ? {...a, actual: Math.max(0, a.actual - 1)} : a)));
    if (!issues.some(i => i.status === 'OPEN' && i.asset.startsWith(t.barcode)))
      setIssues(x => [
        {
          id: `i${Date.now()}`,
          asset: `${t.barcode} · ${t.name}`,
          type: 'Βλάβη / Service',
          status: 'OPEN',
          created: formatStoreDateTime(),
          department: sourceSet?.department || t.department || 'Αποστείρωση',
          note: 'Αποστείρωση · σύνθεση & προετοιμασία: μεταφέρθηκε στα χαλασμένα / Service.',
        },
        ...x,
      ]);
    addMovement({
      asset: `${t.barcode} · ${t.name}`,
      assetKind: 'TOOL',
      from,
      to: 'Χαλασμένα / Service',
      status: 'Αφαίρεση από σύνθεση · προς Service',
      by: currentUser.name,
    });
    notify(`${t.barcode} μεταφέρθηκε στα Χαλασμένα / Service.`);
  };
  const replaceToolInSet = (
    setId: string,
    outgoingToolId: string,
    replacementToolId: string,
    outgoingDestination: 'STOCK' | 'SERVICE' | 'SET',
    outgoingSetId?: string,
  ) => {
    const target = sets.find(s => s.id === setId);
    const outgoing = tools.find(t => t.id === outgoingToolId);
    const replacement = tools.find(t => t.id === replacementToolId);
    if (!target || !outgoing || !replacement || outgoing.id === replacement.id || outgoing.setId !== target.id) return;
    const replacementSourceSetId = replacement.mode === 'SET_MEMBER' ? replacement.setId : undefined;
    const outgoingTargetSet = outgoingDestination === 'SET' ? sets.find(s => s.id === outgoingSetId) : undefined;
    if (outgoingDestination === 'SET' && !outgoingTargetSet) return;
    if (replacementSourceSetId === target.id) return;
    setTools(list =>
      list.map(tool => {
        if (tool.id === replacement.id)
          return {...tool, mode: 'SET_MEMBER', setId: target.id, department: target.department, state: target.state};
        if (tool.id !== outgoing.id) return tool;
        if (outgoingDestination === 'STOCK')
          return {...tool, mode: 'STOCK', setId: undefined, department: undefined, state: 'IN_STOCK'};
        if (outgoingDestination === 'SERVICE')
          return {...tool, mode: 'STANDALONE', setId: undefined, department: 'Service', state: 'SERVICE'};
        return {
          ...tool,
          mode: 'SET_MEMBER',
          setId: outgoingTargetSet!.id,
          department: outgoingTargetSet!.department,
          state: outgoingTargetSet!.state,
        };
      }),
    );
    const deltas: Record<string, number> = {};
    const addDelta = (id: string | undefined, delta: number) => {
      if (id) deltas[id] = (deltas[id] || 0) + delta;
    };
    addDelta(replacementSourceSetId, -1);
    if (outgoingDestination === 'SET') addDelta(outgoingTargetSet!.id, 1);
    setSets(list => list.map(s => (deltas[s.id] ? {...s, actual: Math.max(0, s.actual + deltas[s.id])} : s)));
    if (
      outgoingDestination === 'SERVICE' &&
      !issues.some(i => i.status === 'OPEN' && i.asset.startsWith(outgoing.barcode))
    )
      setIssues(x => [
        {
          id: `i${Date.now()}`,
          asset: `${outgoing.barcode} · ${outgoing.name}`,
          type: 'Βλάβη / Service',
          status: 'OPEN',
          created: formatStoreDateTime(),
          department: target.department,
          note: `Αποστείρωση · σύνθεση & προετοιμασία: αντικαταστάθηκε από ${replacement.barcode} και μεταφέρθηκε στα χαλασμένα / Service.`,
        },
        ...x,
      ]);
    addMovement({
      asset: `${outgoing.barcode} · ${outgoing.name}`,
      assetKind: 'TOOL',
      from: `Set ${target.barcode}`,
      to:
        outgoingDestination === 'STOCK'
          ? 'Stock'
          : outgoingDestination === 'SERVICE'
            ? 'Χαλασμένα / Service'
            : `Set ${outgoingTargetSet!.barcode}`,
      status: `Αντικατάσταση στη σύνθεση από ${replacement.barcode}`,
      by: currentUser.name,
    });
    const replacementFrom = replacementSourceSetId
      ? `Set ${sets.find(s => s.id === replacementSourceSetId)?.barcode || ''}`
      : replacement.mode === 'STOCK'
        ? 'Stock'
        : replacement.department || 'Μεμονωμένο σε χρήση';
    addMovement({
      asset: `${replacement.barcode} · ${replacement.name}`,
      assetKind: 'TOOL',
      from: replacementFrom,
      to: `Set ${target.barcode}`,
      status: `Αντικατάσταση εργαλείου ${outgoing.barcode}`,
      by: currentUser.name,
    });
    notify(`${outgoing.barcode} αντικαταστάθηκε από ${replacement.barcode} στο ${target.barcode}.`);
  };
  const reportIssue = (
    toolId: string,
    type: string,
    note: string,
    source = 'Αποστείρωση',
    photos: AssetPhoto[] = [],
  ) => {
    const t = tools.find(x => x.id === toolId);
    if (!t) return;
    const sourceSet = t.setId ? sets.find(s => s.id === t.setId) : undefined;
    setIssues(x => [
      {
        id: `i${Date.now()}`,
        asset: `${t.barcode} · ${t.name}`,
        type,
        status: 'OPEN',
        created: formatStoreDateTime(),
        department: sourceSet?.department || t.department || 'Stock',
        note: `${source}: ${note || type}`,
        photos,
      },
      ...x,
    ]);
    notify(`Καταγράφηκε αναφορά για ${t.barcode}.`);
  };
  const resolveIssues = (issueIds: string[], resolutionNote = 'Διαχειρίστηκε κατά τη σύνθεση & προετοιμασία') => {
    if (!issueIds.length) return;
    const ids = new Set(issueIds);
    setIssues(list =>
      list.map(issue =>
        ids.has(issue.id)
          ? {...issue, status: 'RESOLVED' as const, note: `${issue.note} · Επίλυση: ${resolutionNote}`}
          : issue,
      ),
    );
    notify(`${issueIds.length === 1 ? 'Η εκκρεμότητα επιλύθηκε.' : `${issueIds.length} εκκρεμότητες επιλύθηκαν.`}`);
  };
  const addAssetPhotos = (kind: AssetKind, id: string, photos: AssetPhoto[]) => {
    if (!photos.length) return;
    if (kind === 'SET') setSets(x => x.map(a => (a.id === id ? {...a, photos: [...(a.photos || []), ...photos]} : a)));
    else setTools(x => x.map(a => (a.id === id ? {...a, photos: [...(a.photos || []), ...photos]} : a)));
    notify(`${photos.length} ${photos.length === 1 ? 'φωτογραφία προστέθηκε' : 'φωτογραφίες προστέθηκαν'}.`);
  };
  const removeAssetPhoto = (kind: AssetKind, id: string, photoId: string) => {
    if (kind === 'SET')
      setSets(x =>
        x.map(a => (a.id === id ? {...a, photos: (a.photos || []).filter(photo => photo.id !== photoId)} : a)),
      );
    else
      setTools(x =>
        x.map(a => (a.id === id ? {...a, photos: (a.photos || []).filter(photo => photo.id !== photoId)} : a)),
      );
    notify('Η φωτογραφία αφαιρέθηκε.');
  };

  const nextBarcode = (kind: AssetKind) => {
    const prefix = kind === 'SET' ? 'S' : 'T';
    const barcodes = kind === 'SET' ? sets.map(asset => asset.barcode) : tools.map(asset => asset.barcode);
    const max = barcodes.reduce((current, barcode) => {
      const numeric = Number(barcode.replace(/\D/g, ''));
      return Number.isFinite(numeric) ? Math.max(current, numeric) : current;
    }, 0);
    return `${prefix}${String(max + 1).padStart(6, '0')}`;
  };
  const createTool = (p: CreateToolPayload) => {
    const department = p.department.trim();
    const mode: 'STOCK' | 'STANDALONE' = department ? 'STANDALONE' : 'STOCK';
    let max = tools.reduce((m, t) => Math.max(m, Number(t.barcode.replace(/\D/g, '')) || 0), 0);
    const stamp = Date.now();
    const created: Tool[] = Array.from({length: p.quantity}, (_, i) => ({
      id: `tool-${stamp}-${i}`,
      barcode: `T${String(++max).padStart(6, '0')}`,
      code: p.code,
      name: p.name,
      department: mode === 'STOCK' ? undefined : department,
      specialty: p.specialty.trim(),
      manufacturer: p.manufacturer?.trim() || undefined,
      mode,
      state: mode === 'STOCK' ? 'IN_STOCK' : 'IN_DEPARTMENT',
      uses: 0,
      maxUses: p.maxUses,
      sterilizations: 0,
      notes: p.notes,
      serialNumber: p.quantity === 1 ? p.serialNumber : undefined,
    }));
    setTools(x => [...created, ...x]);
    created.forEach(t =>
      addMovement({
        asset: `${t.barcode} · ${t.name}`,
        assetKind: 'TOOL',
        from: 'Δημιουργία',
        to: mode === 'STOCK' ? 'Stock εργαλείων' : department,
        status: `Δημιουργία φυσικού εργαλείου · ${mode === 'STOCK' ? 'αυτόματα στο Stock' : 'μεμονωμένο σε χρήση'}`,
        by: currentUser.name,
      }),
    );
    notify(`Δημιουργήθηκαν ${created.length} εργαλεία με μοναδικά barcodes${mode === 'STOCK' ? ' στο Stock' : ''}.`);
    return created.map(t => t.id);
  };
  const createSet = (p: CreateSetPayload) => {
    const barcode = nextBarcode('SET');
    const id = `set-${Date.now()}`;
    const department = p.department.trim();
    const inStock = !department;
    const state: AssetState = inStock ? 'IN_STOCK' : 'IN_DEPARTMENT';
    const asset: SetAsset = {
      id,
      barcode,
      code: p.code,
      name: p.name,
      department,
      specialty: p.specialty.trim(),
      manufacturer: p.manufacturer?.trim() || undefined,
      state,
      expected: p.toolIds.length,
      actual: p.toolIds.length,
      category: 'Χειρουργικά Set',
      createdAt: new Date().toLocaleDateString('el-GR'),
      uses: 0,
      maxUses: p.maxUses,
      notes: p.notes,
    };
    setSets(x => [asset, ...x]);
    setTools(x =>
      x.map(t =>
        p.toolIds.includes(t.id)
          ? {...t, mode: 'SET_MEMBER', setId: id, department: inStock ? undefined : department, state}
          : t,
      ),
    );
    addMovement({
      asset: `${barcode} · ${p.name}`,
      assetKind: 'SET',
      from: 'Δημιουργία',
      to: inStock ? 'Stock Σετ' : department,
      status: `Δημιουργία Set · ${p.toolIds.length} εργαλεία${inStock ? ' · αυτόματα ως ενιαίο Stock Σετ' : ''}`,
      by: currentUser.name,
    });
    notify(`${barcode}: το νέο Set δημιουργήθηκε${inStock ? ' αυτόματα στο Stock Σετ' : ''}.`);
    return id;
  };
  const reissueBarcode = (kind: AssetKind, id: string, reason = 'Επανέκδοση ετικέτας') => {
    const a = assetName(kind, id);
    if (!a) return;
    addMovement({
      asset: `${a.barcode} · ${a.name}`,
      assetKind: kind,
      from: 'Barcode',
      to: 'Barcode',
      status: `Επανέκδοση barcode · ${reason}`,
      by: currentUser.name,
    });
    notify(`${a.barcode}: καταγράφηκε επανέκδοση barcode.`);
  };
  const duplicateSet = (id: string, withTools = false) => {
    const src = sets.find(s => s.id === id);
    if (!src) return;
    const sourceTools = tools.filter(t => t.setId === id);
    const barcode = nextBarcode('SET');
    const newSetId = `set-${Date.now()}`;
    const copy: SetAsset = {
      ...src,
      id: newSetId,
      barcode,
      code: `${src.code}-COPY`,
      name: `${src.name} · ΑΝΤΙΓΡΑΦΟ`,
      actual: withTools ? sourceTools.length : 0,
      expected: withTools ? sourceTools.length : src.expected,
      state: 'IN_DEPARTMENT',
      createdAt: new Date().toLocaleDateString('el-GR'),
      photos: [],
    };
    setSets(x => [copy, ...x]);
    if (withTools) {
      let max = tools.reduce((m, t) => Math.max(m, Number(t.barcode.replace(/\D/g, '')) || 0), 0);
      const stamp = Date.now();
      const copies = sourceTools.map((t, i): Tool => ({
        ...t,
        id: `tool-${stamp}-${i}`,
        barcode: `T${String(++max).padStart(6, '0')}`,
        setId: newSetId,
        mode: 'SET_MEMBER',
        state: 'IN_DEPARTMENT',
        department: copy.department,
        uses: 0,
        sterilizations: 0,
        photos: [],
      }));
      setTools(x => [...copies, ...x]);
    }
    addMovement({
      asset: `${barcode} · ${copy.name}`,
      assetKind: 'SET',
      from: 'Πρότυπο',
      to: copy.department,
      status: `Δημιουργία από ${src.barcode} · ${withTools ? 'με νέα φυσικά αντίγραφα εργαλείων' : 'κενό Σετ χωρίς φυσικά εργαλεία'}`,
      by: currentUser.name,
    });
    notify(`${barcode}: δημιουργήθηκε ${withTools ? 'με αντίγραφα εργαλείων και νέα barcodes' : 'ως κενό Σετ'}.`);
  };
  const duplicateTool = (id: string) => {
    const src = tools.find(t => t.id === id);
    if (!src) return;
    const barcode = nextBarcode('TOOL');
    const newId = `tool-${Date.now()}`;
    const copy: Tool = {
      ...src,
      id: newId,
      barcode,
      code: `${src.code}-COPY`,
      name: `${src.name} · ΑΝΤΙΓΡΑΦΟ`,
      mode: 'STOCK',
      setId: undefined,
      department: undefined,
      state: 'IN_STOCK',
      uses: 0,
      sterilizations: 0,
      serialNumber: undefined,
      photos: [],
    };
    setTools(x => [copy, ...x]);
    addMovement({
      asset: `${barcode} · ${copy.name}`,
      assetKind: 'TOOL',
      from: `Αντίγραφο ${src.barcode}`,
      to: 'Stock',
      status: 'Δημιουργία νέου φυσικού εργαλείου από υπάρχουσα καρτέλα',
      by: currentUser.name,
    });
    notify(`${barcode}: δημιουργήθηκε νέο αντίγραφο εργαλείου στο Stock.`);
    return newId;
  };
  const deleteSet = (id: string, deleteTools = false) => {
    const src = sets.find(s => s.id === id);
    if (!src) return;
    const members = tools.filter(t => t.setId === id);
    setSets(x => x.filter(s => s.id !== id));
    if (deleteTools) setTools(x => x.filter(t => t.setId !== id));
    else
      setTools(x =>
        x.map(t =>
          t.setId === id
            ? {...t, setId: undefined, mode: 'STOCK' as const, state: 'IN_STOCK' as const, department: undefined}
            : t,
        ),
      );
    addMovement({
      asset: `${src.barcode} · ${src.name}`,
      assetKind: 'SET',
      from: src.department,
      to: deleteTools ? 'Διαγραφή' : 'Stock',
      status: deleteTools
        ? `Διαγραφή Σετ και ${members.length} εργαλείων`
        : `Διαγραφή Σετ · ${members.length} εργαλεία μεταφέρθηκαν στο Stock`,
      by: currentUser.name,
    });
    notify(
      deleteTools
        ? 'Το Σετ και τα εργαλεία του διαγράφηκαν.'
        : 'Το Σετ διαγράφηκε και τα εργαλεία μεταφέρθηκαν στο Stock.',
    );
  };
  const deleteTool = (id: string) => {
    const src = tools.find(t => t.id === id);
    if (!src) return;
    const parentSet = src.setId ? sets.find(s => s.id === src.setId) : undefined;
    setTools(x => x.filter(t => t.id !== id));
    if (parentSet) setSets(x => x.map(s => (s.id === parentSet.id ? {...s, actual: Math.max(0, s.actual - 1)} : s)));
    addMovement({
      asset: `${src.barcode} · ${src.name}`,
      assetKind: 'TOOL',
      from: parentSet ? `Set ${parentSet.barcode}` : src.mode === 'STOCK' ? 'Stock' : src.department || 'Μεμονωμένο',
      to: 'Διαγραφή',
      status: 'Οριστική διαγραφή φυσικού εργαλείου',
      by: currentUser.name,
    });
    notify(`${src.barcode}: το εργαλείο διαγράφηκε.`);
  };
  const reportSetIssue = (
    setId: string,
    targetToolIds: string[],
    type: string,
    note: string,
    photos: AssetPhoto[] = [],
    source = 'Καρτέλα Σετ',
  ) => {
    const src = sets.find(s => s.id === setId);
    if (!src) return;
    if (targetToolIds.length) {
      const selected = tools.filter(t => targetToolIds.includes(t.id));
      setIssues(x => [
        ...selected.map((t, i): Issue => ({
          id: `i${Date.now()}-${i}`,
          asset: `${t.barcode} · ${t.name}`,
          type,
          status: 'OPEN',
          created: formatStoreDateTime(),
          department: src.department,
          note: `${source} · Σετ ${src.barcode}: ${note || type}`,
          photos,
        })),
        ...x,
      ]);
      notify(`Καταγράφηκε αναφορά για ${selected.length} εργαλεία του ${src.barcode}.`);
      return;
    }
    setIssues(x => [
      {
        id: `i${Date.now()}`,
        asset: `${src.barcode} · ${src.name}`,
        type,
        status: 'OPEN',
        created: formatStoreDateTime(),
        department: src.department,
        note: `${source}: ${note || type}`,
        photos,
      },
      ...x,
    ]);
    notify(`Καταγράφηκε αναφορά για το Σετ ${src.barcode}.`);
  };
  const retireAsset = (kind: AssetKind, id: string) => {
    const a = assetName(kind, id);
    if (!a) return;
    updateState(kind, id, 'SERVICE');
    addMovement({
      asset: `${a.barcode} · ${a.name}`,
      assetKind: kind,
      from: a.department || 'Stock',
      to: 'Απόσυρση / Service',
      status: 'Απόσυρση από ενεργή χρήση',
      by: currentUser.name,
    });
    notify(`${a.barcode}: αποσύρθηκε από ενεργή χρήση.`);
  };
  const updateSet = (id: string, patch: SetUpdatePatch) => {
    const before = sets.find(s => s.id === id);
    if (!before) return;
    const barcodeChanged = patch.barcode && patch.barcode !== before.barcode;
    const normalizedBarcode = patch.barcode?.trim().toUpperCase();
    if (normalizedBarcode && sets.some(s => s.id !== id && s.barcode === normalizedBarcode)) {
      notify(`Το barcode ${normalizedBarcode} χρησιμοποιείται ήδη.`);
      return;
    }
    const requestedDepartment = (patch.department ?? before.department).trim();
    const departmentWasEdited = patch.department !== undefined;
    const nextState: AssetState = departmentWasEdited
      ? requestedDepartment
        ? 'IN_DEPARTMENT'
        : 'IN_STOCK'
      : (patch.state ?? before.state);
    const inStock = nextState === 'IN_STOCK';
    const department = inStock ? '' : requestedDepartment;
    if (!inStock && !department) {
      notify('Ορίστε Τμήμα για να βγει το Σετ από το Stock.');
      return;
    }
    const nextPatch = {
      ...patch,
      state: nextState,
      department,
      ...(normalizedBarcode ? {barcode: normalizedBarcode} : {}),
      ...(barcodeChanged ? {legacyBarcodes: [...(before.legacyBarcodes || []), before.barcode]} : {}),
    };
    setSets(list => list.map(s => (s.id === id ? {...s, ...nextPatch} : s)));
    if (inStock || department !== before.department || nextState !== before.state)
      setTools(list =>
        list.map(t =>
          t.setId === id
            ? {...t, mode: 'SET_MEMBER', department: inStock ? undefined : department, state: nextState}
            : t,
        ),
      );
    const changedBarcode = barcodeChanged ? ` · Barcode ${before.barcode} → ${normalizedBarcode}` : '';
    const stockChange =
      before.state !== nextState ? (inStock ? ' · Μεταφορά ολόκληρου Σετ στο Stock' : ' · Έξοδος Σετ από Stock') : '';
    addMovement({
      asset: `${before.barcode} · ${patch.name || before.name}`,
      assetKind: 'SET',
      from: 'Στοιχεία Σετ',
      to: inStock ? 'Stock Σετ' : 'Στοιχεία Σετ',
      status: `Επεξεργασία στοιχείων Σετ${changedBarcode}${stockChange}`,
      by: currentUser.name,
    });
    notify(`${normalizedBarcode || before.barcode}: οι αλλαγές αποθηκεύτηκαν.`);
  };
  const updateTool = (id: string, patch: ToolUpdatePatch) => {
    const before = tools.find(t => t.id === id);
    if (!before) return;
    const barcodeChanged = patch.barcode && patch.barcode !== before.barcode;
    const normalizedBarcode = patch.barcode?.trim().toUpperCase();
    if (normalizedBarcode && tools.some(t => t.id !== id && t.barcode === normalizedBarcode)) {
      notify(`Το barcode ${normalizedBarcode} χρησιμοποιείται ήδη.`);
      return;
    }
    const parentSet = before.setId ? sets.find(s => s.id === before.setId) : undefined;
    const departmentWasEdited = patch.department !== undefined;
    const requestedDepartment = (patch.department ?? before.department ?? '').trim();
    let mode = before.mode;
    let setId = before.setId;
    let state = patch.state ?? before.state;
    let invariantDepartment = before.department;
    if (before.mode === 'SET_MEMBER') {
      invariantDepartment = parentSet?.state === 'IN_STOCK' ? undefined : parentSet?.department;
      state = parentSet?.state ?? state;
    } else if (departmentWasEdited) {
      if (requestedDepartment) {
        mode = 'STANDALONE';
        setId = undefined;
        state = 'IN_DEPARTMENT';
        invariantDepartment = requestedDepartment;
      } else {
        mode = 'STOCK';
        setId = undefined;
        state = 'IN_STOCK';
        invariantDepartment = undefined;
      }
    } else if (before.mode === 'STOCK') {
      invariantDepartment = undefined;
      state = 'IN_STOCK';
    }
    const nextPatch = {
      ...patch,
      mode,
      setId,
      state,
      department: invariantDepartment,
      ...(normalizedBarcode ? {barcode: normalizedBarcode} : {}),
      ...(barcodeChanged ? {legacyBarcodes: [...(before.legacyBarcodes || []), before.barcode]} : {}),
    };
    setTools(list => list.map(t => (t.id === id ? {...t, ...nextPatch} : t)));
    const changedBarcode = barcodeChanged ? ` · Barcode ${before.barcode} → ${normalizedBarcode}` : '';
    const locationChange =
      before.mode !== mode ? (mode === 'STOCK' ? ' · Μεταφορά στο Stock' : ' · Μετατροπή σε μεμονωμένο σε χρήση') : '';
    addMovement({
      asset: `${before.barcode} · ${patch.name || before.name}`,
      assetKind: 'TOOL',
      from: 'Στοιχεία Εργαλείου',
      to: mode === 'STOCK' ? 'Stock εργαλείων' : 'Στοιχεία Εργαλείου',
      status: `Επεξεργασία στοιχείων εργαλείου${changedBarcode}${locationChange}`,
      by: currentUser.name,
    });
    notify(`${normalizedBarcode || before.barcode}: οι αλλαγές αποθηκεύτηκαν.`);
  };
  const addToolsToSet = (setId: string, toolIds: string[]) => {
    const target = sets.find(item => item.id === setId);
    if (!target || !toolIds.length) return;
    const chosen = tools.filter(item => toolIds.includes(item.id) && item.setId !== setId);
    setTools(list =>
      list.map(item =>
        toolIds.includes(item.id)
          ? {...item, mode: 'SET_MEMBER' as const, setId: target.id, department: target.department, state: target.state}
          : item,
      ),
    );
    setSets(list =>
      list.map(item => {
        const removed = chosen.filter(tool => tool.setId === item.id).length;
        if (item.id === target.id)
          return {
            ...item,
            actual: item.actual + chosen.length,
            expected: Math.max(item.expected, item.actual + chosen.length),
          };
        return removed ? {...item, actual: Math.max(0, item.actual - removed)} : item;
      }),
    );
    chosen.forEach(tool => {
      const from =
        tool.mode === 'STOCK'
          ? 'Stock'
          : tool.mode === 'SET_MEMBER'
            ? `Set ${sets.find(item => item.id === tool.setId)?.barcode || ''}`
            : tool.department || 'Μεμονωμένο σε χρήση';
      addMovement({
        asset: `${tool.barcode} · ${tool.name}`,
        assetKind: 'TOOL',
        from,
        to: `Set ${target.barcode}`,
        status: 'Προσθήκη εργαλείου στη σύνθεση Set',
        by: currentUser.name,
      });
    });
    notify(`${chosen.length} εργαλεία προστέθηκαν στο ${target.barcode}.`);
  };
  const lifecycleAlerts = useMemo(
    () => getLifecycleAlerts(sets, tools, systemSettings.usageWarningThreshold),
    [sets, tools, systemSettings.usageWarningThreshold],
  );

  const configureUsageLimit = (kind: AssetKind, id: string, maxUses?: number) => {
    const normalized = normalizeUsageLimit(maxUses);
    if (kind === 'SET') {
      setSets(list => list.map(item => (item.id === id ? {...item, maxUses: normalized, uses: item.uses || 0} : item)));
    } else {
      setTools(list => list.map(item => (item.id === id ? {...item, maxUses: normalized} : item)));
    }
    notify(normalized ? `Ορίστηκε όριο ${normalized} χρήσεων.` : 'Το όριο χρήσεων αφαιρέθηκε.');
  };
  const value = useMemo(
    () => ({
      sets,
      tools,
      movements,
      issues,
      counts,
      receipts,
      preparations,
      sterilizationCycles,
      processLoads,
      sterilizationReleases,
      workflowCheckpoints,
      deliveries,
      lifecycleAlerts,
      toast,
      role,
      activeDepartment,
      currentUser,
      permissions,
      can,
      setRole,
      sendToSterilization,
      receiveAtSterilization,
      recordPreparation,
      completeSterilizationCycle,
      createProcessLoad,
      releaseProcessLoad,
      recallProcessLoad,
      releaseSterilization,
      completeWorkflowCheckpoint,
      completeDeliveryToDepartment,
      configureUsageLimit,
      recordCount,
      moveTool,
      replaceToolInSet,
      reportIssue,
      resolveIssues,
      addAssetPhotos,
      removeAssetPhoto,
      nextBarcode,
      createTool,
      createSet,
      reissueBarcode,
      duplicateSet,
      duplicateTool,
      deleteSet,
      deleteTool,
      reportSetIssue,
      retireAsset,
      updateSet,
      updateTool,
      addToolsToSet,
      clearToast: () => setToast(undefined),
    }),
    [
      sets,
      tools,
      movements,
      issues,
      counts,
      receipts,
      preparations,
      sterilizationCycles,
      processLoads,
      sterilizationReleases,
      workflowCheckpoints,
      deliveries,
      lifecycleAlerts,
      toast,
      role,
    ],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useSurgi = () => {
  const x = useContext(Ctx);
  if (!x) throw new Error('useSurgi outside provider');
  return x;
};
