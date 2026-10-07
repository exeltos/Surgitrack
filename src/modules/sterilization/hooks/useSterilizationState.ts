import {useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {useSurgi} from '../../../store/SurgiStore';
import {useLibraries} from '../../../core/LibraryStore';
import {DEFAULT_SHELF_LIFE, isShelfLife} from '../../../core/sterileExpiry';
import type {WorkflowStageId} from '../../../core/workflow';
import type {AssetPhoto, ReceiptCheckResult, ReceiptRecord} from '../../../types/domain';
import {useSetColorQuestion} from '../../../components/assets/useSetColorQuestion';
import {useCompositionOptions} from '../../../components/assets/usePrintLook';
import type {Queue, Kind, AssetDraft, Identity} from '../sterilizationTypes';

export function useSterilizationState() {
  const {
    sets,
    tools,
    sterilizationReleases,
    organizationName,
    receiveAtSterilization,
    recordPreparation,
    releaseSterilization,
    completeWorkflowCheckpoint,
    completeDeliveryToDepartment,
    createProcessLoad,
    releaseProcessLoad,
    finishProcessLoad,
    recordBiologicalResult,
    recallProcessLoad,
    processLoads,
    recallCases,
    issues,
    sterilizationCycles,
    currentUser,
    reportIssue,
    reportSetIssue,
    resolveIssues,
    moveTool,
    replaceToolInSet,
    applyColorPlan,
    can,
  } = useSurgi();
  const colorQuestion = useSetColorQuestion();
  // Set changes (cover a shortage, replace, service, stock, another Set) are the supervisor's.
  const canCompose = can('asset.composition.manage');
  const {sterilizationWorkflow, systemSettings, sterilizers: sterilizerLibrary} = useLibraries();
  /** The hospital's sterilizers by name (Studio › Libraries › Sterilizers). */
  const sterilizerNames = sterilizerLibrary.map(item => item.el);
  const defaultSterilizer = sterilizerNames[0] || 'Κλίβανος 1';
  const compositionOptions = useCompositionOptions();
  const activeStages = sterilizationWorkflow.stages.filter(stage => stage.enabled);
  const stageEnabled = (id: WorkflowStageId) => activeStages.some(stage => stage.id === id);
  const QUEUES: Queue[] = [
    'INCOMING',
    'WASHING',
    'PREP',
    'PACKAGING',
    'PROCESS',
    'IN_STERILIZER',
    'RELEASE',
    'STORAGE',
    'READY',
  ];
  const [searchParams] = useSearchParams();
  // A link can open a given stage, e.g. /sterilization?queue=READY from the overview.
  const requestedQueue = searchParams.get('queue') as Queue | null;
  const [queue, setQueue] = useState<Queue>(
    requestedQueue && QUEUES.includes(requestedQueue) ? requestedQueue : 'INCOMING',
  );
  const [query, setQuery] = useState('');
  const [quickBarcode, setQuickBarcode] = useState('');
  const [quickScanFeedback, setQuickScanFeedback] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const [kindFilter, setKindFilter] = useState('');
  const [receiptDraft, setReceiptDraft] = useState<AssetDraft | null>(null);
  const [receiptView, setReceiptView] = useState<ReceiptRecord | null>(null);
  const [receiptBatchOpen, setReceiptBatchOpen] = useState(false);
  const [receiptBatchSelected, setReceiptBatchSelected] = useState<Set<string>>(new Set());
  const [receiptBatchDeliverer, setReceiptBatchDeliverer] = useState<Identity | null>(null);
  const [receiptBatchNote, setReceiptBatchNote] = useState('');
  const [receiptBatchMismatchReason, setReceiptBatchMismatchReason] = useState('');
  const [receiptBatchDeviations, setReceiptBatchDeviations] = useState<Set<string>>(new Set());
  const [receiptBatchScanFeedback, setReceiptBatchScanFeedback] = useState<{
    type: 'OK' | 'WARN' | 'ERROR';
    message: string;
  } | null>(null);
  const [prepDraft, setPrepDraft] = useState<AssetDraft | null>(null);
  const [deliverer, setDeliverer] = useState<Identity | null>(null);
  const [note, setNote] = useState('');
  const [receiptNoteOpen, setReceiptNoteOpen] = useState(false);
  const [visibleDeviation, setVisibleDeviation] = useState(false);
  const [receiptDeviationRecorded, setReceiptDeviationRecorded] = useState(false);
  const [departmentMismatchReason, setDepartmentMismatchReason] = useState('');
  const [checkEnabled, setCheckEnabled] = useState(false);
  const [checkedCount, setCheckedCount] = useState<number>(0);
  const [, setCheckResult] = useState<ReceiptCheckResult>('OK');
  const [, setCheckNote] = useState('');
  const [receiptCheckedToolIds, setReceiptCheckedToolIds] = useState<Set<string>>(new Set());
  const [receiptProblemToolIds, setReceiptProblemToolIds] = useState<Set<string>>(new Set());
  const [, setReceiptSetChecks] = useState({containerOk: false, compositionOk: false, visualOk: false});
  const [issueTarget, setIssueTarget] = useState<{kind: Kind; id: string} | null>(null);
  const [issueType, setIssueType] = useState('Βλάβη / μη λειτουργικό');
  const [issueNote, setIssueNote] = useState('');
  const [issueSource, setIssueSource] = useState('Αποστείρωση · κατά την παραλαβή');
  const [issuePhotos, setIssuePhotos] = useState<AssetPhoto[]>([]);
  const [issueCameraOpen, setIssueCameraOpen] = useState(false);
  const [prepCheckedIds, setPrepCheckedIds] = useState<Set<string>>(new Set());
  const [prepSelectedToolId, setPrepSelectedToolId] = useState<string | null>(null);
  const [prepToolAction, setPrepToolAction] = useState<'REPLACE' | 'SERVICE' | 'STOCK' | 'SET' | null>(null);
  const [prepManageToolId, setPrepManageToolId] = useState<string | null>(null);
  const [prepManageMissingCode, setPrepManageMissingCode] = useState<string | null>(null);
  const [acceptedMissingCodes, setAcceptedMissingCodes] = useState<Set<string>>(new Set());
  const [prepReplacementId, setPrepReplacementId] = useState('');
  const [prepReplacementRequirement, setPrepReplacementRequirement] = useState<{code: string; name: string} | null>(
    null,
  );
  const [prepReplacementSource, setPrepReplacementSource] = useState<'STOCK' | 'SET' | 'STANDALONE'>('STOCK');
  const [prepReplacementSetId, setPrepReplacementSetId] = useState('');
  const [allowMissing, setAllowMissing] = useState(false);
  const [prepOutgoingDestination, setPrepOutgoingDestination] = useState<'SERVICE' | 'STOCK' | 'SET'>('SERVICE');
  const [prepOutgoingSetId, setPrepOutgoingSetId] = useState('');
  const [prepTargetSetId, setPrepTargetSetId] = useState('');
  const [prepNote, setPrepNote] = useState('');
  const [prepProcessChecks, setPrepProcessChecks] = useState({
    cleanDry: false,
    functionIntegrity: false,
    assembly: false,
    packaging: false,
    labelIndicator: false,
  });
  const [releaseDraft, setReleaseDraft] = useState<AssetDraft | null>(null);
  const [releaseChecks, setReleaseChecks] = useState({
    physicalParametersOk: false,
    chemicalIndicatorOk: false,
    packagingIntegrityOk: false,
  });
  const [biologicalIndicatorResult, setBiologicalIndicatorResult] = useState<
    'NOT_REQUIRED' | 'PASS' | 'PENDING' | 'FAIL'
  >('NOT_REQUIRED');
  const [releaseNote, setReleaseNote] = useState('');
  const [deliveryDraft, setDeliveryDraft] = useState<AssetDraft | null>(null);
  const [receiver, setReceiver] = useState<Identity | null>(null);
  const [deliveryNote, setDeliveryNote] = useState('');
  const [deliveryBatchOpen, setDeliveryBatchOpen] = useState(false);
  const [deliverySelected, setDeliverySelected] = useState<Set<string>>(new Set());
  const [deliveryBatchReceiver, setDeliveryBatchReceiver] = useState<Identity | null>(null);
  const [deliveryBatchNote, setDeliveryBatchNote] = useState('');
  const [deliveryScanFeedback, setDeliveryScanFeedback] = useState<{
    type: 'OK' | 'WARN' | 'ERROR';
    message: string;
  } | null>(null);
  const [checkpointDraft, setCheckpointDraft] = useState<{
    draft: AssetDraft;
    stageId: 'WASHING' | 'PACKAGING' | 'STORAGE';
  } | null>(null);
  const [checkpointChecks, setCheckpointChecks] = useState<boolean[]>([]);
  const [checkpointNote, setCheckpointNote] = useState('');
  /** The hospital's default sterile shelf life (months), chosen again per Set or instrument at packaging. */
  const defaultShelfLife = isShelfLife(systemSettings.sterileShelfLifeMonths)
    ? systemSettings.sterileShelfLifeMonths
    : DEFAULT_SHELF_LIFE;
  const [shelfLife, setShelfLife] = useState<number>(defaultShelfLife);
  const [loadModal, setLoadModal] = useState<'WASHING' | 'STERILIZATION' | null>(null);
  const [loadSelected, setLoadSelected] = useState<Set<string>>(new Set());
  const [loadEquipment, setLoadEquipment] = useState('');
  const [loadCycleNumber, setLoadCycleNumber] = useState('');
  const [loadProgram, setLoadProgram] = useState('');
  const [loadChemical, setLoadChemical] = useState<'PASS' | 'FAIL' | 'NOT_RECORDED'>('NOT_RECORDED');
  const [loadChemicalOn, setLoadChemicalOn] = useState(true);
  const [loadBiologicalOn, setLoadBiologicalOn] = useState(false);
  /** The cycle was taken from a connected device, so it has already ended. */
  const [loadFromDevice, setLoadFromDevice] = useState(false);
  const [loadNote, setLoadNote] = useState('');
  const [loadScanFeedback, setLoadScanFeedback] = useState<{type: 'OK' | 'WARN' | 'ERROR'; message: string} | null>(
    null,
  );
  const [releaseLoadId, setReleaseLoadId] = useState<string | null>(null);
  const [releaseLoadChecks, setReleaseLoadChecks] = useState({
    physicalParametersOk: false,
    chemicalIndicatorOk: false,
    packagingIntegrityOk: false,
  });
  const [releaseLoadChem, setReleaseLoadChem] = useState<'PASS' | 'FAIL' | 'NOT_RECORDED'>('NOT_RECORDED');
  const [releaseLoadBi, setReleaseLoadBi] = useState<'NOT_REQUIRED' | 'PASS' | 'PENDING' | 'FAIL'>('NOT_REQUIRED');
  const [releaseLoadNote, setReleaseLoadNote] = useState('');
  return {
    recordBiologicalResult,
    sterilizationReleases,
    organizationName,
    finishProcessLoad,
    can,
    acceptedMissingCodes,
    allowMissing,
    applyColorPlan,
    biologicalIndicatorResult,
    canCompose,
    checkEnabled,
    checkedCount,
    checkpointChecks,
    checkpointDraft,
    checkpointNote,
    shelfLife,
    defaultShelfLife,
    colorQuestion,
    completeDeliveryToDepartment,
    completeWorkflowCheckpoint,
    compositionOptions,
    createProcessLoad,
    currentUser,
    deliverer,
    deliveryBatchNote,
    deliveryBatchOpen,
    deliveryBatchReceiver,
    deliveryDraft,
    deliveryNote,
    deliveryScanFeedback,
    deliverySelected,
    departmentFilter,
    departmentMismatchReason,
    issueCameraOpen,
    issueNote,
    issuePhotos,
    issueSource,
    issueTarget,
    issueType,
    issues,
    kindFilter,
    loadChemical,
    loadChemicalOn,
    loadBiologicalOn,
    loadFromDevice,
    setLoadFromDevice,
    loadCycleNumber,
    loadEquipment,
    loadModal,
    loadNote,
    loadProgram,
    loadScanFeedback,
    loadSelected,
    moveTool,
    note,
    prepCheckedIds,
    prepDraft,
    prepManageMissingCode,
    prepManageToolId,
    prepNote,
    prepOutgoingDestination,
    prepOutgoingSetId,
    prepProcessChecks,
    prepReplacementId,
    prepReplacementRequirement,
    prepReplacementSetId,
    prepReplacementSource,
    prepSelectedToolId,
    prepTargetSetId,
    prepToolAction,
    processLoads,
    query,
    queue,
    quickBarcode,
    quickScanFeedback,
    recallCases,
    recallProcessLoad,
    receiptBatchDeliverer,
    receiptBatchDeviations,
    receiptBatchMismatchReason,
    receiptBatchNote,
    receiptBatchOpen,
    receiptBatchScanFeedback,
    receiptBatchSelected,
    receiptCheckedToolIds,
    receiptDeviationRecorded,
    receiptDraft,
    receiptNoteOpen,
    receiptProblemToolIds,
    receiptView,
    receiveAtSterilization,
    receiver,
    recordPreparation,
    releaseChecks,
    releaseDraft,
    releaseLoadBi,
    releaseLoadChem,
    releaseLoadChecks,
    releaseLoadId,
    releaseLoadNote,
    releaseNote,
    releaseProcessLoad,
    releaseSterilization,
    replaceToolInSet,
    reportIssue,
    reportSetIssue,
    resolveIssues,
    setAcceptedMissingCodes,
    setAllowMissing,
    setBiologicalIndicatorResult,
    setCheckEnabled,
    setCheckNote,
    setCheckResult,
    setCheckedCount,
    setCheckpointChecks,
    setCheckpointDraft,
    setCheckpointNote,
    setShelfLife,
    setDeliverer,
    setDeliveryBatchNote,
    setDeliveryBatchOpen,
    setDeliveryBatchReceiver,
    setDeliveryDraft,
    setDeliveryNote,
    setDeliveryScanFeedback,
    setDeliverySelected,
    setDepartmentFilter,
    setDepartmentMismatchReason,
    setIssueCameraOpen,
    setIssueNote,
    setIssuePhotos,
    setIssueSource,
    setIssueTarget,
    setIssueType,
    setKindFilter,
    setLoadChemical,
    setLoadChemicalOn,
    setLoadBiologicalOn,
    setLoadCycleNumber,
    setLoadEquipment,
    setLoadModal,
    setLoadNote,
    setLoadProgram,
    setLoadScanFeedback,
    setLoadSelected,
    setNote,
    setPrepCheckedIds,
    setPrepDraft,
    setPrepManageMissingCode,
    setPrepManageToolId,
    setPrepNote,
    setPrepOutgoingDestination,
    setPrepOutgoingSetId,
    setPrepProcessChecks,
    setPrepReplacementId,
    setPrepReplacementRequirement,
    setPrepReplacementSetId,
    setPrepReplacementSource,
    setPrepSelectedToolId,
    setPrepTargetSetId,
    setPrepToolAction,
    setQuery,
    setQueue,
    setQuickBarcode,
    setQuickScanFeedback,
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
    setReceiver,
    setReleaseChecks,
    setReleaseDraft,
    setReleaseLoadBi,
    setReleaseLoadChem,
    setReleaseLoadChecks,
    setReleaseLoadId,
    setReleaseLoadNote,
    setReleaseNote,
    setSpecialtyFilter,
    setVisibleDeviation,
    sets,
    specialtyFilter,
    stageEnabled,
    sterilizationCycles,
    sterilizationWorkflow,
    sterilizerNames,
    defaultSterilizer,
    systemSettings,
    tools,
    visibleDeviation,
  };
}
