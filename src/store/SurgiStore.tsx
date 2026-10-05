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
  RecallCase,
} from '../types/domain';
import {
  findAsset,
  formatStoreDateTime,
  getActiveDepartment,
  getDemoSessionUser,
  getLifecycleAlerts,
  normalizeUsageLimit,
  uniqueStamp,
} from './helpers';
import {hasPermission, permissionsForRole} from '../core/permissions';
import type {SurgiInitialData} from '../data/repositories';
import type {CloudWorkspace} from '../data/cloud/CloudWorkspaceGate';
import {useAppRecordSync} from '../data/cloud/useAppRecordSync';
import {applyDemoSessionUser} from '../config/demoRoles';
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
  SessionUser,
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
import {renameComposition, staleCompositionLines} from '../core/nameCheck';
import {tr, trData} from '../i18n';
import type {ColorPlan} from '../core/colorTapes';

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

/** How long a management action can be taken back. */
const UNDO_SECONDS = 10;
const Ctx = createContext<SurgiStoreValue | null>(null);
export function SurgiProvider({
  children,
  dataMode = 'DEMO',
  cloud,
}: {
  children: ReactNode;
  dataMode?: SurgiDataMode;
  cloud?: CloudWorkspace | null;
}) {
  const repository = useMemo(() => getSurgiRepository(dataMode), [dataMode]);
  const {sterilizationWorkflow, rolePermissions, systemSettings} = useLibraries();
  const enabledStages = sterilizationWorkflow.stages.filter(stage => stage.enabled);
  const nextStateAfter = (stageId: WorkflowStageId): AssetState =>
    nextStateAfterStage(sterilizationWorkflow.stages, stageId) as AssetState;
  const reprocessState = (): AssetState => reprocessStateForStages(sterilizationWorkflow.stages) as AssetState;
  // With a cloud workspace every collection starts from what is stored for the organization.
  const [initialData] = useState(() =>
    cloud ? (cloud.records as unknown as SurgiInitialData) : repository.getInitialData(),
  );
  const [role, setRole] = useState<UserRole>(
    () => (sessionStorage.getItem('surgitrack-demo-role') as UserRole) || 'STERILIZATION',
  );
  // Bumped when the demo identity changes without a role change (one department to another).
  const [identityVersion, setIdentityVersion] = useState(0);
  const currentUser = getDemoSessionUser(role);
  const switchIdentity = (user: SessionUser) => {
    applyDemoSessionUser(user);
    setRole(user.role);
    setIdentityVersion(v => v + 1);
  };
  const activeDepartment = getActiveDepartment(role, currentUser);
  const supervisor = !!currentUser.supervisor;
  const permissions = permissionsForRole(role, rolePermissions, supervisor);
  const can = (permission: import('../core/permissions').Permission) =>
    hasPermission(role, permission, rolePermissions, supervisor);
  const [sets, setSets] = useState(initialData.sets);
  const [tools, setTools] = useState(() =>
    initialData.tools.map(tool =>
      tool.state === 'RETIRED'
        ? tool
        : tool.mode === 'STOCK'
          ? {...tool, department: undefined, state: 'IN_STOCK' as const}
          : tool.mode === 'SET_MEMBER'
            ? {...tool, department: initialData.sets.find(set => set.id === tool.setId)?.department || tool.department}
            : tool,
    ),
  );
  const [movements, setMovements] = useState(initialData.movements);
  const [issues, setIssues] = useState(initialData.issues);
  const [counts, setCounts] = useState<SurgicalCount[]>(initialData.counts || []);
  const [receipts, setReceipts] = useState<ReceiptRecord[]>(initialData.receipts || []);
  const [preparations, setPreparations] = useState<PreparationRecord[]>(initialData.preparations || []);
  const [sterilizationCycles, setSterilizationCycles] = useState<SterilizationCycleRecord[]>(
    initialData.sterilizationCycles || [],
  );
  const [processLoads, setProcessLoads] = useState<ProcessLoadRecord[]>(initialData.processLoads || []);
  const [recallCases, setRecallCases] = useState<RecallCase[]>(initialData.recallCases || []);
  const [sterilizationReleases, setSterilizationReleases] = useState<SterilizationReleaseRecord[]>(
    initialData.sterilizationReleases || [],
  );
  const [workflowCheckpoints, setWorkflowCheckpoints] = useState<WorkflowCheckpointRecord[]>(
    initialData.workflowCheckpoints || [],
  );
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>(initialData.deliveries || []);
  const cloudOrganizationId = cloud?.organizationId;
  useAppRecordSync(cloudOrganizationId, 'sets', sets);
  useAppRecordSync(cloudOrganizationId, 'tools', tools);
  useAppRecordSync(cloudOrganizationId, 'movements', movements);
  useAppRecordSync(cloudOrganizationId, 'issues', issues);
  useAppRecordSync(cloudOrganizationId, 'counts', counts);
  useAppRecordSync(cloudOrganizationId, 'receipts', receipts);
  useAppRecordSync(cloudOrganizationId, 'preparations', preparations);
  useAppRecordSync(cloudOrganizationId, 'sterilizationCycles', sterilizationCycles);
  useAppRecordSync(cloudOrganizationId, 'processLoads', processLoads);
  useAppRecordSync(cloudOrganizationId, 'recallCases', recallCases);
  useAppRecordSync(cloudOrganizationId, 'sterilizationReleases', sterilizationReleases);
  useAppRecordSync(cloudOrganizationId, 'workflowCheckpoints', workflowCheckpoints);
  useAppRecordSync(cloudOrganizationId, 'deliveries', deliveries);
  const [toast, setToast] = useState<Toast>();
  const notify = (text: string) => setToast({id: Date.now(), text});
  useEffect(() => {
    if (!toast) return;
    // An offer to undo stays long enough to read it and change one's mind.
    const timer = window.setTimeout(() => setToast(undefined), toast.undo ? UNDO_SECONDS * 1000 : 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const addMovement = (m: Omit<Movement, 'id' | 'at'>) =>
    setMovements(x => [{...m, id: `m${uniqueStamp()}`, at: formatStoreDateTime()}, ...x]);
  const assetName = (kind: AssetKind, id: string) => findAsset(kind, id, sets, tools);
  const isUsageExhausted = (kind: AssetKind, id: string) => {
    const asset = assetName(kind, id);
    if (!asset) return false;
    if (asset.maxUses && (asset.uses || 0) >= asset.maxUses) return true;
    if (kind === 'SET') {
      return tools.some(tool => tool.setId === id && tool.maxUses && (tool.uses || 0) >= tool.maxUses);
    }
    return false;
  };
  const isAssetRecalled = (kind: AssetKind, id: string) =>
    recallCases.some(
      c =>
        c.status === 'OPEN' &&
        c.items.some(item => item.assetKind === kind && item.assetId === id && item.status !== 'CLOSED'),
    );
  const assertCirculationAllowed = (kind: AssetKind, id: string) => {
    const asset = assetName(kind, id);
    if (!asset) return false;
    if (isUsageExhausted(kind, id)) {
      notify(tr('{0}: δεν επιτρέπεται η κυκλοφορία — έχει εξαντληθεί το όριο χρήσεων.', asset.barcode));
      return false;
    }
    if (isAssetRecalled(kind, id)) {
      notify(tr('{0}: δεν επιτρέπεται η κυκλοφορία — βρίσκεται σε ενεργή ανάκληση.', asset.barcode));
      return false;
    }
    return true;
  };
  const updateState = (kind: AssetKind, id: string, state: AssetState) => {
    if (kind === 'SET') {
      setSets(x => x.map(a => (a.id === id ? {...a, state} : a)));
      setTools(x => x.map(t => (t.setId === id ? {...t, state} : t)));
      return;
    }
    setTools(x => x.map(a => (a.id === id ? {...a, state} : a)));
  };
  /** Tools whose lives (limited uses) are consumed when this asset is dispatched after a procedure. */
  const livesConsumedBy = (kind: AssetKind, id: string) =>
    kind === 'TOOL'
      ? tools.filter(t => t.id === id && !!t.maxUses)
      : tools.filter(t => t.setId === id && !!t.maxUses && t.state !== 'RETIRED');
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
        limited.length ? ` · −1 ζωή σε ${limited.length} εργαλεί${limited.length === 1 ? 'ο' : 'α'}` : ''
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
  const recordCount = (p: Omit<SurgicalCount, 'id' | 'at' | 'by' | 'signed'>) => {
    const c: SurgicalCount = {
      ...p,
      id: `c${uniqueStamp()}`,
      at: formatStoreDateTime(),
      by: currentUser.name,
      signed: true,
    };
    setCounts(x => [c, ...x]);
    const s = sets.find(x => x.id === p.setId);
    if (s) {
      setSets(x => x.map(a => (a.id === p.setId ? {...a, actual: p.counted, patientCode: p.patientCode} : a)));
      if (p.counted !== p.expected || p.result !== 'OK')
        setIssues(x => [
          {
            id: `i${uniqueStamp()}`,
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
      notify(tr('Η καταμέτρηση {0} καταγράφηκε και υπογράφηκε.', s.barcode));
    }
  };
  const moveTool = (
    toolId: string,
    destination: 'STOCK' | 'SET' | 'SERVICE' | 'REMOVE',
    setId?: string,
    note?: string,
  ) => {
    const t = tools.find(x => x.id === toolId);
    if (!t) return;
    const sourceSetId = t.mode === 'SET_MEMBER' ? t.setId : undefined;
    const sourceSet = sourceSetId ? sets.find(s => s.id === sourceSetId) : undefined;
    const from = sourceSet ? `Set ${sourceSet.barcode}` : t.mode === 'STOCK' ? 'Απόθεμα' : t.department || 'Τμήμα';
    if (destination === 'SET') {
      const target = sets.find(x => x.id === setId);
      if (!target || target.id === sourceSetId) return;
      // A Set in the middle of reprocessing (or out of use) takes no new instrument: it would
      // inherit a sterile state without having gone through that Set's recorded cycle.
      if (target.state !== 'IN_DEPARTMENT' && target.state !== 'IN_STOCK') {
        notify(tr('Το Σετ {0} δεν δέχεται εργαλεία όσο βρίσκεται σε διαδικασία ή εκτός χρήσης.', target.barcode));
        return;
      }
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
      notify(tr('{0} μετακινήθηκε στο {1}.', t.barcode, target.barcode));
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
        to: 'Απόθεμα',
        status: 'Μεταφορά εργαλείου στο Απόθεμα',
        by: currentUser.name,
      });
      notify(tr('{0} μετακινήθηκε στο Απόθεμα.', t.barcode));
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
      notify(tr('{0} αφαιρέθηκε από το Set.', t.barcode));
      return;
    }
    setTools(x =>
      x.map(a =>
        a.id === toolId ? {...a, mode: 'STANDALONE', setId: undefined, department: 'Service', state: 'SERVICE'} : a,
      ),
    );
    if (sourceSetId) setSets(x => x.map(a => (a.id === sourceSetId ? {...a, actual: Math.max(0, a.actual - 1)} : a)));
    openIssue(
      t,
      'Βλάβη / Service',
      sourceSet?.department || t.department || 'Αποστείρωση',
      note || 'Αποστείρωση · σύνθεση & προετοιμασία: μεταφέρθηκε στα χαλασμένα / Service.',
    );
    addMovement({
      asset: `${t.barcode} · ${t.name}`,
      assetKind: 'TOOL',
      from,
      to: 'Χαλασμένα / Service',
      status: 'Αφαίρεση από σύνθεση · προς Service',
      by: currentUser.name,
      note: note || undefined,
    });
    notify(tr('{0} μεταφέρθηκε στα Χαλασμένα / Service.', t.barcode));
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
          id: `i${uniqueStamp()}`,
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
          ? 'Απόθεμα'
          : outgoingDestination === 'SERVICE'
            ? 'Χαλασμένα / Service'
            : `Set ${outgoingTargetSet!.barcode}`,
      status: `Αντικατάσταση στη σύνθεση από ${replacement.barcode}`,
      by: currentUser.name,
    });
    const replacementFrom = replacementSourceSetId
      ? `Set ${sets.find(s => s.id === replacementSourceSetId)?.barcode || ''}`
      : replacement.mode === 'STOCK'
        ? 'Απόθεμα'
        : replacement.department || 'Μεμονωμένο σε χρήση';
    addMovement({
      asset: `${replacement.barcode} · ${replacement.name}`,
      assetKind: 'TOOL',
      from: replacementFrom,
      to: `Set ${target.barcode}`,
      status: `Αντικατάσταση εργαλείου ${outgoing.barcode}`,
      by: currentUser.name,
    });
    notify(tr('{0} αντικαταστάθηκε από {1} στο {2}.', outgoing.barcode, replacement.barcode, target.barcode));
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
        id: `i${uniqueStamp()}`,
        asset: `${t.barcode} · ${t.name}`,
        type,
        status: 'OPEN',
        created: formatStoreDateTime(),
        department: sourceSet?.department || t.department || 'Απόθεμα',
        note: `${source}: ${note || type}`,
        photos,
      },
      ...x,
    ]);
    notify(tr('Καταγράφηκε αναφορά για {0}.', t.barcode));
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
    notify(
      issueIds.length === 1 ? tr('Η εκκρεμότητα επιλύθηκε.') : tr('{0} εκκρεμότητες επιλύθηκαν.', issueIds.length),
    );
  };
  const addAssetPhotos = (kind: AssetKind, id: string, photos: AssetPhoto[]) => {
    if (!photos.length) return;
    if (kind === 'SET') setSets(x => x.map(a => (a.id === id ? {...a, photos: [...(a.photos || []), ...photos]} : a)));
    else setTools(x => x.map(a => (a.id === id ? {...a, photos: [...(a.photos || []), ...photos]} : a)));
    notify(photos.length === 1 ? tr('1 φωτογραφία προστέθηκε.') : tr('{0} φωτογραφίες προστέθηκαν.', photos.length));
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
    notify(tr('Η φωτογραφία αφαιρέθηκε.'));
  };

  const nextBarcode = (kind: AssetKind) => {
    const prefix = kind === 'SET' ? 'S' : 'T';
    // Retired (legacy) barcodes are never handed out again.
    const assets: Array<{barcode: string; legacyBarcodes?: string[]}> = kind === 'SET' ? sets : tools;
    const barcodes = assets.flatMap(asset => [asset.barcode, ...(asset.legacyBarcodes || [])]);
    const max = barcodes.reduce((current, barcode) => {
      const numeric = Number(barcode.replace(/\D/g, ''));
      return Number.isFinite(numeric) ? Math.max(current, numeric) : current;
    }, 0);
    return `${prefix}${String(max + 1).padStart(6, '0')}`;
  };
  const createTool = (p: CreateToolPayload) => {
    const department = p.department.trim();
    const mode: 'STOCK' | 'STANDALONE' = department ? 'STANDALONE' : 'STOCK';
    let max = tools
      .flatMap(t => [t.barcode, ...(t.legacyBarcodes || [])])
      .reduce((m, barcode) => Math.max(m, Number(barcode.replace(/\D/g, '')) || 0), 0);
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
        to: mode === 'STOCK' ? 'Απόθεμα εργαλείων' : department,
        status: `Δημιουργία φυσικού εργαλείου · ${mode === 'STOCK' ? 'αυτόματα στο Απόθεμα' : 'μεμονωμένο σε χρήση'}`,
        by: currentUser.name,
      }),
    );
    notify(
      mode === 'STOCK'
        ? tr('Δημιουργήθηκαν {0} εργαλεία με μοναδικά barcodes στο Απόθεμα.', created.length)
        : tr('Δημιουργήθηκαν {0} εργαλεία με μοναδικά barcodes.', created.length),
    );
    return created.map(t => t.id);
  };
  const createSet = (p: CreateSetPayload) => {
    const barcode = nextBarcode('SET');
    const id = `set-${uniqueStamp()}`;
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
      to: inStock ? 'Απόθεμα Σετ' : department,
      status: `Δημιουργία Set · ${p.toolIds.length} εργαλεία${inStock ? ' · αυτόματα ως ενιαίο Απόθεμα Σετ' : ''}`,
      by: currentUser.name,
    });
    notify(
      inStock
        ? tr('{0}: το νέο Set δημιουργήθηκε αυτόματα στο Απόθεμα Σετ.', barcode)
        : tr('{0}: το νέο Set δημιουργήθηκε.', barcode),
    );
    return id;
  };
  /**
   * A new barcode for a Set or instrument (label lost, damaged or duplicated): the next free number,
   * the old one kept as a legacy barcode so scanning an old label still finds the item.
   */
  const reissueBarcode = (kind: AssetKind, id: string, reason = 'Επανέκδοση ετικέτας') => {
    const a = assetName(kind, id);
    if (!a) return '';
    const next = nextBarcode(kind);
    const patch = {barcode: next, legacyBarcodes: [...(a.legacyBarcodes || []), a.barcode]};
    if (kind === 'SET') setSets(x => x.map(s => (s.id === id ? {...s, ...patch} : s)));
    else setTools(x => x.map(t => (t.id === id ? {...t, ...patch} : t)));
    addMovement({
      asset: `${next} · ${a.name}`,
      assetKind: kind,
      from: a.barcode,
      to: next,
      status: `Νέο barcode · ${reason}`,
      by: currentUser.name,
    });
    notify(tr('{0}: νέο barcode {1}. Το παλιό μένει στο ιστορικό.', a.barcode, next));
    return next;
  };
  const duplicateSet = (id: string, withTools = false) => {
    const src = sets.find(s => s.id === id);
    if (!src) return;
    const sourceTools = tools.filter(t => t.setId === id);
    const barcode = nextBarcode('SET');
    const newSetId = `set-${uniqueStamp()}`;
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
      importBatch: undefined,
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
        importBatch: undefined,
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
    notify(
      withTools
        ? tr('{0}: δημιουργήθηκε με αντίγραφα εργαλείων και νέα barcodes.', barcode)
        : tr('{0}: δημιουργήθηκε ως κενό Σετ.', barcode),
    );
  };
  const duplicateTool = (id: string) => {
    const src = tools.find(t => t.id === id);
    if (!src) return;
    const barcode = nextBarcode('TOOL');
    const newId = `tool-${uniqueStamp()}`;
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
      importBatch: undefined,
    };
    setTools(x => [copy, ...x]);
    addMovement({
      asset: `${barcode} · ${copy.name}`,
      assetKind: 'TOOL',
      from: `Αντίγραφο ${src.barcode}`,
      to: 'Απόθεμα',
      status: 'Δημιουργία νέου φυσικού εργαλείου από υπάρχουσα καρτέλα',
      by: currentUser.name,
    });
    notify(tr('{0}: δημιουργήθηκε νέο αντίγραφο εργαλείου στο Απόθεμα.', barcode));
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
      to: deleteTools ? 'Διαγραφή' : 'Απόθεμα',
      status: deleteTools
        ? `Διαγραφή Σετ και ${members.length} εργαλείων`
        : `Διαγραφή Σετ · ${members.length} εργαλεία μεταφέρθηκαν στο Απόθεμα`,
      by: currentUser.name,
    });
    notify(
      deleteTools
        ? tr('Το Σετ και τα εργαλεία του διαγράφηκαν.')
        : tr('Το Σετ διαγράφηκε και τα εργαλεία μεταφέρθηκαν στο Απόθεμα.'),
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
      from: parentSet ? `Set ${parentSet.barcode}` : src.mode === 'STOCK' ? 'Απόθεμα' : src.department || 'Μεμονωμένο',
      to: 'Διαγραφή',
      status: 'Οριστική διαγραφή φυσικού εργαλείου',
      by: currentUser.name,
    });
    notify(tr('{0}: το εργαλείο διαγράφηκε.', src.barcode));
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
          id: `i${uniqueStamp()}-${i}`,
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
      notify(tr('Καταγράφηκε αναφορά για {0} εργαλεία του {1}.', selected.length, src.barcode));
      return;
    }
    setIssues(x => [
      {
        id: `i${uniqueStamp()}`,
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
    notify(tr('Καταγράφηκε αναφορά για το Σετ {0}.', src.barcode));
  };
  /** Opens an issue on the asset unless one of the same kind is already open. */
  const openIssue = (asset: {barcode: string; name: string}, type: string, department: string, note: string) =>
    // Checked against the latest list, so a report closed by the same action does not block it.
    setIssues(x =>
      x.some(i => i.status === 'OPEN' && i.type === type && i.asset.startsWith(asset.barcode))
        ? x
        : [
            {
              id: `i${uniqueStamp()}`,
              asset: `${asset.barcode} · ${asset.name}`,
              type,
              status: 'OPEN',
              created: formatStoreDateTime(),
              department,
              note,
            },
            ...x,
          ],
    );
  /** Declares a Set or instrument lost: an instrument leaves its Set; an issue records the loss. */
  const markLost = (kind: AssetKind, id: string, note = '') => {
    const a = assetName(kind, id);
    if (!a) return;
    const tool = kind === 'TOOL' ? tools.find(t => t.id === id) : undefined;
    const sourceSet = tool?.setId ? sets.find(s => s.id === tool.setId) : undefined;
    const from = sourceSet ? `Set ${sourceSet.barcode}` : a.department || 'Απόθεμα';
    if (tool) {
      setTools(x =>
        x.map(t =>
          t.id === id ? {...t, mode: 'STANDALONE', setId: undefined, department: undefined, state: 'LOST'} : t,
        ),
      );
      if (sourceSet) setSets(x => x.map(s => (s.id === sourceSet.id ? {...s, actual: Math.max(0, s.actual - 1)} : s)));
    } else {
      updateState('SET', id, 'LOST');
    }
    openIssue(a, 'Απώλεια', sourceSet?.department || a.department || 'Αποστείρωση', note || 'Δηλώθηκε ως χαμένο.');
    addMovement({
      asset: `${a.barcode} · ${a.name}`,
      assetKind: kind,
      from,
      to: 'Απολεσθέντα',
      status: 'Δήλωση απώλειας',
      by: currentUser.name,
      note: note || undefined,
    });
    notify(tr('{0}: δηλώθηκε ως χαμένο.', a.barcode));
  };
  /** Brings a lost or serviced asset back: an instrument to stock, a Set to stock or its department. */
  const returnToService = (kind: AssetKind, id: string, note = '') => {
    const a = assetName(kind, id);
    if (!a) return;
    const was = a.state === 'LOST' ? 'Απολεσθέντα' : 'Χαλασμένα / Service';
    if (kind === 'TOOL') {
      const parentSetId = tools.find(t => t.id === id)?.setId;
      setTools(x =>
        x.map(t =>
          t.id === id ? {...t, mode: 'STOCK', setId: undefined, department: undefined, state: 'IN_STOCK'} : t,
        ),
      );
      if (parentSetId) setSets(x => x.map(s => (s.id === parentSetId ? {...s, actual: Math.max(0, s.actual - 1)} : s)));
    } else {
      updateState('SET', id, a.department ? 'IN_DEPARTMENT' : 'IN_STOCK');
    }
    setIssues(x =>
      x.map(i =>
        i.status === 'OPEN' && i.asset.startsWith(a.barcode) && (i.type === 'Απώλεια' || i.type === 'Βλάβη / Service')
          ? {...i, status: 'RESOLVED'}
          : i,
      ),
    );
    addMovement({
      asset: `${a.barcode} · ${a.name}`,
      assetKind: kind,
      from: was,
      to: kind === 'TOOL' || !a.department ? 'Απόθεμα' : a.department,
      status: a.state === 'LOST' ? 'Βρέθηκε · επιστροφή σε χρήση' : 'Επιστροφή από Service',
      by: currentUser.name,
      note: note || undefined,
    });
    notify(tr('{0}: επέστρεψε σε χρήση.', a.barcode));
  };
  const assignDepartment = (kind: AssetKind, id: string, department: string, note = '') => {
    const target = department.trim();
    const a = assetName(kind, id);
    if (!a || !target || a.department === target) return;
    if (a.state !== 'IN_DEPARTMENT' && a.state !== 'IN_STOCK') {
      notify(tr('{0}: το τμήμα αλλάζει μόνο όταν δεν βρίσκεται σε διαδικασία ή εκτός χρήσης.', a.barcode));
      return;
    }
    if (kind === 'SET') {
      // The Set's instruments go with it.
      setSets(x => x.map(s => (s.id === id ? {...s, department: target, state: 'IN_DEPARTMENT'} : s)));
      setTools(x => x.map(t => (t.setId === id ? {...t, department: target, state: 'IN_DEPARTMENT'} : t)));
    } else {
      const tool = tools.find(t => t.id === id);
      if (!tool || tool.mode === 'SET_MEMBER') return;
      setTools(x =>
        x.map(t =>
          t.id === id ? {...t, mode: 'STANDALONE', setId: undefined, department: target, state: 'IN_DEPARTMENT'} : t,
        ),
      );
    }
    addMovement({
      asset: `${a.barcode} · ${a.name}`,
      assetKind: kind,
      from: a.department || 'Απόθεμα',
      to: target,
      status: a.department ? 'Αλλαγή τμήματος' : 'Καταχώρηση σε τμήμα',
      by: currentUser.name,
      note: note || undefined,
    });
    notify(tr('{0}: καταχωρήθηκε στο τμήμα {1}.', a.barcode, trData(target)));
  };
  const undoable = (label: string, run: () => void) => {
    const before = {sets, tools, issues};
    run();
    const undo = () => {
      const revert =
        <T extends {id: string}>(previous: T[]) =>
        (list: T[]) => {
          const old = new Map(previous.map(r => [r.id, r]));
          const now = new Set(list.map(r => r.id));
          // Records the action created go; changed ones get their earlier version; removed ones return.
          return [...previous.filter(r => !now.has(r.id)), ...list.filter(r => old.has(r.id)).map(r => old.get(r.id)!)];
        };
      setSets(revert(before.sets));
      setTools(revert(before.tools));
      // Problem reports are never deleted: one the action opened is closed as taken back.
      const oldIssues = new Map(before.issues.map(i => [i.id, i]));
      setIssues(list =>
        list.map(i =>
          oldIssues.has(i.id)
            ? oldIssues.get(i.id)!
            : i.status === 'OPEN'
              ? {...i, status: 'RESOLVED', note: `${i.note} · Αναιρέθηκε`}
              : i,
        ),
      );
      addMovement({
        asset: label,
        assetKind: 'TOOL',
        from: '—',
        to: '—',
        status: 'Αναίρεση ενέργειας',
        by: currentUser.name,
        note: label,
      });
      setToast({id: Date.now(), text: tr('Η ενέργεια αναιρέθηκε.')});
    };
    // The action's own message, now with the offer to take it back.
    setToast(current => ({id: Date.now(), text: current?.text || label, undo}));
  };
  /** Sends a whole Set to service: it leaves circulation until it comes back. */
  const sendSetToService = (id: string, note = '') => {
    const s = sets.find(x => x.id === id);
    if (!s) return;
    updateState('SET', id, 'SERVICE');
    openIssue(s, 'Βλάβη / Service', s.department || 'Αποστείρωση', note || 'Το Σετ στάλθηκε για Service.');
    addMovement({
      asset: `${s.barcode} · ${s.name}`,
      assetKind: 'SET',
      from: s.department || 'Απόθεμα',
      to: 'Χαλασμένα / Service',
      status: 'Αποστολή Σετ σε Service',
      by: currentUser.name,
      note: note || undefined,
    });
    notify(tr('{0} μεταφέρθηκε στα Χαλασμένα / Service.', s.barcode));
  };
  /** Sets the color marker of a Set or an instrument; the history records it in words. */
  const setColorMarker = (
    kind: AssetKind,
    id: string,
    value: {mode?: 'SET' | 'OWN' | 'NONE'; tapes: string[]},
    description: string,
  ) => {
    const a = assetName(kind, id);
    if (!a) return;
    // Like every other change to the item, the marker is locked during a reprocessing cycle.
    if (!['IN_DEPARTMENT', 'IN_STOCK', 'SERVICE', 'LOST'].includes(a.state)) {
      notify(tr('{0}: ο χρωματικός μάρτυρας δεν αλλάζει όσο βρίσκεται σε διαδικασία αποστείρωσης.', a.barcode));
      return;
    }
    if (kind === 'SET') setSets(x => x.map(s => (s.id === id ? {...s, colorTapes: value.tapes} : s)));
    else setTools(x => x.map(t => (t.id === id ? {...t, colorMode: value.mode, colorTapes: value.tapes} : t)));
    addMovement({
      asset: `${a.barcode} · ${a.name}`,
      assetKind: kind,
      from: a.department || 'Απόθεμα',
      to: a.department || 'Απόθεμα',
      status: `Χρωματικός μάρτυρας: ${description}`,
      by: currentUser.name,
    });
    notify(tr('{0}: ο χρωματικός μάρτυρας ενημερώθηκε.', a.barcode));
  };
  /** After instruments joined a Set: the ones that take its color, and the ones that keep their tape. */
  const applyColorPlan = (plan: ColorPlan, setBarcode: string) => {
    const follow = new Set(plan.follow);
    const keep = new Map(plan.keep.map(k => [k.id, k.tapes]));
    if (!follow.size && !keep.size) return;
    setTools(x =>
      x.map(t =>
        follow.has(t.id)
          ? {...t, colorMode: 'SET', colorTapes: []}
          : keep.has(t.id)
            ? {...t, colorMode: 'OWN', colorTapes: keep.get(t.id)}
            : t,
      ),
    );
    tools
      .filter(t => follow.has(t.id) || keep.has(t.id))
      .forEach(t =>
        addMovement({
          asset: `${t.barcode} · ${t.name}`,
          assetKind: 'TOOL',
          from: `Set ${setBarcode}`,
          to: `Set ${setBarcode}`,
          status: follow.has(t.id)
            ? 'Χρωματικός μάρτυρας: όπως το Σετ · αλλαγή ταινίας'
            : 'Χρωματικός μάρτυρας: κρατά την ταινία του',
          by: currentUser.name,
        }),
      );
  };
  const retireAsset = (kind: AssetKind, id: string) => {
    const a = assetName(kind, id);
    if (!a) return;
    updateState(kind, id, 'SERVICE');
    addMovement({
      asset: `${a.barcode} · ${a.name}`,
      assetKind: kind,
      from: a.department || 'Απόθεμα',
      to: 'Απόσυρση / Service',
      status: 'Απόσυρση από ενεργή χρήση',
      by: currentUser.name,
    });
    notify(tr('{0}: αποσύρθηκε από ενεργή χρήση.', a.barcode));
  };
  /** Lives (usage limits) change only by the admin or the Sterilization supervisor. */
  const withoutUsageUnlessAllowed = <T extends {maxUses?: number}>(patch: T): T => {
    if (!('maxUses' in patch) || can('asset.usage.configure')) return patch;
    const rest = {...patch};
    delete rest.maxUses;
    return rest;
  };
  const updateSet = (id: string, rawPatch: SetUpdatePatch) => {
    const patch = withoutUsageUnlessAllowed(rawPatch);
    const before = sets.find(s => s.id === id);
    if (!before) return;
    const barcodeChanged = patch.barcode && patch.barcode !== before.barcode;
    const normalizedBarcode = patch.barcode?.trim().toUpperCase();
    if (normalizedBarcode && sets.some(s => s.id !== id && s.barcode === normalizedBarcode)) {
      notify(tr('Το barcode {0} χρησιμοποιείται ήδη.', normalizedBarcode));
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
      notify(tr('Ορίστε Τμήμα για να βγει το Σετ από το Απόθεμα.'));
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
      before.state !== nextState
        ? inStock
          ? ' · Μεταφορά ολόκληρου Σετ στο Απόθεμα'
          : ' · Έξοδος Σετ από Απόθεμα'
        : '';
    addMovement({
      asset: `${before.barcode} · ${patch.name || before.name}`,
      assetKind: 'SET',
      from: 'Στοιχεία Σετ',
      to: inStock ? 'Απόθεμα Σετ' : 'Στοιχεία Σετ',
      status: `Επεξεργασία στοιχείων Σετ${changedBarcode}${stockChange}`,
      by: currentUser.name,
    });
    notify(tr('{0}: οι αλλαγές αποθηκεύτηκαν.', normalizedBarcode || before.barcode));
  };
  const updateTool = (id: string, rawPatch: ToolUpdatePatch) => {
    const patch = withoutUsageUnlessAllowed(rawPatch);
    const before = tools.find(t => t.id === id);
    if (!before) return;
    const barcodeChanged = patch.barcode && patch.barcode !== before.barcode;
    const normalizedBarcode = patch.barcode?.trim().toUpperCase();
    if (normalizedBarcode && tools.some(t => t.id !== id && t.barcode === normalizedBarcode)) {
      notify(tr('Το barcode {0} χρησιμοποιείται ήδη.', normalizedBarcode));
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
      before.mode !== mode
        ? mode === 'STOCK'
          ? ' · Μεταφορά στο Απόθεμα'
          : ' · Μετατροπή σε μεμονωμένο σε χρήση'
        : '';
    addMovement({
      asset: `${before.barcode} · ${patch.name || before.name}`,
      assetKind: 'TOOL',
      from: 'Στοιχεία Εργαλείου',
      to: mode === 'STOCK' ? 'Απόθεμα εργαλείων' : 'Στοιχεία Εργαλείου',
      status: `Επεξεργασία στοιχείων εργαλείου${changedBarcode}${locationChange}`,
      by: currentUser.name,
    });
    notify(tr('{0}: οι αλλαγές αποθηκεύτηκαν.', normalizedBarcode || before.barcode));
  };
  const renameTools = (changes: Array<{id: string; name: string}>, label: string) => {
    const byId = new Map(changes.map(c => [c.id, c.name.trim()]));
    const changing = tools.filter(t => byId.has(t.id) && byId.get(t.id) && byId.get(t.id) !== t.name);
    if (!changing.length) return;
    // A Set's composition lists the same instruments by code and name: those names follow.
    const renamed = new Map(changing.map(t => [`${(t.code || '').trim().toUpperCase()}|${t.name}`, byId.get(t.id)!]));
    const follow = (code: string, name: string) => renamed.get(`${code.trim().toUpperCase()}|${name}`);
    undoable(label, () => {
      setTools(list => list.map(t => (byId.has(t.id) && byId.get(t.id) ? {...t, name: byId.get(t.id)!} : t)));
      setSets(list =>
        list.map(set => {
          const compositionTemplate = renameComposition(set.compositionTemplate, follow);
          return compositionTemplate ? {...set, compositionTemplate} : set;
        }),
      );
      addMovement({
        asset: label,
        assetKind: 'TOOL',
        from: 'Ονομασίες εργαλείων',
        to: 'Ονομασίες εργαλείων',
        status: `Έλεγχος ονομασιών · ${changing.length} εργαλεία`,
        by: currentUser.name,
        note: label,
      });
      notify(tr('Άλλαξε η ονομασία σε {0} εργαλεία.', changing.length));
    });
  };
  /** Brings Set compositions in line with the instruments' names (for names changed before they followed). */
  const syncCompositionNames = () => {
    const follow = staleCompositionLines(tools);
    const updated = sets
      .map(set => ({set, compositionTemplate: renameComposition(set.compositionTemplate, follow)}))
      .filter(x => x.compositionTemplate);
    if (!updated.length) return;
    const byId = new Map(updated.map(x => [x.set.id, x.compositionTemplate!]));
    undoable(tr('Συνθέσεις Σετ: ονομασίες σε {0} Σετ', updated.length), () => {
      setSets(list => list.map(set => (byId.has(set.id) ? {...set, compositionTemplate: byId.get(set.id)} : set)));
      addMovement({
        asset: tr('Συνθέσεις Σετ'),
        assetKind: 'SET',
        from: 'Ονομασίες εργαλείων',
        to: 'Συνθέσεις Σετ',
        status: `Έλεγχος ονομασιών · συνθέσεις ${updated.length} Σετ`,
        by: currentUser.name,
      });
      notify(tr('Ενημερώθηκαν οι συνθέσεις {0} Σετ.', updated.length));
    });
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
          ? 'Απόθεμα'
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
    notify(tr('{0} εργαλεία προστέθηκαν στο {1}.', chosen.length, target.barcode));
  };
  const lifecycleAlerts = useMemo(
    () =>
      getLifecycleAlerts(
        sets,
        tools.filter(t => t.state !== 'RETIRED'),
        systemSettings.usageWarningThreshold,
      ),
    [sets, tools, systemSettings.usageWarningThreshold],
  );

  const configureUsageLimit = (kind: AssetKind, id: string, maxUses?: number) => {
    if (!can('asset.usage.configure')) return;
    const normalized = normalizeUsageLimit(maxUses);
    if (kind === 'SET') {
      setSets(list => list.map(item => (item.id === id ? {...item, maxUses: normalized, uses: item.uses || 0} : item)));
    } else {
      setTools(list => list.map(item => (item.id === id ? {...item, maxUses: normalized} : item)));
    }
    notify(normalized ? tr('Ορίστηκε όριο {0} χρήσεων.', normalized) : tr('Το όριο χρήσεων αφαιρέθηκε.'));
  };
  const activeTools = useMemo(() => tools.filter(t => t.state !== 'RETIRED'), [tools]);
  const retiredTools = useMemo(() => tools.filter(t => t.state === 'RETIRED'), [tools]);
  const value = useMemo(
    () => ({
      sets,
      tools: activeTools,
      retiredTools,
      movements,
      issues,
      counts,
      receipts,
      preparations,
      sterilizationCycles,
      processLoads,
      recallCases,
      sterilizationReleases,
      workflowCheckpoints,
      deliveries,
      organizationId: cloudOrganizationId,
      organizationName: cloud?.organizationName,
      lifecycleAlerts,
      toast,
      role,
      activeDepartment,
      currentUser,
      permissions,
      can,
      setRole,
      switchIdentity,
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
      acknowledgeOutOfUse,
      reportSetIssue,
      retireAsset,
      setColorMarker,
      applyColorPlan,
      markLost,
      returnToService,
      sendSetToService,
      assignDepartment,
      undoable,
      updateSet,
      updateTool,
      renameTools,
      syncCompositionNames,
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
      recallCases,
      sterilizationReleases,
      workflowCheckpoints,
      deliveries,
      lifecycleAlerts,
      toast,
      role,
      identityVersion,
      cloudOrganizationId,
    ],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useSurgi = () => {
  const x = useContext(Ctx);
  if (!x) throw new Error('useSurgi outside provider');
  return x;
};
