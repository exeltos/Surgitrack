import {useMemo, useState} from 'react';
import {Link} from 'react-router-dom';
import {useSurgi} from '../../store/SurgiStore';
import {useLibraries} from '../../core/LibraryStore';
import type {WorkflowStageId} from '../../core/workflow';
import type {Asset, AssetKind, AssetPhoto, ReceiptCheckResult, ReceiptRecord, SetAsset, Tool} from '../../types/domain';
import StatusBadge from '../../components/ui/StatusBadge';
import AssetTypeIcon from '../../components/assets/AssetTypeIcon';
import AssetFilterBar from '../../components/assets/AssetFilterBar';
import BarcodeCapture from '../../components/barcode/BarcodeCapture';
import {
  CheckCircle2,
  ScanBarcode,
  PackageCheck,
  ClipboardCheck,
  Flame,
  Send,
  TriangleAlert,
  ArrowRight,
  Box,
  Stethoscope,
  UserRoundCheck,
  X,
  ShieldCheck,
  IdCard,
  Clock3,
  Building2,
  UserCheck,
  Layers3,
  Wrench,
  PackageOpen,
  Printer,
  Barcode,
  Check,
  Camera,
  ImagePlus,
  Trash2,
} from 'lucide-react';
import {printBarcodeLabel, printCompositionA4} from './printUtils';
import {filesToAssetPhotos} from '../../components/assets/photoUtils';
import CameraCaptureModal from '../../components/assets/CameraCaptureModal';

type Queue = 'INCOMING' | 'WASHING' | 'PREP' | 'PACKAGING' | 'PROCESS' | 'RELEASE' | 'STORAGE' | 'READY';
type Kind = AssetKind;
type SterilizationRow = (SetAsset & {kind: 'SET'}) | (Tool & {kind: 'TOOL'});
type AssetDraft = {kind: 'SET'; asset: SetAsset} | {kind: 'TOOL'; asset: Tool};
type Identity = {code: string; userId: string; name: string; department: string; role: string};

const identityDirectory: Identity[] = [
  {
    code: 'OR-2187',
    userId: 'u-or-2187',
    name: 'Demo Χρήστης Χειρουργείου',
    department: 'Χειρουργείο',
    role: 'Χρήστης Τμήματος',
  },
  {
    code: 'TOK-1042',
    userId: 'u-tok-1042',
    name: 'Demo Χρήστης Αίθουσας Τοκετών',
    department: 'Αίθουσα Τοκετών',
    role: 'Χρήστης Τμήματος',
  },
  {code: 'IVF-1130', userId: 'u-ivf-1130', name: 'Demo Χρήστης IVF', department: 'IVF', role: 'Χρήστης Τμήματος'},
];

export default function SterilizationPage() {
  const {
    sets,
    tools,
    receiveAtSterilization,
    recordPreparation,
    completeSterilizationCycle,
    releaseSterilization,
    completeWorkflowCheckpoint,
    completeDeliveryToDepartment,
    createProcessLoad,
    releaseProcessLoad,
    recallProcessLoad,
    processLoads,
    issues,
    receipts,
    sterilizationCycles,
    currentUser,
    reportIssue,
    reportSetIssue,
    resolveIssues,
    moveTool,
    replaceToolInSet,
  } = useSurgi();
  const {sterilizationWorkflow} = useLibraries();
  const activeStages = sterilizationWorkflow.stages.filter(stage => stage.enabled);
  const stageEnabled = (id: WorkflowStageId) => activeStages.some(stage => stage.id === id);
  const queueForStage = (id: WorkflowStageId): Queue =>
    id === 'RECEIPT'
      ? 'INCOMING'
      : id === 'WASHING'
        ? 'WASHING'
        : id === 'PREPARATION'
          ? 'PREP'
          : id === 'PACKAGING'
            ? 'PACKAGING'
            : id === 'STERILIZATION'
              ? 'PROCESS'
              : id === 'RELEASE'
                ? 'RELEASE'
                : id === 'STORAGE'
                  ? 'STORAGE'
                  : 'READY';
  const [queue, setQueue] = useState<Queue>('INCOMING');
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
  const [receiptBatchDelivererCode, setReceiptBatchDelivererCode] = useState('');
  const [receiptBatchNote, setReceiptBatchNote] = useState('');
  const [receiptBatchMismatchReason, setReceiptBatchMismatchReason] = useState('');
  const [receiptBatchDeviations, setReceiptBatchDeviations] = useState<Set<string>>(new Set());
  const [receiptBatchScanFeedback, setReceiptBatchScanFeedback] = useState<{
    type: 'OK' | 'WARN' | 'ERROR';
    message: string;
  } | null>(null);
  const [prepDraft, setPrepDraft] = useState<AssetDraft | null>(null);
  const [handoverCode, setHandoverCode] = useState('');
  const [note, setNote] = useState('');
  const [receiptNoteOpen, setReceiptNoteOpen] = useState(false);
  const [visibleDeviation, setVisibleDeviation] = useState(false);
  const [receiptDeviationRecorded, setReceiptDeviationRecorded] = useState(false);
  const [departmentMismatchReason, setDepartmentMismatchReason] = useState('');
  const [checkEnabled, setCheckEnabled] = useState(false);
  const [checkedCount, setCheckedCount] = useState<number>(0);
  const [checkResult, setCheckResult] = useState<ReceiptCheckResult>('OK');
  const [checkNote, setCheckNote] = useState('');
  const [receiptCheckedToolIds, setReceiptCheckedToolIds] = useState<Set<string>>(new Set());
  const [receiptProblemToolIds, setReceiptProblemToolIds] = useState<Set<string>>(new Set());
  const [receiptSetChecks, setReceiptSetChecks] = useState({containerOk: false, compositionOk: false, visualOk: false});
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
  const [cycleDraft, setCycleDraft] = useState<AssetDraft | null>(null);
  const [sterilizer, setSterilizer] = useState('Κλίβανος 1');
  const [cycleNumber, setCycleNumber] = useState('');
  const [cycleProgram, setCycleProgram] = useState('134°C · 5 min');
  const [indicatorResult, setIndicatorResult] = useState<'PASS' | 'FAIL' | 'NOT_RECORDED'>('PASS');
  const [cycleNote, setCycleNote] = useState('');
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
  const [receiverCode, setReceiverCode] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [deliveryBatchOpen, setDeliveryBatchOpen] = useState(false);
  const [deliverySelected, setDeliverySelected] = useState<Set<string>>(new Set());
  const [deliveryBatchReceiverCode, setDeliveryBatchReceiverCode] = useState('');
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
  const [loadModal, setLoadModal] = useState<'WASHING' | 'STERILIZATION' | null>(null);
  const [loadSelected, setLoadSelected] = useState<Set<string>>(new Set());
  const [loadEquipment, setLoadEquipment] = useState('');
  const [loadCycleNumber, setLoadCycleNumber] = useState('');
  const [loadProgram, setLoadProgram] = useState('');
  const [loadChemical, setLoadChemical] = useState<'PASS' | 'FAIL' | 'NOT_RECORDED'>('PASS');
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
  const [releaseLoadBi, setReleaseLoadBi] = useState<'NOT_REQUIRED' | 'PASS' | 'PENDING' | 'FAIL'>('NOT_REQUIRED');
  const [releaseLoadNote, setReleaseLoadNote] = useState('');

  const all = useMemo<SterilizationRow[]>(
    () => [
      ...sets.map(x => ({...x, kind: 'SET' as const})),
      ...tools.filter(t => t.mode === 'STANDALONE').map(x => ({...x, kind: 'TOOL' as const})),
    ],
    [sets, tools],
  );
  const incoming = all.filter(x => x.state === 'PENDING_STERILIZATION');
  const washing = all.filter(x => x.state === 'IN_WASHING');
  const preparation = all.filter(x => x.state === 'IN_PREPARATION');
  const packaging = all.filter(x => x.state === 'IN_PACKAGING');
  const processing = all.filter(x => x.state === 'IN_STERILIZATION');
  const awaitingRelease = all.filter(x => x.state === 'AWAITING_RELEASE');
  const storage = all.filter(x => x.state === 'IN_STORAGE');
  const ready = all.filter(x => x.state === 'READY_FOR_PICKUP');
  const source =
    queue === 'INCOMING'
      ? incoming
      : queue === 'WASHING'
        ? washing
        : queue === 'PREP'
          ? preparation
          : queue === 'PACKAGING'
            ? packaging
            : queue === 'PROCESS'
              ? processing
              : queue === 'RELEASE'
                ? awaitingRelease
                : queue === 'STORAGE'
                  ? storage
                  : ready;
  const queueValues = (key: 'department' | 'specialty'): string[] =>
    [...new Set<string>(source.map(x => String(x[key] || '')).filter(Boolean))].sort();
  const rows = source.filter(
    x =>
      (!departmentFilter || x.department === departmentFilter) &&
      (!specialtyFilter || x.specialty === specialtyFilter) &&
      (!kindFilter || x.kind === kindFilter) &&
      `${x.barcode} ${x.name} ${x.code || ''} ${x.department || ''} ${x.specialty || ''}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const deliverer = identityDirectory.find(x => x.code === handoverCode.trim().toUpperCase());
  const delivererMatches = !receiptDraft || !deliverer || deliverer.department === receiptDraft.asset.department;
  const receiptPolicy = sterilizationWorkflow.receiptPolicy || {
    countSetsAtReceipt: false,
    allowCrossDepartmentHandover: true,
  };
  const departmentExceptionAllowed =
    !!deliverer && !delivererMatches && receiptPolicy.allowCrossDepartmentHandover && !!departmentMismatchReason.trim();
  const receiptIdentityValid = !!deliverer && (delivererMatches || departmentExceptionAllowed);
  const receiptBatchAssets = incoming.filter(item => receiptBatchSelected.has(`${item.kind}:${item.id}`));
  const receiptBatchDepartment = receiptBatchAssets[0]?.department || '';
  const receiptBatchDeliverer = identityDirectory.find(x => x.code === receiptBatchDelivererCode.trim().toUpperCase());
  const receiptBatchDelivererMatches =
    !!receiptBatchDeliverer && !!receiptBatchDepartment && receiptBatchDeliverer.department === receiptBatchDepartment;
  const receiptBatchDepartmentException =
    !!receiptBatchDeliverer &&
    !receiptBatchDelivererMatches &&
    receiptPolicy.allowCrossDepartmentHandover &&
    !!receiptBatchMismatchReason.trim();
  const receiptBatchIdentityValid =
    !!receiptBatchDeliverer && (receiptBatchDelivererMatches || receiptBatchDepartmentException);
  const receiptBatchDemoIdentity = receiptBatchDepartment
    ? identityDirectory.find(x => x.department === receiptBatchDepartment)
    : undefined;
  const demoIdentity = receiptDraft
    ? identityDirectory.find(x => x.department === receiptDraft.asset.department)
    : undefined;
  const receiver = identityDirectory.find(x => x.code === receiverCode.trim().toUpperCase());
  const receiverMatches = !deliveryDraft || !receiver || receiver.department === deliveryDraft.asset.department;
  const loadCandidates = loadModal === 'WASHING' ? washing : loadModal === 'STERILIZATION' ? processing : [];
  const awaitingLoads = processLoads.filter(
    load => load.kind === 'STERILIZATION' && load.status === 'AWAITING_RELEASE',
  );
  const releasedLoads = processLoads
    .filter(load => load.kind === 'STERILIZATION' && load.status === 'RELEASED')
    .slice(0, 5);
  const selectedReleaseLoad = releaseLoadId ? processLoads.find(load => load.id === releaseLoadId) : undefined;
  const releasePolicy = sterilizationWorkflow.releasePolicy || {
    requireChemicalIndicator: true,
    biologicalIndicator: 'OPTIONAL' as const,
    allowReleaseWhileBiPending: false,
  };
  const releaseBiOk =
    releasePolicy.biologicalIndicator === 'NOT_REQUIRED' ||
    releaseLoadBi === 'PASS' ||
    (releasePolicy.biologicalIndicator === 'OPTIONAL' && releaseLoadBi === 'NOT_REQUIRED') ||
    (releasePolicy.allowReleaseWhileBiPending && releaseLoadBi === 'PENDING');
  const releaseLoadReady =
    releaseLoadChecks.physicalParametersOk &&
    (!releasePolicy.requireChemicalIndicator || releaseLoadChecks.chemicalIndicatorOk) &&
    releaseLoadChecks.packagingIntegrityOk &&
    releaseBiOk;
  const deliveryDemoIdentity = deliveryDraft
    ? identityDirectory.find(x => x.department === deliveryDraft.asset.department)
    : undefined;
  const deliverySelectedAssets = ready.filter(item => deliverySelected.has(`${item.kind}:${item.id}`));
  const deliveryBatchDepartment = deliverySelectedAssets[0]?.department || '';
  const deliveryBatchReceiver = identityDirectory.find(x => x.code === deliveryBatchReceiverCode.trim().toUpperCase());
  const deliveryBatchReceiverMatches =
    !!deliveryBatchReceiver &&
    !!deliveryBatchDepartment &&
    deliveryBatchReceiver.department === deliveryBatchDepartment;
  const deliveryBatchDemoIdentity = deliveryBatchDepartment
    ? identityDirectory.find(x => x.department === deliveryBatchDepartment)
    : undefined;

  const receiptTools = receiptDraft?.kind === 'SET' ? tools.filter(t => t.setId === receiptDraft.asset.id) : [];
  const receiptExpectedCount = receiptDraft?.kind === 'SET' ? receiptTools.length : 1;
  const receiptProblemCount = receiptTools.reduce(
    (sum, t) => sum + issues.filter(i => i.status === 'OPEN' && i.asset.startsWith(t.barcode)).length,
    0,
  );
  const receiptItemCheckedCount = receiptDraft?.kind === 'SET' ? receiptCheckedToolIds.size : checkEnabled ? 1 : 0;
  const receiptMissingCount = receiptDraft?.kind === 'SET' ? Math.max(0, receiptExpectedCount - checkedCount) : 0;
  const receiptAllItemsChecked = !receiptDraft
    ? true
    : receiptDraft.kind === 'SET'
      ? receiptTools.length > 0 && receiptTools.every(t => receiptCheckedToolIds.has(t.id))
      : receiptCheckedToolIds.has(receiptDraft.asset.id);
  const receiptAllSetChecks = receiptDraft?.kind !== 'SET' || Object.values(receiptSetChecks).every(Boolean);
  const latestReceipt = (assetId: string) => receipts.find(r => r.assetId === assetId);
  const latestPassedCycle = (assetId: string) =>
    sterilizationCycles.find(c => c.assetId === assetId && c.result === 'PASSED');
  const prepTools = prepDraft?.kind === 'SET' ? tools.filter(t => t.setId === prepDraft.asset.id) : [];
  const prepItemIds = prepDraft ? (prepDraft.kind === 'SET' ? prepTools.map(t => t.id) : [prepDraft.asset.id]) : [];
  const prepItemBarcodes = prepDraft
    ? prepDraft.kind === 'SET'
      ? prepTools.map(t => t.barcode)
      : [prepDraft.asset.barcode]
    : [];
  const prepOpenIssues = prepDraft
    ? issues.filter(
        i =>
          i.status === 'OPEN' &&
          (i.asset.startsWith(prepDraft.asset.barcode) || prepItemBarcodes.some(code => i.asset.startsWith(code))),
      )
    : [];
  const prepAllChecked = prepItemIds.length > 0 && prepItemIds.every(id => prepCheckedIds.has(id));
  const prepExpectedCount = prepDraft?.kind === 'SET' ? prepDraft.asset.expected : 1;
  const prepMissingCount = prepDraft?.kind === 'SET' ? Math.max(0, prepExpectedCount - prepTools.length) : 0;
  const prepMissingRequirements =
    prepDraft?.kind === 'SET' && prepDraft.asset.compositionTemplate
      ? prepDraft.asset.compositionTemplate.flatMap(req => {
          const actual = prepTools.filter(t => t.code === req.code).length;
          const missing = Math.max(0, req.quantity - actual);
          return missing ? [{...req, missing}] : [];
        })
      : [];
  const prepTemplateComplete =
    prepDraft?.kind !== 'SET' || !prepDraft.asset.compositionTemplate?.length || prepMissingRequirements.length === 0;
  const prepCompositionComplete =
    !!prepDraft && (prepDraft.kind === 'TOOL' || (prepMissingCount === 0 && prepTemplateComplete));
  const prepMissingAccepted =
    prepDraft?.kind !== 'SET' ||
    (prepMissingRequirements.length > 0
      ? prepMissingRequirements.every(req => acceptedMissingCodes.has(req.code))
      : prepMissingCount > 0
        ? allowMissing
        : true);
  const prepAcceptedDeviation =
    !!prepDraft && prepDraft.kind === 'SET' && !prepCompositionComplete && prepMissingAccepted;
  const prepResolvedShortageIssues =
    prepDraft?.kind === 'SET' && (prepCompositionComplete || prepAcceptedDeviation)
      ? prepOpenIssues.filter(
          i =>
            i.asset.startsWith(prepDraft.asset.barcode) &&
            (i.type.toLowerCase().includes('έλλει') ||
              i.note.toLowerCase().includes('έλλει') ||
              i.note.toLowerCase().includes('αναμενόμενα')),
        )
      : [];
  const prepResolvedShortageIssueIds = new Set(prepResolvedShortageIssues.map(i => i.id));
  const prepBlockingIssues = prepOpenIssues.filter(i => !prepResolvedShortageIssueIds.has(i.id));
  const prepProcessReady =
    prepProcessChecks.functionIntegrity &&
    prepProcessChecks.assembly &&
    (stageEnabled('WASHING') || prepProcessChecks.cleanDry) &&
    (stageEnabled('PACKAGING') || (prepProcessChecks.packaging && prepProcessChecks.labelIndicator));
  const prepReadyForProcess =
    prepAllChecked &&
    prepBlockingIssues.length === 0 &&
    (prepCompositionComplete || prepMissingAccepted) &&
    prepProcessReady;
  const prepSelectedTool = prepSelectedToolId ? tools.find(t => t.id === prepSelectedToolId) : undefined;
  const prepManageTool = prepManageToolId ? tools.find(t => t.id === prepManageToolId) : undefined;
  const prepManageMissing = prepManageMissingCode
    ? prepMissingRequirements.find(req => req.code === prepManageMissingCode)
    : undefined;
  const prepOtherSets = prepDraft?.kind === 'SET' ? sets.filter(s => s.id !== prepDraft.asset.id) : [];
  const prepReplacementSourceSets =
    prepDraft?.kind === 'SET'
      ? sets.filter(
          set =>
            set.id !== prepDraft.asset.id &&
            tools.some(
              t => t.mode === 'SET_MEMBER' && t.setId === set.id && t.state !== 'SERVICE' && t.state !== 'LOST',
            ),
        )
      : [];
  const prepReplacementTargetCode = prepSelectedTool?.code || prepReplacementRequirement?.code;
  const prepReplacementCandidates =
    prepDraft?.kind === 'SET' && prepReplacementTargetCode
      ? tools
          .filter(
            t =>
              t.setId !== prepDraft.asset.id &&
              t.state !== 'SERVICE' &&
              t.state !== 'LOST' &&
              (prepReplacementSource === 'STOCK'
                ? t.mode === 'STOCK'
                : prepReplacementSource === 'SET'
                  ? t.mode === 'SET_MEMBER' && t.setId === prepReplacementSetId
                  : t.mode === 'STANDALONE'),
          )
          .sort(
            (a, b) =>
              Number(b.code === prepReplacementTargetCode) - Number(a.code === prepReplacementTargetCode) ||
              a.name.localeCompare(b.name, 'el'),
          )
      : [];
  const resolveAssetDraft = (kind: Kind, id: string): AssetDraft | undefined => {
    if (kind === 'SET') {
      const asset = sets.find(item => item.id === id);
      return asset ? {kind: 'SET', asset} : undefined;
    }
    const asset = tools.find(item => item.id === id);
    return asset ? {kind: 'TOOL', asset} : undefined;
  };
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
      setQueue('PROCESS');
      openCycleCompletion(found.kind, found);
    } else if (found.state === 'AWAITING_RELEASE') {
      setQueue('RELEASE');
      openRelease(found.kind, found);
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
    setQuickScanFeedback(ok ? 'Το barcode αναγνωρίστηκε.' : 'Το barcode δεν βρέθηκε στην ενεργή ροή.');
    if (ok) setQuickBarcode('');
  };
  const openReceiptBatch = () => {
    setReceiptBatchOpen(true);
    setReceiptBatchSelected(new Set());
    setReceiptBatchDelivererCode('');
    setReceiptBatchNote('');
    setReceiptBatchMismatchReason('');
    setReceiptBatchDeviations(new Set());
    setReceiptBatchScanFeedback(null);
  };
  const closeReceiptBatch = () => {
    setReceiptBatchOpen(false);
    setReceiptBatchSelected(new Set());
    setReceiptBatchDelivererCode('');
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
  const addBarcodeToReceiptBatch = (raw: string) => {
    const barcode = raw.trim().toUpperCase();
    if (!barcode) return false;
    const item = incoming.find(x => x.barcode.toUpperCase() === barcode);
    if (!item) {
      const known = all.find(x => x.barcode.toUpperCase() === barcode);
      setReceiptBatchScanFeedback({
        type: 'ERROR',
        message: known
          ? `${barcode} αναγνωρίστηκε, αλλά δεν βρίσκεται σε αναμονή φυσικής παραλαβής.`
          : `${barcode} δεν βρέθηκε στο μητρώο.`,
      });
      return false;
    }
    const key = `${item.kind}:${item.id}`;
    if (receiptBatchSelected.has(key)) {
      setReceiptBatchScanFeedback({type: 'WARN', message: `${barcode} είναι ήδη στην παραλαβή.`});
      return false;
    }
    if (receiptBatchDepartment && item.department !== receiptBatchDepartment) {
      setReceiptBatchScanFeedback({
        type: 'ERROR',
        message: `Η τρέχουσα μαζική παραλαβή αφορά το ${receiptBatchDepartment}. Ολοκλήρωσέ την πριν παραλάβεις αντικείμενα από ${item.department}.`,
      });
      return false;
    }
    setReceiptBatchSelected(current => new Set([...current, key]));
    setReceiptBatchScanFeedback({type: 'OK', message: `${barcode} · ${item.name} προστέθηκε στην παραλαβή.`});
    return true;
  };
  const toggleReceiptBatchDeviation = (key: string) =>
    setReceiptBatchDeviations(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const completeReceiptBatch = () => {
    if (!receiptBatchAssets.length || !receiptBatchDeliverer || !receiptBatchIdentityValid) return;
    const batchId = `RB-${Date.now()}`;
    receiptBatchAssets.forEach(item => {
      const key = `${item.kind}:${item.id}`;
      const expected = item.kind === 'SET' ? tools.filter(t => t.setId === item.id).length : undefined;
      receiveAtSterilization(item.kind, item.id, {
        batchId,
        deliveredByUserId: receiptBatchDeliverer.userId,
        deliveredByName: receiptBatchDeliverer.name,
        deliveredByDepartment: receiptBatchDeliverer.department,
        note:
          [
            receiptBatchNote.trim(),
            !receiptBatchDelivererMatches ? `Παράδοση από διαφορετικό τμήμα: ${receiptBatchMismatchReason.trim()}` : '',
          ]
            .filter(Boolean)
            .join(' · ') || undefined,
        visibleDeviation: receiptBatchDeviations.has(key),
        departmentMismatch: !receiptBatchDelivererMatches,
        departmentMismatchReason: !receiptBatchDelivererMatches ? receiptBatchMismatchReason.trim() : undefined,
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
    setHandoverCode('');
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
    setHandoverCode('');
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
  const addIssuePhotos = async (files: File[]) => {
    const photos = await filesToAssetPhotos(files);
    setIssuePhotos(current => [...current, ...photos]);
  };
  const openIssueReport = (kind: Kind, id: string, source: string) => {
    setIssueSource(source);
    setIssueTarget({kind, id});
    setIssueType('Βλάβη / μη λειτουργικό');
    setIssueNote('');
    setIssuePhotos([]);
  };
  const openCompositionShortageReport = () => {
    if (!prepDraft || prepDraft.kind !== 'SET') return;
    openIssueReport('SET', prepDraft.asset.id, 'Αποστείρωση · σύνθεση & προετοιμασία');
    setIssueType('Έλλειψη σύνθεσης');
    setIssueNote(prepMissingRequirements.map(req => `${req.missing}× ${req.name} (${req.code})`).join(' · '));
  };
  const closeIssueReport = () => {
    setIssueCameraOpen(false);
    setIssueTarget(null);
    setIssuePhotos([]);
  };
  const saveIssueReport = () => {
    if (!issueTarget) return;
    if (issueSource.includes('κατά την παραλαβή')) {
      setVisibleDeviation(true);
      setReceiptDeviationRecorded(true);
    }
    if (issueSource.includes('μαζική παραλαβή'))
      setReceiptBatchDeviations(current => new Set(current).add(`${issueTarget.kind}:${issueTarget.id}`));
    if (issueTarget.kind === 'SET') reportSetIssue(issueTarget.id, [], issueType, issueNote, issuePhotos, issueSource);
    else {
      reportIssue(issueTarget.id, issueType, issueNote, issueSource, issuePhotos);
      if (receiptDraft && checkEnabled && issueSource.includes('παραλαβή')) {
        setReceiptCheckedToolIds(current => new Set(current).add(issueTarget.id));
        setReceiptProblemToolIds(current => new Set(current).add(issueTarget.id));
      }
    }
    closeIssueReport();
    setIssueType('Βλάβη / μη λειτουργικό');
    setIssueNote('');
  };
  const toggleReceiptToolCheck = (id: string) =>
    setReceiptCheckedToolIds(current => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
        setReceiptProblemToolIds(problems => {
          const p = new Set(problems);
          p.delete(id);
          return p;
        });
      } else next.add(id);
      return next;
    });
  const receiptAllOk =
    receiptDraft?.kind === 'SET' &&
    receiptTools.length > 0 &&
    receiptTools.every(t => receiptCheckedToolIds.has(t.id) && !receiptProblemToolIds.has(t.id));
  const toggleAllReceiptChecks = () => {
    if (receiptAllOk) {
      setReceiptCheckedToolIds(new Set());
      setReceiptProblemToolIds(new Set());
      setCheckedCount(0);
      return;
    }
    const ids =
      receiptDraft?.kind === 'SET' ? receiptTools.map(t => t.id) : receiptDraft ? [receiptDraft.asset.id] : [];
    setReceiptCheckedToolIds(new Set(ids));
    setReceiptProblemToolIds(new Set());
    setCheckedCount(ids.length);
    setCheckResult('OK');
  };
  const toggleReceiptToolProblem = (id: string) => {
    const isProblem = receiptProblemToolIds.has(id);
    setReceiptCheckedToolIds(current => new Set(current).add(id));
    setReceiptProblemToolIds(current => {
      const next = new Set(current);
      if (isProblem) next.delete(id);
      else next.add(id);
      return next;
    });
    if (!isProblem) openIssueReport('TOOL', id, 'Αποστείρωση · έλεγχος κατά την παραλαβή');
  };
  const confirmReceipt = () => {
    if (!receiptDraft || !deliverer || !receiptIdentityValid) return;
    if (visibleDeviation && !receiptDeviationRecorded) {
      window.alert('Κατέγραψε πρώτα την εμφανή απόκλιση με αναφορά στο Σετ ή στο συγκεκριμένο εργαλείο.');
      return;
    }
    const countPerformed = receiptDraft.kind === 'SET' && receiptPolicy.countSetsAtReceipt;
    const countResult: ReceiptCheckResult =
      countPerformed && checkedCount !== receiptExpectedCount ? 'MISSING' : visibleDeviation ? 'OTHER' : 'OK';
    const combinedNote = [
      note.trim(),
      !delivererMatches ? `Παράδοση από διαφορετικό τμήμα: ${departmentMismatchReason.trim()}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    receiveAtSterilization(receiptDraft.kind, receiptDraft.asset.id, {
      deliveredByUserId: deliverer.userId,
      deliveredByName: deliverer.name,
      deliveredByDepartment: deliverer.department,
      note: combinedNote || undefined,
      visibleDeviation: visibleDeviation || (countPerformed && checkedCount !== receiptExpectedCount),
      departmentMismatch: !delivererMatches,
      departmentMismatchReason: !delivererMatches ? departmentMismatchReason.trim() : undefined,
      checkPerformed: countPerformed,
      checkedCount: countPerformed ? checkedCount : undefined,
      checkResult: countPerformed ? countResult : visibleDeviation ? 'OTHER' : undefined,
      checkNote: visibleDeviation ? 'Δηλώθηκε εμφανής απόκλιση κατά τη φυσική παραλαβή.' : undefined,
    });
    setReceiptDraft(null);
    setHandoverCode('');
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
    setQueue('INCOMING');
  };
  const openPreparation = (kind: Kind, asset: Asset) => {
    const draft = resolveAssetDraft(kind, asset.id);
    if (!draft) return;
    setPrepDraft(draft);
    setReceiptView(null);
    setAllowMissing(false);
    setPrepCheckedIds(new Set());
    setPrepSelectedToolId(null);
    setPrepReplacementRequirement(null);
    setPrepManageToolId(null);
    setPrepManageMissingCode(null);
    setAcceptedMissingCodes(new Set());
    setPrepToolAction(null);
    setPrepNote('');
    setPrepProcessChecks({
      cleanDry: false,
      functionIntegrity: false,
      assembly: false,
      packaging: false,
      labelIndicator: false,
    });
  };
  const togglePrepItem = (id: string) =>
    setPrepCheckedIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const prepEligibleIds = prepDraft
    ? prepDraft.kind === 'SET'
      ? prepTools.filter(t => !issues.some(i => i.status === 'OPEN' && i.asset.startsWith(t.barcode))).map(t => t.id)
      : prepOpenIssues.length
        ? []
        : [prepDraft.asset.id]
    : [];
  const prepAllEligibleSelected = prepEligibleIds.length > 0 && prepEligibleIds.every(id => prepCheckedIds.has(id));
  const toggleAllPrepChecks = () => setPrepCheckedIds(prepAllEligibleSelected ? new Set() : new Set(prepEligibleIds));
  const openPrepManage = (toolId: string) => {
    setPrepManageMissingCode(null);
    setPrepManageToolId(toolId);
    setPrepSelectedToolId(toolId);
    setPrepReplacementRequirement(null);
  };
  const openMissingManage = (code: string) => {
    setPrepManageToolId(null);
    setPrepManageMissingCode(code);
  };
  const closePrepManage = () => {
    setPrepManageToolId(null);
    setPrepManageMissingCode(null);
    setPrepToolAction(null);
  };
  const acceptMissingWithoutAction = (code: string) => {
    setAcceptedMissingCodes(current => new Set(current).add(code));
    setPrepManageMissingCode(null);
  };
  const undoAcceptedMissing = (code: string) =>
    setAcceptedMissingCodes(current => {
      const next = new Set(current);
      next.delete(code);
      return next;
    });
  const openPrepToolAction = (action: 'REPLACE' | 'SERVICE' | 'STOCK' | 'SET') => {
    if (!prepSelectedTool && !(action === 'REPLACE' && prepReplacementRequirement)) return;
    setPrepToolAction(action);
    setPrepReplacementId('');
    setPrepReplacementSource('STOCK');
    setPrepReplacementSetId('');
    setPrepOutgoingDestination('SERVICE');
    setPrepOutgoingSetId('');
    setPrepTargetSetId('');
  };
  const closePrepToolAction = () => {
    setPrepToolAction(null);
    setPrepReplacementRequirement(null);
    setPrepReplacementId('');
    setPrepReplacementSetId('');
    setPrepOutgoingSetId('');
    setPrepTargetSetId('');
  };
  const applyPrepToolAction = () => {
    if (!prepDraft || prepDraft.kind !== 'SET' || (!prepSelectedTool && !prepReplacementRequirement)) return;
    if (prepToolAction === 'REPLACE') {
      if (!prepReplacementId) return;
      if (!prepSelectedTool) {
        moveTool(prepReplacementId, 'SET', prepDraft.asset.id);
        if (prepReplacementRequirement)
          setAcceptedMissingCodes(current => {
            const next = new Set(current);
            next.delete(prepReplacementRequirement.code);
            return next;
          });
        setPrepSelectedToolId(prepReplacementId);
        setPrepReplacementRequirement(null);
        closePrepToolAction();
        return;
      }
      replaceToolInSet(
        prepDraft.asset.id,
        prepSelectedTool.id,
        prepReplacementId,
        prepOutgoingDestination,
        prepOutgoingDestination === 'SET' ? prepOutgoingSetId : undefined,
      );
      setPrepCheckedIds(current => {
        const next = new Set(current);
        next.delete(prepSelectedTool.id);
        return next;
      });
      setPrepSelectedToolId(prepReplacementId);
      closePrepToolAction();
      return;
    }
    if (!prepSelectedTool) return;
    if (prepToolAction === 'SET') {
      if (!prepTargetSetId) return;
      moveTool(prepSelectedTool.id, 'SET', prepTargetSetId);
    } else if (prepToolAction === 'SERVICE') {
      moveTool(prepSelectedTool.id, 'SERVICE');
    } else if (prepToolAction === 'STOCK') {
      moveTool(prepSelectedTool.id, 'STOCK');
    } else return;
    setAllowMissing(false);
    setPrepCheckedIds(current => {
      const next = new Set(current);
      next.delete(prepSelectedTool.id);
      return next;
    });
    setPrepSelectedToolId(null);
    closePrepToolAction();
  };
  const moveToProcess = (kind: Kind, id: string) => {
    if (!prepDraft || !prepReadyForProcess) return;
    if (prepResolvedShortageIssues.length)
      resolveIssues(
        prepResolvedShortageIssues.map(i => i.id),
        prepAcceptedDeviation
          ? 'Η έλλειψη έγινε αποδεκτή τεκμηριωμένα και το Set προωθήθηκε με απόκλιση.'
          : 'Η σύνθεση αποκαταστάθηκε πριν την προώθηση.',
      );
    recordPreparation(kind, id, {
      toolIds: prepItemIds,
      checkedToolIds: [...prepCheckedIds],
      allOk: prepCompositionComplete,
      processChecks: prepProcessChecks,
      note: [
        prepNote,
        prepAcceptedDeviation
          ? `Αποδεκτή απόκλιση σύνθεσης: ${prepMissingRequirements.length ? prepMissingRequirements.map(req => `${req.missing}× ${req.name}`).join(', ') : `${prepMissingCount} εργαλείο/α`}`
          : '',
      ]
        .filter(Boolean)
        .join(' · '),
    });
    setPrepDraft(null);
    setPrepCheckedIds(new Set());
    setPrepSelectedToolId(null);
    setPrepReplacementRequirement(null);
    setPrepManageToolId(null);
    setPrepManageMissingCode(null);
    setAcceptedMissingCodes(new Set());
    setPrepToolAction(null);
    setPrepNote('');
    setPrepProcessChecks({
      cleanDry: false,
      functionIntegrity: false,
      assembly: false,
      packaging: false,
      labelIndicator: false,
    });
  };
  const openCycleCompletion = (kind: Kind, asset: Asset) => {
    const draft = resolveAssetDraft(kind, asset.id);
    if (!draft) return;
    setCycleDraft(draft);
    setSterilizer('Κλίβανος 1');
    setCycleNumber('');
    setCycleProgram('134°C · 5 min');
    setIndicatorResult('PASS');
    setCycleNote('');
  };
  const closeCycleCompletion = () => {
    setCycleDraft(null);
    setCycleNumber('');
    setCycleNote('');
  };
  const finishCycle = () => {
    if (!cycleDraft || !sterilizer || !cycleNumber.trim() || !cycleProgram) return;
    const record = completeSterilizationCycle(cycleDraft.kind, cycleDraft.asset.id, {
      sterilizer,
      cycleNumber: cycleNumber.trim(),
      program: cycleProgram,
      indicatorResult,
      note: cycleNote,
    });
    if (!record) return;
    closeCycleCompletion();
  };
  const openRelease = (kind: Kind, asset: Asset) => {
    const draft = resolveAssetDraft(kind, asset.id);
    if (!draft) return;
    setReleaseDraft(draft);
    const cycle = latestPassedCycle(asset.id);
    setReleaseChecks({
      physicalParametersOk: false,
      chemicalIndicatorOk: cycle?.indicatorResult === 'PASS',
      packagingIntegrityOk: false,
    });
    setBiologicalIndicatorResult('NOT_REQUIRED');
    setReleaseNote('');
  };
  const closeRelease = () => {
    setReleaseDraft(null);
    setReleaseChecks({physicalParametersOk: false, chemicalIndicatorOk: false, packagingIntegrityOk: false});
    setBiologicalIndicatorResult('NOT_REQUIRED');
    setReleaseNote('');
  };
  const releaseReady =
    Object.values(releaseChecks).every(Boolean) &&
    (biologicalIndicatorResult === 'NOT_REQUIRED' || biologicalIndicatorResult === 'PASS');
  const completeRelease = (decision: 'RELEASED' | 'REPROCESS') => {
    if (!releaseDraft) return;
    const cycle = latestPassedCycle(releaseDraft.asset.id);
    if (!cycle) return;
    if (decision === 'RELEASED' && !releaseReady) return;
    const done = releaseSterilization(releaseDraft.kind, releaseDraft.asset.id, {
      cycleRecordId: cycle.id,
      ...releaseChecks,
      biologicalIndicatorResult,
      decision,
      note: releaseNote,
    });
    if (!done) return;
    closeRelease();
  };
  const openCheckpoint = (kind: Kind, asset: Asset, stageId: 'WASHING' | 'PACKAGING' | 'STORAGE') => {
    const draft = resolveAssetDraft(kind, asset.id);
    if (!draft) return;
    const stage = sterilizationWorkflow.stages.find(item => item.id === stageId);
    setCheckpointDraft({draft, stageId});
    setCheckpointChecks(new Array(stage?.checksEl.length || 0).fill(false));
    setCheckpointNote('');
  };
  const closeCheckpoint = () => {
    setCheckpointDraft(null);
    setCheckpointChecks([]);
    setCheckpointNote('');
  };
  const checkpointStage = checkpointDraft
    ? sterilizationWorkflow.stages.find(stage => stage.id === checkpointDraft.stageId)
    : undefined;
  const checkpointReady =
    !!checkpointStage && checkpointChecks.length === checkpointStage.checksEl.length && checkpointChecks.every(Boolean);
  const finishCheckpoint = () => {
    if (!checkpointDraft || !checkpointReady) return;
    const done = completeWorkflowCheckpoint(checkpointDraft.draft.kind, checkpointDraft.draft.asset.id, {
      stageId: checkpointDraft.stageId,
      checks: checkpointChecks,
      note: checkpointNote,
    });
    if (!done) return;
    closeCheckpoint();
  };
  const openDelivery = (kind: Kind, asset: Asset) => {
    const draft = resolveAssetDraft(kind, asset.id);
    if (!draft) return;
    setDeliveryDraft(draft);
    setReceiverCode('');
    setDeliveryNote('');
  };
  const openLoad = (kind: 'WASHING' | 'STERILIZATION') => {
    const candidates = kind === 'WASHING' ? washing : processing;
    setLoadModal(kind);
    setLoadSelected(kind === 'STERILIZATION' ? new Set() : new Set(candidates.map(item => `${item.kind}:${item.id}`)));
    setLoadEquipment(kind === 'WASHING' ? 'Πλυντήριο 1' : 'Κλίβανος 1');
    setLoadCycleNumber('');
    setLoadProgram(kind === 'WASHING' ? 'Θερμική απολύμανση' : '134°C · 5 min');
    setLoadChemical('PASS');
    setLoadNote('');
    setLoadScanFeedback(null);
  };
  const closeLoad = () => {
    setLoadModal(null);
    setLoadSelected(new Set());
    setLoadCycleNumber('');
    setLoadNote('');
    setLoadScanFeedback(null);
  };
  const toggleLoadAsset = (key: string) =>
    setLoadSelected(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const addBarcodeToLoad = (raw: string) => {
    const barcode = raw.trim().toUpperCase();
    if (!barcode) return false;
    const eligible = loadCandidates.find(item => item.barcode.toUpperCase() === barcode);
    if (!eligible) {
      const known =
        all.find(item => item.barcode.toUpperCase() === barcode) ||
        tools.find(item => item.barcode.toUpperCase() === barcode);
      setLoadScanFeedback({
        type: 'ERROR',
        message: known
          ? `${barcode} αναγνωρίστηκε, αλλά δεν βρίσκεται στο σωστό στάδιο για αυτό το φορτίο.`
          : `${barcode} δεν βρέθηκε στο μητρώο.`,
      });
      return false;
    }
    const key = `${eligible.kind}:${eligible.id}`;
    if (loadSelected.has(key)) {
      setLoadScanFeedback({type: 'WARN', message: `${barcode} είναι ήδη στο φορτίο.`});
      return false;
    }
    setLoadSelected(current => new Set([...current, key]));
    setLoadScanFeedback({type: 'OK', message: `${barcode} · ${eligible.name} προστέθηκε στο φορτίο.`});
    return true;
  };
  const completeLoad = () => {
    if (!loadModal || !loadEquipment.trim() || !loadCycleNumber.trim() || !loadProgram.trim() || !loadSelected.size)
      return;
    const candidates = loadModal === 'WASHING' ? washing : processing;
    const assetRefs = candidates
      .filter(item => loadSelected.has(`${item.kind}:${item.id}`))
      .map(item => ({kind: item.kind, id: item.id}));
    const created = createProcessLoad({
      kind: loadModal,
      assetRefs,
      equipment: loadEquipment.trim(),
      cycleNumber: loadCycleNumber.trim(),
      program: loadProgram.trim(),
      chemicalIndicatorResult: loadModal === 'STERILIZATION' ? loadChemical : undefined,
      note: loadNote.trim() || undefined,
    });
    if (created) closeLoad();
  };
  const openLoadRelease = (id: string) => {
    setReleaseLoadId(id);
    setReleaseLoadChecks({
      physicalParametersOk: false,
      chemicalIndicatorOk: !releasePolicy.requireChemicalIndicator,
      packagingIntegrityOk: false,
    });
    setReleaseLoadBi(releasePolicy.biologicalIndicator === 'REQUIRED' ? 'PENDING' : 'NOT_REQUIRED');
    setReleaseLoadNote('');
  };
  const closeLoadRelease = () => {
    setReleaseLoadId(null);
    setReleaseLoadChecks({physicalParametersOk: false, chemicalIndicatorOk: false, packagingIntegrityOk: false});
    setReleaseLoadBi('NOT_REQUIRED');
    setReleaseLoadNote('');
  };
  const completeLoadRelease = (decision: 'RELEASED' | 'REPROCESS') => {
    if (!releaseLoadId) return;
    const done = releaseProcessLoad(releaseLoadId, {
      ...releaseLoadChecks,
      biologicalIndicatorResult: releaseLoadBi,
      decision,
      note: releaseLoadNote.trim() || undefined,
    });
    if (done) closeLoadRelease();
  };
  const recallLoad = (id: string) => {
    const reason = window.prompt(
      'Αιτιολογία ανάκλησης φορτίου:',
      'Μη αποδεκτό αποτέλεσμα δείκτη / απόκλιση μετά την αποδέσμευση',
    );
    if (!reason?.trim()) return;
    recallProcessLoad(id, reason.trim());
  };
  const closeDelivery = () => {
    setDeliveryDraft(null);
    setReceiverCode('');
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
    setDeliveryBatchReceiverCode('');
    setDeliveryBatchNote('');
    setDeliveryScanFeedback(null);
  };
  const closeDeliveryBatch = () => {
    setDeliveryBatchOpen(false);
    setDeliverySelected(new Set());
    setDeliveryBatchReceiverCode('');
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
          ? `${barcode} αναγνωρίστηκε, αλλά δεν είναι αποδεσμευμένο / έτοιμο για παράδοση.`
          : `${barcode} δεν βρέθηκε στο μητρώο.`,
      });
      return false;
    }
    const key = `${eligible.kind}:${eligible.id}`;
    if (deliverySelected.has(key)) {
      setDeliveryScanFeedback({type: 'WARN', message: `${barcode} έχει ήδη σαρωθεί για αυτή την παράδοση.`});
      return false;
    }
    if (deliveryBatchDepartment && eligible.department !== deliveryBatchDepartment) {
      setDeliveryScanFeedback({
        type: 'ERROR',
        message: `${barcode} ανήκει στο ${eligible.department || 'χωρίς τμήμα'}. Η τρέχουσα παράδοση αφορά το ${deliveryBatchDepartment}. Ολοκλήρωσε πρώτα αυτή την παράδοση.`,
      });
      return false;
    }
    setDeliverySelected(current => new Set([...current, key]));
    setDeliveryBatchReceiverCode('');
    setDeliveryScanFeedback({
      type: 'OK',
      message: `${barcode} · ${eligible.name} προστέθηκε στην παράδοση προς ${eligible.department}.`,
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
      setDeliveryBatchReceiverCode('');
      return;
    }
    if (deliveryBatchDepartment && item.department !== deliveryBatchDepartment) {
      setDeliveryScanFeedback({
        type: 'WARN',
        message: `Η τρέχουσα παράδοση αφορά το ${deliveryBatchDepartment}. Μπορείς να επιλέξεις όσα αντικείμενα θέλεις από το ίδιο τμήμα· για ${item.department} ξεκίνησε ξεχωριστή παράδοση.`,
      });
      return;
    }
    setDeliverySelected(current => new Set([...current, key]));
    setDeliveryBatchReceiverCode('');
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
    setDeliveryBatchReceiverCode('');
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
  const queueTitle =
    queue === 'INCOMING'
      ? 'Αναμονή φυσικής παραλαβής'
      : queue === 'WASHING'
        ? 'Καθαρισμός & Απολύμανση'
        : queue === 'PREP'
          ? 'Έλεγχος & Σύνθεση'
          : queue === 'PACKAGING'
            ? 'Συσκευασία & Σήμανση'
            : queue === 'PROCESS'
              ? 'Αποστείρωση'
              : queue === 'RELEASE'
                ? 'Έλεγχος & Αποδέσμευση'
                : queue === 'STORAGE'
                  ? 'Αποθήκευση'
                  : 'Έτοιμα για παραλαβή';
  const queueStageLabel =
    queue === 'INCOMING'
      ? 'Αναμένει φυσική παράδοση'
      : queue === 'WASHING'
        ? 'Προς καθαρισμό / απολύμανση'
        : queue === 'PREP'
          ? 'Προς έλεγχο / σύνθεση'
          : queue === 'PACKAGING'
            ? 'Προς συσκευασία / σήμανση'
            : queue === 'PROCESS'
              ? 'Σε αποστείρωση'
              : queue === 'RELEASE'
                ? 'Αναμένει αποδέσμευση'
                : queue === 'STORAGE'
                  ? 'Σε αποθήκευση'
                  : 'Έτοιμο για το τμήμα';
  return (
    <div className="sterilization-workspace">
      <div className="ster-work-head">
        <div>
          <span className="eyebrow">ΚΕΝΤΡΙΚΗ ΑΠΟΣΤΕΙΡΩΣΗ</span>
          <h1>Χώρος εργασίας Αποστείρωσης</h1>
          <p>Η ενεργή ροή του νοσοκομείου εφαρμόζεται αυτόματα από το SurgiTrack Studio με πλήρη ιχνηλασιμότητα.</p>
        </div>
        <div className="ster-shift">
          <ShieldCheck size={18} />
          <div>
            <small>Συνδεδεμένος χρήστης</small>
            <strong>{currentUser.name}</strong>
            <span>{currentUser.department}</span>
          </div>
        </div>
      </div>

      <div className="ster-scan ster-scan-restored">
        <div className="ster-scan-icon">
          <ScanBarcode size={23} />
        </div>
        <div className="ster-scan-copy">
          <strong>Γρήγορη σάρωση barcode</strong>
          <span>Scanner υπολογιστή ή χειροκίνητη πληκτρολόγηση · Enter για άμεσο άνοιγμα</span>
        </div>
        <div className="ster-scan-input">
          <Barcode size={17} />
          <input
            autoComplete="off"
            value={quickBarcode}
            onChange={e => {
              setQuickBarcode(e.target.value);
              setQuickScanFeedback('');
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                quickScan();
              }
            }}
            placeholder="S000324 ή T001312"
            aria-label="Γρήγορη σάρωση barcode"
          />
          <button type="button" onClick={quickScan}>
            Άνοιγμα
          </button>
        </div>
        {quickScanFeedback && <div className="ster-scan-feedback-inline">{quickScanFeedback}</div>}
      </div>

      <AssetFilterBar
        compact
        query={query}
        onQueryChange={setQuery}
        placeholder="Αναζήτηση με ονομασία, κωδικό, barcode ή τμήμα..."
        onSubmitQuery={() => scan()}
        filters={[
          {
            key: 'department',
            value: departmentFilter,
            placeholder: 'Όλα τα τμήματα',
            options: queueValues('department').map(value => ({value, label: value})),
            onChange: setDepartmentFilter,
          },
          {
            key: 'specialty',
            value: specialtyFilter,
            placeholder: 'Όλες οι ειδικότητες',
            options: queueValues('specialty').map(value => ({value, label: value})),
            onChange: setSpecialtyFilter,
          },
          {
            key: 'kind',
            value: kindFilter,
            placeholder: 'Σετ & εργαλεία',
            options: [
              {value: 'SET', label: 'Μόνο Σετ'},
              {value: 'TOOL', label: 'Μόνο εργαλεία'},
            ],
            onChange: setKindFilter,
          },
        ]}
      />

      <div className="sterile-queues modern workflow-configured-queues">
        <button className={queue === 'INCOMING' ? 'active' : ''} onClick={() => setQueue('INCOMING')}>
          <Send />
          <span>Παραλαβή</span>
          <strong>{incoming.length}</strong>
          <small>Chain of custody</small>
        </button>
        {(stageEnabled('WASHING') || washing.length > 0) && (
          <button className={queue === 'WASHING' ? 'active' : ''} onClick={() => setQueue('WASHING')}>
            <PackageOpen />
            <span>Καθαρισμός</span>
            <strong>{washing.length}</strong>
            <small>Πλύση / απολύμανση</small>
          </button>
        )}
        {(stageEnabled('PREPARATION') || preparation.length > 0) && (
          <button className={queue === 'PREP' ? 'active' : ''} onClick={() => setQueue('PREP')}>
            <Layers3 />
            <span>Έλεγχος & Σύνθεση</span>
            <strong>{preparation.length}</strong>
            <small>Εργαλεία / αποκλίσεις</small>
          </button>
        )}
        {(stageEnabled('PACKAGING') || packaging.length > 0) && (
          <button className={queue === 'PACKAGING' ? 'active' : ''} onClick={() => setQueue('PACKAGING')}>
            <Box />
            <span>Συσκευασία</span>
            <strong>{packaging.length}</strong>
            <small>Barrier / σήμανση</small>
          </button>
        )}
        <button className={queue === 'PROCESS' ? 'active' : ''} onClick={() => setQueue('PROCESS')}>
          <Flame />
          <span>Αποστείρωση</span>
          <strong>{processing.length}</strong>
          <small>Κύκλος / φορτίο</small>
        </button>
        {(stageEnabled('RELEASE') || awaitingRelease.length > 0) && (
          <button className={queue === 'RELEASE' ? 'active' : ''} onClick={() => setQueue('RELEASE')}>
            <ShieldCheck />
            <span>Αποδέσμευση</span>
            <strong>{awaitingRelease.length}</strong>
            <small>Quality gate</small>
          </button>
        )}
        {(stageEnabled('STORAGE') || storage.length > 0) && (
          <button className={queue === 'STORAGE' ? 'active' : ''} onClick={() => setQueue('STORAGE')}>
            <PackageCheck />
            <span>Αποθήκευση</span>
            <strong>{storage.length}</strong>
            <small>Πριν την παράδοση</small>
          </button>
        )}
        <button className={queue === 'READY' ? 'active' : ''} onClick={() => setQueue('READY')}>
          <UserRoundCheck />
          <span>Παράδοση</span>
          <strong>{ready.length}</strong>
          <small>Προς τμήμα</small>
        </button>
      </div>

      <div className={`ster-work-panel ${queue === 'INCOMING' ? 'receipt-queue-panel' : ''}`}>
        <div className="ster-panel-head">
          <div>
            <strong>{queueTitle}</strong>
            <span>
              {rows.length} {rows.length === 1 ? 'εγγραφή' : 'εγγραφές'}
            </span>
          </div>
          <div className="ster-panel-head-actions">
            {queue === 'INCOMING' && (
              <>
                <span className="ster-hint">
                  Γρήγορη φυσική παραλαβή · δήλωση εμφανής απόκλισης · προαιρετική καταμέτρηση βάσει πολιτικής.
                </span>
                {incoming.length > 0 && (
                  <button className="primary compact" onClick={openReceiptBatch}>
                    <ScanBarcode size={15} /> Μαζική παραλαβή
                  </button>
                )}
              </>
            )}
            {queue === 'WASHING' && (
              <>
                <span className="ster-hint">Τεκμηριωμένο quality gate καθαρισμού / απολύμανσης.</span>
                {washing.length > 0 && (
                  <button className="primary compact" onClick={() => openLoad('WASHING')}>
                    <Layers3 size={15} /> Νέο φορτίο πλυντηρίου
                  </button>
                )}
              </>
            )}
            {queue === 'PREP' && (
              <span className="ster-hint">Έλεγχος λειτουργικότητας, σύνθεση και διαχείριση αποκλίσεων.</span>
            )}
            {queue === 'PACKAGING' && (
              <span className="ster-hint">Έλεγχος sterile barrier, σήμανσης και δείκτη πριν τον κύκλο.</span>
            )}
            {queue === 'PROCESS' && processing.length > 0 && (
              <button className="primary compact" onClick={() => openLoad('STERILIZATION')}>
                <Flame size={15} /> Δημιουργία φορτίου
              </button>
            )}
            {queue === 'STORAGE' && (
              <span className="ster-hint">Προαιρετικός έλεγχος ασφαλούς αποθήκευσης πριν την παράδοση.</span>
            )}
            {queue === 'READY' && ready.length > 0 && (
              <button className="primary compact" onClick={openDeliveryBatch}>
                <ScanBarcode size={15} /> Νέα παράδοση
              </button>
            )}
            {queue === 'RELEASE' && (
              <span className="ster-hint">
                Αποδέσμευση ανά φορτίο με ενιαία τεκμηρίωση CI/BI και φυσικών παραμέτρων.
              </span>
            )}
          </div>
        </div>
        {queue === 'RELEASE' && awaitingLoads.length > 0 && (
          <div className="load-release-strip">
            {awaitingLoads.map(load => (
              <div className="load-release-card" key={load.id}>
                <div>
                  <span>ΦΟΡΤΙΟ · {load.id}</span>
                  <strong>
                    {load.equipment} · {load.cycleNumber}
                  </strong>
                  <small>
                    {load.program} · {load.items.length} αντικείμενα
                  </small>
                </div>
                <button className="primary compact" onClick={() => openLoadRelease(load.id)}>
                  <ShieldCheck size={15} /> Αποδέσμευση φορτίου
                </button>
              </div>
            ))}
          </div>
        )}
        {queue === 'RELEASE' && releasedLoads.length > 0 && (
          <details className="released-loads">
            <summary>Πρόσφατα αποδεσμευμένα φορτία · δυνατότητα ανάκλησης</summary>
            <div>
              {releasedLoads.map(load => (
                <div key={load.id}>
                  <span>
                    <b>{load.id}</b> · {load.equipment} · {load.cycleNumber} · {load.items.length} αντικείμενα
                  </span>
                  <button onClick={() => recallLoad(load.id)}>
                    <TriangleAlert size={14} /> Ανάκληση
                  </button>
                </div>
              ))}
            </div>
          </details>
        )}
        {rows.length === 0 ? (
          <div className="empty ster-empty">
            <PackageCheck size={32} />
            <strong>Δεν υπάρχουν εγγραφές σε αυτό το στάδιο</strong>
            <span>Η ουρά θα ενημερωθεί όταν πραγματοποιηθεί νέα κίνηση.</span>
          </div>
        ) : (
          <>
            <div className="ster-list-head">
              <span>Αντικείμενο</span>
              <span>Τμήμα</span>
              <span>Ειδικότητα</span>
              <span>{queue === 'INCOMING' ? 'Σύνθεση / κατάσταση' : 'Κατάσταση'}</span>
              <span>Στάδιο</span>
              <span>Ενέργειες</span>
            </div>
            <div className="ster-list-scroll">
              {rows.map(x => {
                const assetIssues = issues.filter(i => i.status === 'OPEN' && i.asset.startsWith(x.barcode));
                const detail = x.kind === 'SET' ? `/sets/${x.id}` : `/tools/${x.id}`;
                return (
                  <div className="ster-work-row" key={`${x.kind}-${x.id}`}>
                    <div className="ster-asset-cell">
                      <AssetTypeIcon
                        kind={x.kind}
                        maxUses={x.kind === 'TOOL' ? x.maxUses : undefined}
                        framed
                        className="ster-kind"
                        size={18}
                      />
                      <div className="ster-asset">
                        <div>
                          <Link to={detail} className="mono ster-code">
                            {x.barcode}
                          </Link>
                          <span className="ster-type">{x.kind === 'SET' ? 'ΣΕΤ' : 'ΕΡΓΑΛΕΙΟ'}</span>
                        </div>
                        <Link to={detail} className="ster-asset-name">
                          {x.name}
                        </Link>
                      </div>
                    </div>
                    <div className="ster-cell-text ster-cell-department">
                      <strong>{x.department || 'Χωρίς τμήμα'}</strong>
                      <span className="ster-tablet-specialty">{x.specialty || '—'}</span>
                    </div>
                    <div className="ster-cell-text ster-cell-specialty">
                      <span>{x.specialty || '—'}</span>
                    </div>
                    <div className="ster-meta">
                      {queue === 'INCOMING' ? (
                        x.kind === 'SET' ? (
                          <>
                            <small>Σύνθεση</small>
                            <strong className={x.actual !== x.expected ? 'warn-text' : ''}>
                              {x.actual} / {x.expected}
                            </strong>
                          </>
                        ) : (
                          <span className="ster-object-state">Μεμονωμένο εργαλείο</span>
                        )
                      ) : (
                        <StatusBadge value={x.state} />
                      )}{' '}
                      {assetIssues.length > 0 && (
                        <span className="issue-inline">
                          <TriangleAlert size={14} />
                          {assetIssues.length} ανοικτή
                        </span>
                      )}
                      <small className="ster-tablet-stage">{queueStageLabel}</small>
                    </div>
                    <div className="ster-status">
                      <small>{queueStageLabel}</small>
                    </div>
                    <div className="ster-row-action">
                      {queue === 'INCOMING' ? (
                        <button className="primary compact" onClick={() => openReceipt(x.kind, x)}>
                          <CheckCircle2 size={15} /> Παραλαβή
                        </button>
                      ) : queue === 'WASHING' ? (
                        <button className="primary compact" onClick={() => openCheckpoint(x.kind, x, 'WASHING')}>
                          <PackageOpen size={15} /> Έλεγχος σταδίου
                        </button>
                      ) : queue === 'PREP' ? (
                        <button
                          className="primary compact ster-primary-action"
                          onClick={() => openPreparation(x.kind, x)}
                        >
                          <Layers3 size={15} /> Έλεγχος & Σύνθεση <ArrowRight size={14} />
                        </button>
                      ) : queue === 'PACKAGING' ? (
                        <button className="primary compact" onClick={() => openCheckpoint(x.kind, x, 'PACKAGING')}>
                          <Box size={15} /> Έλεγχος συσκευασίας
                        </button>
                      ) : queue === 'PROCESS' ? (
                        <button className="primary compact" onClick={() => openCycleCompletion(x.kind, x)}>
                          <PackageCheck size={15} /> Καταχώρηση κύκλου
                        </button>
                      ) : queue === 'RELEASE' ? (
                        <button className="primary compact" onClick={() => openRelease(x.kind, x)}>
                          <ShieldCheck size={15} /> Έλεγχος αποδέσμευσης
                        </button>
                      ) : queue === 'STORAGE' ? (
                        <button className="primary compact" onClick={() => openCheckpoint(x.kind, x, 'STORAGE')}>
                          <PackageCheck size={15} /> Έλεγχος αποθήκευσης
                        </button>
                      ) : (
                        <button className="primary compact" onClick={() => openDelivery(x.kind, x)}>
                          <UserRoundCheck size={15} /> Παράδοση στο τμήμα
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {loadModal && (
        <div className="modal-backdrop" onMouseDown={closeLoad}>
          <div className="receipt-card-modal workflow-modal load-modal" onMouseDown={e => e.stopPropagation()}>
            <button className="modal-x" aria-label="Κλείσιμο" title="Κλείσιμο" onClick={closeLoad}>
              <X size={18} />
            </button>
            <div className="workflow-modal-head">
              <div className="ster-kind set">
                {loadModal === 'WASHING' ? <PackageOpen size={20} /> : <Flame size={20} />}
              </div>
              <div className="workflow-modal-title">
                <span className="eyebrow">{loadModal === 'WASHING' ? 'ΦΟΡΤΙΟ ΠΛΥΝΤΗΡΙΟΥ' : 'ΦΟΡΤΙΟ ΑΠΟΣΤΕΙΡΩΣΗΣ'}</span>
                <h2>Δημιουργία ενιαίου φορτίου</h2>
                <p>
                  Επίλεξε τα Set/εργαλεία που μπαίνουν στον ίδιο κύκλο. Η εγγραφή του κύκλου θα συνδεθεί με όλα τα
                  επιλεγμένα barcodes.
                </p>
              </div>
            </div>
            <div className="load-modal-body">
              <div className="cycle-clean-fields">
                <label>
                  {loadModal === 'WASHING' ? 'Πλυντήριο / απολυμαντής' : 'Κλίβανος'}
                  <input value={loadEquipment} onChange={e => setLoadEquipment(e.target.value)} />
                </label>
                <label>
                  Αριθμός κύκλου / φορτίου
                  <input
                    value={loadCycleNumber}
                    onChange={e => setLoadCycleNumber(e.target.value)}
                    placeholder="π.χ. 2026-0815-07"
                  />
                </label>
                <label>
                  Πρόγραμμα
                  <input value={loadProgram} onChange={e => setLoadProgram(e.target.value)} />
                </label>
                {loadModal === 'STERILIZATION' && (
                  <label>
                    Χημικός δείκτης κύκλου
                    <select
                      value={loadChemical}
                      onChange={e => setLoadChemical(e.target.value as 'PASS' | 'FAIL' | 'NOT_RECORDED')}
                    >
                      <option value="PASS">Αποδεκτός</option>
                      <option value="FAIL">Αποτυχία</option>
                      <option value="NOT_RECORDED">Δεν καταγράφηκε</option>
                    </select>
                  </label>
                )}
              </div>
              {loadModal === 'STERILIZATION' && (
                <BarcodeCapture
                  title="Προσθήκη στο φορτίο"
                  subtitle="Σκάναρε, πληκτρολόγησε ή χρησιμοποίησε scanner υπολογιστή."
                  placeholder="Barcode · π.χ. S000324"
                  feedback={loadScanFeedback}
                  onBarcode={addBarcodeToLoad}
                />
              )}
              <section className="load-assets">
                <div className="load-assets-head">
                  <div>
                    <strong>Περιεχόμενο φορτίου</strong>
                    <span>
                      {loadSelected.size} από {loadCandidates.length} επιλεγμένα
                    </span>
                  </div>
                  {loadModal === 'STERILIZATION' ? (
                    <span className="load-assets-mode">
                      <ScanBarcode size={14} /> Barcode / χειροκίνητη επιλογή
                    </span>
                  ) : (
                    <button
                      onClick={() =>
                        setLoadSelected(
                          loadSelected.size === loadCandidates.length
                            ? new Set()
                            : new Set(loadCandidates.map(item => `${item.kind}:${item.id}`)),
                        )
                      }
                    >
                      {loadSelected.size === loadCandidates.length ? 'Αποεπιλογή όλων' : 'Επιλογή όλων'}
                    </button>
                  )}
                </div>
                <div className="load-assets-list">
                  {loadCandidates.map(item => {
                    const key = `${item.kind}:${item.id}`;
                    const selected = loadSelected.has(key);
                    return (
                      <label key={key} className={selected ? 'selected' : ''}>
                        <input type="checkbox" checked={selected} onChange={() => toggleLoadAsset(key)} />
                        <AssetTypeIcon
                          kind={item.kind}
                          maxUses={item.kind === 'TOOL' ? item.maxUses : undefined}
                          size={16}
                        />
                        <span>
                          <b>{item.barcode}</b>
                          <strong>{item.name}</strong>
                          <small>{item.department || 'Χωρίς τμήμα'}</small>
                        </span>
                        {loadModal === 'STERILIZATION' && selected && (
                          <CheckCircle2 className="load-scanned-mark" size={17} />
                        )}
                      </label>
                    );
                  })}
                </div>
              </section>
              <label className="cycle-note">
                Παρατήρηση φορτίου
                <textarea
                  value={loadNote}
                  onChange={e => setLoadNote(e.target.value)}
                  placeholder="Προαιρετική παρατήρηση / απόκλιση…"
                />
              </label>
            </div>
            <div className="modal-actions workflow-modal-actions">
              <button onClick={closeLoad}>Ακύρωση</button>
              <button
                className={
                  loadModal === 'STERILIZATION' && loadChemical === 'FAIL' ? 'danger-action primary' : 'primary'
                }
                disabled={!loadSelected.size || !loadEquipment.trim() || !loadCycleNumber.trim() || !loadProgram.trim()}
                onClick={completeLoad}
              >
                {loadModal === 'STERILIZATION' && loadChemical === 'FAIL' ? (
                  <TriangleAlert size={16} />
                ) : (
                  <CheckCircle2 size={16} />
                )}{' '}
                Ολοκλήρωση φορτίου · {loadSelected.size}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedReleaseLoad && (
        <div className="modal-backdrop" onMouseDown={closeLoadRelease}>
          <div className="receipt-card-modal workflow-modal load-release-modal" onMouseDown={e => e.stopPropagation()}>
            <button className="modal-x" aria-label="Κλείσιμο" title="Κλείσιμο" onClick={closeLoadRelease}>
              <X size={18} />
            </button>
            <div className="workflow-modal-head">
              <div className="ster-kind set">
                <ShieldCheck size={20} />
              </div>
              <div className="workflow-modal-title">
                <span className="eyebrow">QUALITY GATE · ΑΠΟΔΕΣΜΕΥΣΗ ΦΟΡΤΙΟΥ</span>
                <h2>
                  {selectedReleaseLoad.id} · {selectedReleaseLoad.equipment}
                </h2>
                <p>
                  Κύκλος {selectedReleaseLoad.cycleNumber} · {selectedReleaseLoad.program} ·{' '}
                  {selectedReleaseLoad.items.length} αντικείμενα
                </p>
              </div>
            </div>
            <div className="workflow-modal-body">
              <section className="release-check-card">
                <div className="receipt-section-title">
                  <div>
                    <strong>Έλεγχοι φορτίου</strong>
                    <span>Η απόφαση εφαρμόζεται σε όλα τα αντικείμενα που συνδέονται με το συγκεκριμένο φορτίο.</span>
                  </div>
                  <ShieldCheck size={18} />
                </div>
                <label className="release-check-row">
                  <input
                    type="checkbox"
                    checked={releaseLoadChecks.physicalParametersOk}
                    onChange={e => setReleaseLoadChecks(v => ({...v, physicalParametersOk: e.target.checked}))}
                  />
                  <span>
                    <strong>Φυσικές παράμετροι κύκλου αποδεκτές</strong>
                  </span>
                </label>
                <label className="release-check-row">
                  <input
                    type="checkbox"
                    checked={releaseLoadChecks.chemicalIndicatorOk}
                    onChange={e => setReleaseLoadChecks(v => ({...v, chemicalIndicatorOk: e.target.checked}))}
                  />
                  <span>
                    <strong>Χημικός δείκτης αποδεκτός</strong>
                  </span>
                </label>
                <label className="release-check-row">
                  <input
                    type="checkbox"
                    checked={releaseLoadChecks.packagingIntegrityOk}
                    onChange={e => setReleaseLoadChecks(v => ({...v, packagingIntegrityOk: e.target.checked}))}
                  />
                  <span>
                    <strong>Συσκευασίες στεγνές και ακέραιες</strong>
                  </span>
                </label>
                <label className="release-biological">
                  Βιολογικός δείκτης
                  <select
                    value={releaseLoadBi}
                    onChange={e => setReleaseLoadBi(e.target.value as 'NOT_REQUIRED' | 'PASS' | 'PENDING' | 'FAIL')}
                  >
                    <option value="NOT_REQUIRED">Δεν απαιτείται βάσει πολιτικής / κύκλου</option>
                    <option value="PASS">Αρνητικός / επιτυχής</option>
                    <option value="PENDING">Σε αναμονή</option>
                    <option value="FAIL">Θετικός / αποτυχία</option>
                  </select>
                </label>
              </section>
              <div className="load-manifest">
                <strong>Manifest φορτίου</strong>
                {selectedReleaseLoad.items.map(item => (
                  <div key={`${item.assetKind}:${item.assetId}`}>
                    <span className="mono">{item.barcode}</span>
                    <b>{item.assetName}</b>
                    <small>{item.department}</small>
                  </div>
                ))}
              </div>
              <label className="cycle-note">
                Παρατήρηση αποδέσμευσης
                <textarea
                  value={releaseLoadNote}
                  onChange={e => setReleaseLoadNote(e.target.value)}
                  placeholder="Προαιρετική παρατήρηση / αιτιολογία…"
                />
              </label>
            </div>
            <div className="modal-actions workflow-modal-actions release-actions">
              <button onClick={closeLoadRelease}>Ακύρωση</button>
              <button className="release-reprocess" onClick={() => completeLoadRelease('REPROCESS')}>
                <TriangleAlert size={16} /> Μη αποδέσμευση · όλο το φορτίο
              </button>
              <button className="primary" disabled={!releaseLoadReady} onClick={() => completeLoadRelease('RELEASED')}>
                <ShieldCheck size={16} /> Αποδέσμευση φορτίου · {selectedReleaseLoad.items.length}
              </button>
            </div>
          </div>
        </div>
      )}

      {checkpointDraft && checkpointStage && (
        <div className="modal-backdrop" onMouseDown={closeCheckpoint}>
          <div
            className="receipt-card-modal workflow-modal workflow-checkpoint-modal"
            onMouseDown={e => e.stopPropagation()}
          >
            <button className="modal-x" aria-label="Κλείσιμο" title="Κλείσιμο" onClick={closeCheckpoint}>
              <X size={18} />
            </button>
            <div className="workflow-modal-head">
              <AssetTypeIcon
                kind={checkpointDraft.draft.kind}
                maxUses={checkpointDraft.draft.kind === 'TOOL' ? checkpointDraft.draft.asset.maxUses : undefined}
                framed
                className="ster-kind"
                size={19}
              />
              <div className="workflow-modal-title">
                <span className="eyebrow">QUALITY GATE · {checkpointStage.labelEl.toUpperCase()}</span>
                <h2>
                  {checkpointDraft.draft.asset.barcode} · {checkpointDraft.draft.asset.name}
                </h2>
                <p>{checkpointStage.descriptionEl}</p>
              </div>
              <StatusBadge value={checkpointDraft.draft.asset.state} />
            </div>
            <div className="workflow-checkpoint-body">
              <div className="workflow-checkpoint-user">
                <UserCheck size={18} />
                <div>
                  <small>Καταγράφεται από</small>
                  <strong>{currentUser.name}</strong>
                  <span>
                    {currentUser.department} ·{' '}
                    {new Date().toLocaleString('el-GR', {dateStyle: 'short', timeStyle: 'short'})}
                  </span>
                </div>
              </div>
              <section className="release-check-card">
                <div className="receipt-section-title">
                  <div>
                    <strong>Απαιτούμενοι έλεγχοι</strong>
                    <span>Όλοι οι ενεργοί έλεγχοι πρέπει να επιβεβαιωθούν για να προχωρήσει η ροή.</span>
                  </div>
                  <ShieldCheck size={18} />
                </div>
                {checkpointStage.checksEl.map((check, index) => (
                  <label className="release-check-row" key={check}>
                    <input
                      type="checkbox"
                      checked={checkpointChecks[index] || false}
                      onChange={e =>
                        setCheckpointChecks(list => list.map((value, i) => (i === index ? e.target.checked : value)))
                      }
                    />
                    <span>
                      <strong>{check}</strong>
                    </span>
                  </label>
                ))}
              </section>
              <label className="cycle-note">
                Παρατήρηση σταδίου
                <textarea
                  value={checkpointNote}
                  onChange={e => setCheckpointNote(e.target.value)}
                  placeholder="Προαιρετική παρατήρηση ή αριθμός κύκλου / πλυντηρίου…"
                />
              </label>
            </div>
            <div className="modal-actions workflow-modal-actions">
              <button onClick={closeCheckpoint}>Ακύρωση</button>
              <button className="primary" disabled={!checkpointReady} onClick={finishCheckpoint}>
                <CheckCircle2 size={16} /> Ολοκλήρωση · Επόμενο στάδιο
              </button>
            </div>
          </div>
        </div>
      )}

      {receiptDraft && (
        <div className="modal-backdrop" onMouseDown={closeReceipt}>
          <div className="receipt-card-modal" onMouseDown={e => e.stopPropagation()}>
            <button className="modal-x" aria-label="Κλείσιμο" title="Κλείσιμο" onClick={closeReceipt}>
              <X size={18} />
            </button>
            <div className="receipt-card-head">
              <AssetTypeIcon
                kind={receiptDraft.kind}
                maxUses={receiptDraft.kind === 'TOOL' ? receiptDraft.asset.maxUses : undefined}
                framed
                className="ster-kind"
                size={19}
              />
              <div>
                <span>ΚΑΡΤΕΛΑ ΠΑΡΑΛΑΒΗΣ</span>
                <h2>
                  {receiptDraft.asset.barcode} · {receiptDraft.asset.name}
                </h2>
                <p>{receiptDraft.asset.department} → Κεντρική Αποστείρωση</p>
              </div>
            </div>

            <div className="receipt-card-body receipt-two-column">
              <div className="receipt-left-panel">
                <section className="receipt-work-section">
                  <div className="receipt-section-title">
                    <div>
                      <strong>Στοιχεία παραλαβής</strong>
                      <span>Φυσική παράδοση και στοιχεία παραλαμβάνοντα.</span>
                    </div>
                  </div>
                  <div className="receipt-summary-grid compact-summary">
                    <div>
                      <Building2 />
                      <span>Τμήμα αποστολής</span>
                      <strong>{receiptDraft.asset.department}</strong>
                    </div>
                    <div>
                      <Clock3 />
                      <span>Ημερομηνία / ώρα</span>
                      <strong>{new Date().toLocaleString('el-GR', {dateStyle: 'short', timeStyle: 'short'})}</strong>
                    </div>
                    <div>
                      <UserCheck />
                      <span>Παραλαμβάνει</span>
                      <strong>{currentUser.name}</strong>
                      <small>{currentUser.department}</small>
                    </div>
                    {receiptDraft.kind === 'SET' ? (
                      <div>
                        <ClipboardCheck />
                        <span>Δηλωμένη σύνθεση</span>
                        <strong
                          className={receiptDraft.asset.actual !== receiptDraft.asset.expected ? 'warn-text' : ''}
                        >
                          {receiptExpectedCount} τεμάχια
                        </strong>
                        <small>{receiptExpectedCount} φυσικές εγγραφές</small>
                      </div>
                    ) : (
                      <div>
                        <Stethoscope />
                        <span>Τύπος</span>
                        <strong>Μεμονωμένο εργαλείο</strong>
                      </div>
                    )}
                  </div>
                </section>

                <section className="receipt-work-section identity-work-section">
                  <div className="receipt-section-title">
                    <div>
                      <strong>Ταυτοποίηση παραδίδοντα</strong>
                      <span>Επιβεβαίωση με προσωπικό κωδικό.</span>
                    </div>
                    <IdCard size={18} />
                  </div>
                  <div className="identity-section">
                    <label>
                      Κωδικός ταυτοποίησης
                      <div className="identity-input-row">
                        <input
                          autoFocus
                          value={handoverCode}
                          onChange={e => setHandoverCode(e.target.value.toUpperCase())}
                          placeholder="Κωδικός χρήστη"
                        />
                        {demoIdentity && (
                          <button
                            type="button"
                            className="demo-fill-btn"
                            onClick={() => setHandoverCode(demoIdentity.code)}
                          >
                            Demo
                          </button>
                        )}
                      </div>
                    </label>
                    {demoIdentity && (
                      <small className="demo-code">
                        Demo: {demoIdentity.code} · {demoIdentity.department}
                      </small>
                    )}
                    {handoverCode &&
                      (!deliverer ? (
                        <div className="identity-error">Ο κωδικός δεν αναγνωρίστηκε.</div>
                      ) : !delivererMatches ? (
                        <div className="identity-mismatch-box">
                          <div className="identity-warning">
                            <TriangleAlert size={16} />
                            <span>
                              Ο χρήστης ανήκει στο <b>{deliverer.department}</b>, ενώ η αποστολή προέρχεται από{' '}
                              <b>{receiptDraft.asset.department}</b>.
                            </span>
                          </div>
                          {receiptPolicy.allowCrossDepartmentHandover ? (
                            <label>
                              Αιτιολόγηση εξαίρεσης
                              <textarea
                                value={departmentMismatchReason}
                                onChange={e => setDepartmentMismatchReason(e.target.value)}
                                placeholder="Π.χ. εξουσιοδοτημένη μεταφορά από άλλο τμήμα…"
                              />
                            </label>
                          ) : (
                            <div className="identity-error">
                              Η πολιτική της μονάδας δεν επιτρέπει παραλαβή από διαφορετικό τμήμα.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="identity-result">
                          <CheckCircle2 size={17} />
                          <div>
                            <strong>{deliverer.name}</strong>
                            <span>
                              {deliverer.role} · {deliverer.department}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                  <div className="handover-warning compact-warning">
                    <TriangleAlert size={16} />
                    <span>Η παραλαβή ολοκληρώνεται μόνο μετά την ταυτοποίηση.</span>
                  </div>
                </section>

                <section className="receipt-work-section receipt-check-section">
                  <div className="receipt-section-title">
                    <div>
                      <strong>Εμφανής κατάσταση κατά την παραλαβή</strong>
                      <span>Δεν υποκαθιστά τον αναλυτικό Έλεγχο & Σύνθεση.</span>
                    </div>
                    <TriangleAlert size={18} />
                  </div>
                  <div className="receipt-visible-deviation">
                    <button
                      type="button"
                      className={!visibleDeviation ? 'active ok' : ''}
                      onClick={() => {
                        setVisibleDeviation(false);
                        setReceiptDeviationRecorded(false);
                      }}
                    >
                      <CheckCircle2 size={16} /> Χωρίς εμφανή απόκλιση
                    </button>
                    <button
                      type="button"
                      className={visibleDeviation ? 'active warn' : ''}
                      onClick={() => setVisibleDeviation(true)}
                    >
                      <TriangleAlert size={16} /> Υπάρχει εμφανής απόκλιση
                    </button>
                  </div>
                  {visibleDeviation && (
                    <div className={`handover-warning compact-warning ${receiptDeviationRecorded ? 'recorded' : ''}`}>
                      <TriangleAlert size={16} />
                      <span>
                        {receiptDeviationRecorded
                          ? 'Η εμφανής απόκλιση έχει καταγραφεί. Μπορείς να ολοκληρώσεις την παραλαβή.'
                          : 'Απαιτείται καταγραφή: χρησιμοποίησε «Αναφορά Σετ» ή «Αναφορά» στο συγκεκριμένο εργαλείο.'}
                      </span>
                    </div>
                  )}
                  {receiptDraft.kind === 'SET' && receiptPolicy.countSetsAtReceipt && (
                    <div className="receipt-count-only">
                      <div>
                        <span>Αναμενόμενα</span>
                        <strong>{receiptExpectedCount}</strong>
                      </div>
                      <label>
                        Παραληφθέντα
                        <input
                          type="number"
                          min={0}
                          max={receiptExpectedCount}
                          value={checkedCount}
                          onChange={e =>
                            setCheckedCount(Math.max(0, Math.min(receiptExpectedCount, Number(e.target.value))))
                          }
                        />
                      </label>
                      {checkedCount !== receiptExpectedCount && (
                        <div className="identity-warning">
                          <TriangleAlert size={15} />
                          <span>Η διαφορά ποσότητας θα καταγραφεί αυτόματα ως έλλειψη.</span>
                        </div>
                      )}
                    </div>
                  )}
                </section>

                <section className="receipt-work-section receipt-inline-note-section">
                  {!receiptNoteOpen ? (
                    <button type="button" className="receipt-add-note-btn" onClick={() => setReceiptNoteOpen(true)}>
                      <span className="receipt-add-note-plus">+</span>
                      <span>
                        <strong>Προσθήκη παρατήρησης</strong>
                        <small>Προαιρετική σημείωση για τη φυσική παραλαβή</small>
                      </span>
                    </button>
                  ) : (
                    <div className="receipt-inline-note-editor">
                      <div className="receipt-inline-note-head">
                        <div>
                          <strong>Παρατήρηση παραλαβής</strong>
                          <small>Προαιρετικά</small>
                        </div>
                        <button
                          type="button"
                          className="receipt-note-close"
                          onClick={() => {
                            setReceiptNoteOpen(false);
                            setNote('');
                          }}
                          aria-label="Κλείσιμο παρατήρησης"
                        >
                          <X size={15} />
                        </button>
                      </div>
                      <textarea
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        placeholder="Κατάσταση μεταφοράς ή άλλη παρατήρηση…"
                      />
                    </div>
                  )}
                </section>
              </div>

              <div className="receipt-right-panel">
                {receiptDraft.kind === 'SET' ? (
                  <section className="receipt-work-section receipt-set-tools">
                    <div className="prep-tools-head prep-tools-toolbar receipt-tools-toolbar">
                      <div className="receipt-tools-title-block">
                        <div>
                          <strong>Φυσική σύνθεση Σετ</strong>
                          <span>{receiptTools.length} εργαλεία — αναφορά μόνο αν εντοπιστεί εμφανές πρόβλημα</span>
                        </div>
                      </div>
                      <div className="prep-tools-toolbar-actions">
                        <button
                          type="button"
                          className="set-report-btn"
                          onClick={() =>
                            openIssueReport('SET', receiptDraft.asset.id, 'Αποστείρωση · κατά την παραλαβή')
                          }
                        >
                          <TriangleAlert size={14} /> Αναφορά Σετ
                        </button>
                      </div>
                    </div>
                    <div className="receipt-tool-columns">
                      <span>Barcode</span>
                      <span>Κωδικός</span>
                      <span>Όνομα εργαλείου</span>
                      <span>Εταιρεία</span>
                      <span>Κατάσταση</span>
                      <span>Ενέργεια</span>
                    </div>
                    <div className="prep-tools-scroll receipt-tools-scroll">
                      {receiptTools.length === 0 ? (
                        <div className="empty compact-empty">Δεν υπάρχουν συνδεδεμένα εργαλεία στο demo.</div>
                      ) : (
                        receiptTools.map(t => {
                          const toolIssues = issues.filter(i => i.status === 'OPEN' && i.asset.startsWith(t.barcode));
                          const remaining = t.maxUses ? Math.max(0, t.maxUses - t.uses) : null;
                          const checked = receiptCheckedToolIds.has(t.id);
                          const problem = receiptProblemToolIds.has(t.id) || toolIssues.length > 0;
                          return (
                            <div
                              className={`receipt-verification-row ${checked ? 'checked' : ''} ${problem ? 'has-issue' : ''}`}
                              key={t.id}
                            >
                              <span className="mono receipt-tool-barcode">{t.barcode}</span>
                              <span className="receipt-tool-code">{t.code || '—'}</span>
                              <div className="receipt-tool-name">
                                <strong>{t.name}</strong>
                                {t.serialNumber && <small>S/N {t.serialNumber}</small>}
                                {t.maxUses && (
                                  <small>
                                    Υπόλοιπο {remaining}/{t.maxUses}
                                  </small>
                                )}
                              </div>
                              <span className="receipt-tool-manufacturer">{t.manufacturer || '—'}</span>
                              <div className="receipt-tool-state">
                                {problem ? (
                                  toolIssues.map(i => (
                                    <span className="prep-issue-chip" key={i.id}>
                                      <TriangleAlert size={12} />
                                      {i.type}
                                    </span>
                                  ))
                                ) : (
                                  <span className="prep-ok-chip">Χωρίς απόκλιση</span>
                                )}
                              </div>
                              <button
                                className="tool-report-btn"
                                type="button"
                                onClick={() => openIssueReport('TOOL', t.id, 'Αποστείρωση · κατά την παραλαβή')}
                              >
                                <TriangleAlert size={14} /> Αναφορά
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </section>
                ) : (
                  <section className="receipt-work-section receipt-single-tool-panel">
                    <div className="prep-tools-head prep-tools-toolbar receipt-tools-toolbar">
                      <div>
                        <strong>Μεμονωμένο εργαλείο κατά την παραλαβή</strong>
                        <span>
                          Τα βασικά στοιχεία εμφανίζονται σε μία καθαρή γραμμή · αναφορά μόνο αν εντοπιστεί εμφανές
                          πρόβλημα
                        </span>
                      </div>
                      <div className="prep-tools-toolbar-actions"></div>
                    </div>
                    <div className="receipt-tool-columns">
                      <span>Barcode</span>
                      <span>Κωδικός</span>
                      <span>Όνομα εργαλείου</span>
                      <span>Εταιρεία</span>
                      <span>Κατάσταση</span>
                      <span>Ενέργεια</span>
                    </div>
                    <div className="prep-tools-scroll receipt-tools-scroll single-receipt-scroll">
                      {(() => {
                        const t = receiptDraft.asset;
                        const toolIssues = issues.filter(i => i.status === 'OPEN' && i.asset.startsWith(t.barcode));
                        const remaining = t.maxUses ? Math.max(0, t.maxUses - t.uses) : null;
                        const checked = receiptCheckedToolIds.has(t.id);
                        const problem = receiptProblemToolIds.has(t.id) || toolIssues.length > 0;
                        return (
                          <div
                            className={`receipt-verification-row ${checked ? 'checked' : ''} ${problem ? 'has-issue' : ''}`}
                          >
                            <span className="mono receipt-tool-barcode">{t.barcode}</span>
                            <span className="receipt-tool-code">{t.code || '—'}</span>
                            <div className="receipt-tool-name">
                              <strong>{t.name}</strong>
                              {t.serialNumber && <small>S/N {t.serialNumber}</small>}
                              {t.maxUses && (
                                <small>
                                  Υπόλοιπο {remaining}/{t.maxUses}
                                </small>
                              )}
                            </div>
                            <span className="receipt-tool-manufacturer">{t.manufacturer || '—'}</span>
                            <div className="receipt-tool-state">
                              {problem ? (
                                toolIssues.map(i => (
                                  <span className="prep-issue-chip" key={i.id}>
                                    <TriangleAlert size={12} />
                                    {i.type}
                                  </span>
                                ))
                              ) : (
                                <span className="prep-ok-chip">Χωρίς απόκλιση</span>
                              )}
                            </div>
                            <button
                              className="tool-report-btn"
                              type="button"
                              onClick={() => openIssueReport('TOOL', t.id, 'Αποστείρωση · κατά την παραλαβή')}
                            >
                              <TriangleAlert size={14} /> Αναφορά
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  </section>
                )}
              </div>
            </div>

            <div className="modal-actions receipt-final-bar receipt-final-actions-only">
              <button onClick={closeReceipt}>Ακύρωση</button>
              <button
                className="primary"
                disabled={!receiptIdentityValid || (visibleDeviation && !receiptDeviationRecorded)}
                onClick={confirmReceipt}
              >
                <UserRoundCheck size={16} /> Επιβεβαίωση φυσικής παραλαβής
              </button>
            </div>
          </div>
        </div>
      )}

      {issueTarget && (
        <div className="nested-modal-backdrop" onMouseDown={closeIssueReport}>
          <div className="tool-issue-card" onMouseDown={e => e.stopPropagation()}>
            <button className="modal-x" aria-label="Κλείσιμο" title="Κλείσιμο" onClick={closeIssueReport}>
              <X size={17} />
            </button>
            <span className="eyebrow">{issueTarget.kind === 'SET' ? 'ΑΝΑΦΟΡΑ ΣΕΤ' : 'ΑΝΑΦΟΡΑ ΕΡΓΑΛΕΙΟΥ'}</span>
            <h3>
              {issueTarget.kind === 'SET'
                ? `${sets.find(x => x.id === issueTarget.id)?.barcode || ''} · ${sets.find(x => x.id === issueTarget.id)?.name || ''}`
                : `${tools.find(t => t.id === issueTarget.id)?.barcode || ''} · ${tools.find(t => t.id === issueTarget.id)?.name || ''}`}
            </h3>
            <div className="issue-context">
              <AssetTypeIcon
                kind={issueTarget.kind}
                maxUses={issueTarget.kind === 'TOOL' ? tools.find(t => t.id === issueTarget.id)?.maxUses : undefined}
                framed
                size={18}
              />
              <span>{issueSource}</span>
            </div>
            <label>
              Τύπος αναφοράς
              <select value={issueType} onChange={e => setIssueType(e.target.value)}>
                <option>Βλάβη / μη λειτουργικό</option>
                <option>Φθορά</option>
                <option>Κατεστραμμένο</option>
                {issueTarget.kind === 'SET' && <option>Έλλειψη σύνθεσης</option>}
                <option>Άλλο πρόβλημα</option>
              </select>
            </label>
            <label>
              Παρατήρηση
              <textarea
                value={issueNote}
                onChange={e => setIssueNote(e.target.value)}
                placeholder={
                  issueTarget.kind === 'SET'
                    ? 'Περιέγραψε το πρόβλημα που αφορά το Σετ…'
                    : 'Περιέγραψε τι διαπιστώθηκε στο εργαλείο…'
                }
              />
            </label>
            <div className="issue-photo-field">
              <div className="issue-photo-head">
                <div>
                  <strong>Φωτογραφίες φθοράς / βλάβης</strong>
                  <span>Προαιρετικά, μία ή περισσότερες φωτογραφίες.</span>
                </div>
                <div className="issue-photo-actions">
                  <button
                    type="button"
                    className="app-button app-button-secondary app-button-sm"
                    onClick={() => setIssueCameraOpen(true)}
                  >
                    <Camera size={15} /> Λήψη
                  </button>
                  <label className="app-button app-button-secondary app-button-sm">
                    <ImagePlus size={15} /> Upload
                    <input
                      className="visually-hidden-file"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={async e => {
                        await addIssuePhotos([...(e.currentTarget.files || [])]);
                        e.currentTarget.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>
              {issuePhotos.length > 0 && (
                <div className="issue-photo-preview">
                  {issuePhotos.map(photo => (
                    <div key={photo.id}>
                      <img src={photo.dataUrl} alt={photo.name} />
                      <button
                        type="button"
                        onClick={() => setIssuePhotos(current => current.filter(item => item.id !== photo.id))}
                        aria-label="Αφαίρεση φωτογραφίας"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" onClick={closeIssueReport}>
                Ακύρωση
              </button>
              <button type="button" className="primary" onClick={saveIssueReport}>
                <TriangleAlert size={15} /> Καταχώρηση αναφοράς
              </button>
            </div>
          </div>
        </div>
      )}
      {issueCameraOpen && (
        <CameraCaptureModal
          onCapture={async file => {
            await addIssuePhotos([file]);
            setIssueCameraOpen(false);
          }}
          onClose={() => setIssueCameraOpen(false)}
        />
      )}

      {prepDraft && (
        <div className="modal-backdrop" onMouseDown={() => setPrepDraft(null)}>
          <div className="receipt-card-modal prep-modal prep-workspace-modal" onMouseDown={e => e.stopPropagation()}>
            <button className="modal-x" aria-label="Κλείσιμο" title="Κλείσιμο" onClick={() => setPrepDraft(null)}>
              <X size={18} />
            </button>
            <div className="receipt-card-head">
              <AssetTypeIcon
                kind={prepDraft.kind}
                maxUses={prepDraft.kind === 'TOOL' ? prepDraft.asset.maxUses : undefined}
                framed
                className="ster-kind"
                size={19}
              />
              <div>
                <span>ΣΥΝΘΕΣΗ & ΠΡΟΕΤΟΙΜΑΣΙΑ</span>
                <h2>
                  {prepDraft.asset.barcode} · {prepDraft.asset.name}
                </h2>
                <p>Έλεγχος φυσικών εργαλείων μετά το πλύσιμο και πριν τον κλιβανισμό.</p>
              </div>
            </div>
            <div className="prep-workspace-body">
              <aside className="prep-control-panel">
                <section className="prep-card-section">
                  <div className="prep-section-head">
                    <div>
                      <strong>Στοιχεία προετοιμασίας</strong>
                      <span>Ο χρήστης καταγράφεται αυτόματα στην καρτέλα.</span>
                    </div>
                  </div>
                  <div className="prep-facts">
                    <div>
                      <UserCheck />
                      <span>Προετοιμάζει</span>
                      <strong>{currentUser.name}</strong>
                      <small>{currentUser.department}</small>
                    </div>
                    <div>
                      <Clock3 />
                      <span>Ημερομηνία / ώρα</span>
                      <strong>{new Date().toLocaleString('el-GR', {dateStyle: 'short', timeStyle: 'short'})}</strong>
                    </div>
                    <div>
                      <Layers3 />
                      <span>Φυσικά εργαλεία</span>
                      <strong>{prepItemIds.length}</strong>
                    </div>
                    <div className={prepBlockingIssues.length ? 'warning' : ''}>
                      <TriangleAlert />
                      <span>Εκκρεμότητες που μπλοκάρουν</span>
                      <strong>{prepBlockingIssues.length}</strong>
                    </div>
                  </div>
                </section>
                <section className="prep-card-section prep-quality-section">
                  <div className="prep-section-head">
                    <div>
                      <strong>Έλεγχος & προετοιμασία</strong>
                      <span>Τεκμηρίωση πριν από συσκευασία και κλιβανισμό.</span>
                    </div>
                  </div>
                  <div className="prep-check-summary">
                    <div>
                      <span>Ελεγμένα εργαλεία</span>
                      <strong>
                        {prepCheckedIds.size} / {prepItemIds.length}
                      </strong>
                    </div>
                    <div>
                      <span>Σύνθεση</span>
                      <strong>
                        {prepDraft.kind === 'SET' ? `${prepTools.length} / ${prepDraft.asset.expected}` : '1 / 1'}
                      </strong>
                    </div>
                  </div>
                  {prepBlockingIssues.length > 0 && (
                    <div className="prep-block-warning">
                      <TriangleAlert size={16} />
                      <span>
                        Υπάρχουν {prepBlockingIssues.length} εκκρεμότητες που απαιτούν ενέργεια πριν την προώθηση.
                      </span>
                    </div>
                  )}
                  {prepAcceptedDeviation && prepBlockingIssues.length === 0 && (
                    <div className="prep-accepted-warning">
                      <CheckCircle2 size={16} />
                      <span>
                        Η έλλειψη έχει γίνει αποδεκτή ως τεκμηριωμένη απόκλιση. Η διαδικασία μπορεί να προχωρήσει όταν
                        ολοκληρωθούν οι υπόλοιποι έλεγχοι.
                      </span>
                    </div>
                  )}
                  <div className="prep-process-checks">
                    <strong>Έλεγχοι πριν τον κλιβανισμό</strong>
                    {!stageEnabled('WASHING') && (
                      <label>
                        <input
                          type="checkbox"
                          checked={prepProcessChecks.cleanDry}
                          onChange={e => setPrepProcessChecks(v => ({...v, cleanDry: e.target.checked}))}
                        />
                        <span>
                          <b>Καθαρότητα & στέγνωμα</b>
                          <small>Τα εργαλεία είναι οπτικά καθαρά και πλήρως στεγνά.</small>
                        </span>
                      </label>
                    )}
                    <label>
                      <input
                        type="checkbox"
                        checked={prepProcessChecks.functionIntegrity}
                        onChange={e => setPrepProcessChecks(v => ({...v, functionIntegrity: e.target.checked}))}
                      />
                      <span>
                        <b>Ακεραιότητα & λειτουργικότητα</b>
                        <small>Δεν διαπιστώθηκε βλάβη και η λειτουργία είναι αποδεκτή.</small>
                      </span>
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={prepProcessChecks.assembly}
                        onChange={e => setPrepProcessChecks(v => ({...v, assembly: e.target.checked}))}
                      />
                      <span>
                        <b>{prepDraft.kind === 'SET' ? 'Σύνθεση & συναρμολόγηση' : 'Επιβεβαίωση εργαλείου'}</b>
                        <small>
                          {prepDraft.kind === 'SET'
                            ? 'Η σύνθεση έχει ελεγχθεί και συναρμολογηθεί σύμφωνα με τη δηλωμένη καρτέλα.'
                            : 'Το εργαλείο και τα απαιτούμενα μέρη του έχουν ελεγχθεί.'}
                        </small>
                      </span>
                    </label>
                    {!stageEnabled('PACKAGING') && (
                      <>
                        <label>
                          <input
                            type="checkbox"
                            checked={prepProcessChecks.packaging}
                            onChange={e => setPrepProcessChecks(v => ({...v, packaging: e.target.checked}))}
                          />
                          <span>
                            <b>Συσκευασία / περιέκτης</b>
                            <small>Επιλέχθηκε κατάλληλη και ακέραιη συσκευασία ή περιέκτης.</small>
                          </span>
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={prepProcessChecks.labelIndicator}
                            onChange={e => setPrepProcessChecks(v => ({...v, labelIndicator: e.target.checked}))}
                          />
                          <span>
                            <b>Σήμανση & δείκτης</b>
                            <small>Η σήμανση και ο απαιτούμενος χημικός δείκτης έχουν τοποθετηθεί.</small>
                          </span>
                        </label>
                      </>
                    )}
                  </div>
                  <label className="prep-note-field">
                    Παρατήρηση προετοιμασίας
                    <textarea
                      value={prepNote}
                      onChange={e => setPrepNote(e.target.value)}
                      placeholder="Προαιρετική παρατήρηση για σύνθεση, συσκευασία ή άλλη απόκλιση…"
                    />
                  </label>
                </section>
                <section className="prep-card-section">
                  <div className="prep-section-head">
                    <div>
                      <strong>Εκτυπώσεις</strong>
                      <span>Φύλλο σύνθεσης Α4 και barcode.</span>
                    </div>
                  </div>
                  <div className="prep-print-actions">
                    {prepDraft.kind === 'SET' && (
                      <button
                        type="button"
                        onClick={() =>
                          printCompositionA4(
                            prepDraft.asset,
                            prepTools,
                            currentUser.name,
                            new Date().toLocaleString('el-GR', {dateStyle: 'short', timeStyle: 'short'}),
                            prepTools
                              .filter(t => issues.some(i => i.status === 'OPEN' && i.asset.startsWith(t.barcode)))
                              .map(t => t.barcode),
                          )
                        }
                      >
                        <Printer size={16} /> Εκτύπωση
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        printBarcodeLabel(
                          prepDraft.asset,
                          prepDraft.kind,
                          prepDraft.kind === 'SET' ? prepTools.length : undefined,
                        )
                      }
                    >
                      <Barcode size={16} /> Εκτύπωση barcode
                    </button>
                  </div>
                </section>
              </aside>
              <section className="prep-tools-panel">
                {prepDraft.kind === 'SET' && (
                  <div className={`prep-composition-status compact ${prepMissingCount > 0 ? 'missing' : 'complete'}`}>
                    {prepMissingCount > 0 ? <TriangleAlert size={16} /> : <CheckCircle2 size={16} />}
                    <div>
                      <strong>
                        {prepMissingCount > 0
                          ? `Σύνθεση ${prepTools.length}/${prepExpectedCount} · ${prepMissingCount} ${prepMissingCount === 1 ? 'έλλειψη' : 'ελλείψεις'}`
                          : `Σύνθεση πλήρης · ${prepTools.length}/${prepExpectedCount}`}
                      </strong>
                      <span>
                        {prepMissingCount > 0
                          ? 'Η έλλειψη εμφανίζεται και διαχειρίζεται μέσα στη λίστα εργαλείων.'
                          : 'Όλες οι αναμενόμενες θέσεις της σύνθεσης είναι καλυμμένες.'}
                      </span>
                    </div>
                  </div>
                )}
                <div className="prep-tools-head prep-tools-toolbar prep-tools-toolbar-refined">
                  <div className="prep-tools-heading-block">
                    <div>
                      <strong>{prepDraft.kind === 'SET' ? 'Εργαλεία Σετ' : 'Μεμονωμένο εργαλείο'}</strong>
                      <span>
                        {prepDraft.kind === 'SET'
                          ? `${prepTools.length} φυσικές εγγραφές — έλεγχος και διαχείριση ανά εργαλείο`
                          : 'Έλεγχος και επιβεβαίωση πριν τη συσκευασία'}
                      </span>
                      {prepDraft.kind === 'SET' && prepBlockingIssues.length > 0 && (
                        <button
                          type="button"
                          className="prep-open-issues-filter"
                          title="Εκκρεμότητες που απαιτούν ενέργεια"
                        >
                          <TriangleAlert size={12} />
                          {prepBlockingIssues.length} {prepBlockingIssues.length === 1 ? 'εκκρεμότητα' : 'εκκρεμότητες'}
                        </button>
                      )}
                    </div>
                    <div className="prep-bulk-select">
                      <button
                        type="button"
                        className="prep-all-ok"
                        onClick={toggleAllPrepChecks}
                        disabled={prepEligibleIds.length === 0}
                      >
                        {prepAllEligibleSelected ? (
                          <>
                            <X size={14} /> Αποεπιλογή όλων
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={14} /> Επιλογή όλων
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="prep-tools-toolbar-actions">
                    <span className="prep-tools-progress">
                      {prepCheckedIds.size}/{prepItemIds.length}
                    </span>
                  </div>
                </div>
                <div className="prep-tools-scroll">
                  {prepDraft.kind === 'SET' ? (
                    <>
                      {prepTools.map(t => {
                        const toolIssues = issues.filter(i => i.status === 'OPEN' && i.asset.startsWith(t.barcode));
                        const checked = prepCheckedIds.has(t.id);
                        return (
                          <div
                            className={`prep-tool-row ${checked ? 'checked' : ''} ${toolIssues.length ? 'has-issue' : ''}`}
                            key={t.id}
                          >
                            <label className="prep-tool-check" onClick={e => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={toolIssues.length > 0}
                                onChange={() => togglePrepItem(t.id)}
                              />
                              <span>{checked ? <Check size={14} /> : null}</span>
                            </label>
                            <div className="prep-tool-main">
                              <span className="mono">{t.barcode}</span>
                              <strong>{t.name}</strong>
                              <small>
                                {t.manufacturer} · {t.code}
                                {t.serialNumber ? ` · S/N ${t.serialNumber}` : ''}
                              </small>
                            </div>
                            <div className="prep-tool-state">
                              {toolIssues.length ? (
                                <span className="prep-open-issue-state">
                                  <span className="prep-issue-chip">
                                    <TriangleAlert size={12} />
                                    Ανοικτή αναφορά
                                  </span>
                                  <small>{toolIssues.map(i => i.type).join(' · ')}</small>
                                </span>
                              ) : (
                                <span className="prep-ok-chip">Έτοιμο για έλεγχο</span>
                              )}
                            </div>
                            <button
                              className={`tool-manage-btn prep-attention-action ${toolIssues.length ? 'warning' : 'subtle'}`}
                              type="button"
                              onClick={() => openPrepManage(t.id)}
                            >
                              {toolIssues.length ? (
                                <>
                                  <TriangleAlert size={14} /> Αντιμετώπιση
                                </>
                              ) : (
                                <>
                                  Λεπτομέρειες <ArrowRight size={14} />
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                      {prepMissingRequirements.flatMap(req =>
                        Array.from({length: req.missing}, (_, idx) => {
                          const accepted = acceptedMissingCodes.has(req.code);
                          return (
                            <div
                              className={`prep-tool-row prep-missing-row ${accepted ? 'accepted' : ''}`}
                              key={`missing-${req.code}-${idx}`}
                            >
                              <div className="prep-missing-placeholder">
                                <TriangleAlert size={15} />
                              </div>
                              <div className="prep-tool-main">
                                <span className="mono">—</span>
                                <strong>{req.name}</strong>
                                <small>{req.code} · αναμενόμενο εργαλείο που λείπει από τη φυσική σύνθεση</small>
                              </div>
                              <div className="prep-tool-state">
                                {accepted ? (
                                  <span className="prep-missing-accepted">Αποδεκτή απόκλιση</span>
                                ) : (
                                  <span className="prep-missing-chip">Λείπει</span>
                                )}
                              </div>
                              {accepted ? (
                                <button
                                  className="tool-manage-btn subtle"
                                  type="button"
                                  onClick={() => undoAcceptedMissing(req.code)}
                                >
                                  Αναίρεση
                                </button>
                              ) : (
                                <button
                                  className="tool-manage-btn warning prep-attention-action"
                                  type="button"
                                  onClick={() => openMissingManage(req.code)}
                                >
                                  <TriangleAlert size={14} /> Αντιμετώπιση
                                </button>
                              )}
                            </div>
                          );
                        }),
                      )}
                    </>
                  ) : (
                    <div className={`prep-tool-row single ${prepCheckedIds.has(prepDraft.asset.id) ? 'checked' : ''}`}>
                      <label className="prep-tool-check">
                        <input
                          type="checkbox"
                          checked={prepCheckedIds.has(prepDraft.asset.id)}
                          onChange={() => togglePrepItem(prepDraft.asset.id)}
                        />
                        <span>{prepCheckedIds.has(prepDraft.asset.id) ? <Check size={14} /> : null}</span>
                      </label>
                      <div className="prep-tool-main">
                        <span className="mono">{prepDraft.asset.barcode}</span>
                        <strong>{prepDraft.asset.name}</strong>
                        <small>
                          {prepDraft.asset.manufacturer} · {prepDraft.asset.code}
                        </small>
                      </div>
                      <div className="prep-tool-state">
                        <span className="prep-ok-chip">Έτοιμο για έλεγχο</span>
                      </div>
                      <button
                        className="tool-manage-btn subtle prep-attention-action"
                        type="button"
                        onClick={() => openPrepManage(prepDraft.asset.id)}
                      >
                        Λεπτομέρειες <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </div>
            {prepDraft.kind === 'SET' && prepMissingCount > 0 && prepMissingRequirements.length === 0 && (
              <label className="prep-accept-missing">
                <input type="checkbox" checked={allowMissing} onChange={e => setAllowMissing(e.target.checked)} />
                <span>
                  <strong>Αποδοχή καταγεγραμμένης έλλειψης</strong>
                  <small>
                    Το Set θα προχωρήσει με {prepMissingCount} λιγότερα εργαλεία. Η απόκλιση καταγράφεται στο ιστορικό.
                  </small>
                </span>
              </label>
            )}
            <div className="modal-actions">
              <button onClick={() => setPrepDraft(null)}>Ακύρωση</button>
              <button
                className="primary"
                disabled={!prepReadyForProcess}
                onClick={() => moveToProcess(prepDraft.kind, prepDraft.asset.id)}
              >
                <Flame size={16} /> Ολοκλήρωση · Προς κλιβανισμό
              </button>
            </div>
          </div>
        </div>
      )}

      {prepManageMissing && prepDraft?.kind === 'SET' && (
        <div className="nested-modal-backdrop" onMouseDown={closePrepManage}>
          <div className="tool-issue-card prep-manage-card" onMouseDown={e => e.stopPropagation()}>
            <button className="modal-x" aria-label="Κλείσιμο" title="Κλείσιμο" onClick={closePrepManage}>
              <X size={17} />
            </button>
            <span className="eyebrow">ΔΙΑΧΕΙΡΙΣΗ ΕΛΛΕΙΨΗΣ</span>
            <h3>{prepManageMissing.name}</h3>
            <div className="prep-manage-summary">
              <span>
                {prepManageMissing.code} · λείπουν {prepManageMissing.missing} από {prepManageMissing.quantity}
              </span>
            </div>
            <div className="prep-manage-grid">
              <button
                type="button"
                onClick={() => {
                  setPrepSelectedToolId(null);
                  setPrepReplacementRequirement({code: prepManageMissing.code, name: prepManageMissing.name});
                  setPrepManageMissingCode(null);
                  setPrepToolAction('REPLACE');
                  setPrepReplacementId('');
                  setPrepReplacementSource('STOCK');
                  setPrepReplacementSetId('');
                  setPrepOutgoingDestination('STOCK');
                  setPrepOutgoingSetId('');
                  setPrepTargetSetId('');
                }}
              >
                <ArrowRight size={16} />
                <span>
                  <b>Κάλυψη έλλειψης</b>
                  <small>Επιλογή εργαλείου από Stock, άλλο Set ή μεμονωμένο</small>
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPrepManageMissingCode(null);
                  openCompositionShortageReport();
                }}
              >
                <TriangleAlert size={16} />
                <span>
                  <b>Αναφορά</b>
                  <small>Καταγραφή της έλλειψης ως απόκλιση του Set</small>
                </span>
              </button>
              <button
                type="button"
                className="prep-no-action-option"
                onClick={() => acceptMissingWithoutAction(prepManageMissing.code)}
              >
                <CheckCircle2 size={16} />
                <span>
                  <b>Χωρίς ενέργεια</b>
                  <small>Καταγραφή της έλλειψης και συνέχιση της διαδικασίας</small>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {prepManageTool && prepDraft && (
        <div className="nested-modal-backdrop" onMouseDown={closePrepManage}>
          <div className="tool-issue-card prep-manage-card" onMouseDown={e => e.stopPropagation()}>
            <button className="modal-x" aria-label="Κλείσιμο" title="Κλείσιμο" onClick={closePrepManage}>
              <X size={17} />
            </button>
            <span className="eyebrow">ΔΙΑΧΕΙΡΙΣΗ ΕΡΓΑΛΕΙΟΥ</span>
            <h3>
              {prepManageTool.barcode} · {prepManageTool.name}
            </h3>
            <div className="prep-manage-summary">
              <span>
                {prepManageTool.manufacturer} · {prepManageTool.code}
                {prepManageTool.serialNumber ? ` · S/N ${prepManageTool.serialNumber}` : ''}
              </span>
            </div>
            {((prepManageTool.photos || []).length > 0 ||
              issues.some(i => i.asset.startsWith(prepManageTool.barcode) && i.photos?.length)) && (
              <div className="prep-manage-photos">
                <strong>Φωτογραφίες & τεκμηρίωση</strong>
                <div>
                  {[
                    ...(prepManageTool.photos || []),
                    ...issues.filter(i => i.asset.startsWith(prepManageTool.barcode)).flatMap(i => i.photos || []),
                  ].map(photo => (
                    <img key={photo.id} src={photo.dataUrl} alt={photo.name} />
                  ))}
                </div>
              </div>
            )}
            {issues.filter(i => i.status === 'OPEN' && i.asset.startsWith(prepManageTool.barcode)).length > 0 && (
              <div className="prep-manage-open-issues">
                <strong>Ανοικτές αναφορές</strong>
                {issues
                  .filter(i => i.status === 'OPEN' && i.asset.startsWith(prepManageTool.barcode))
                  .map(i => (
                    <div key={i.id}>
                      <TriangleAlert size={13} />
                      <span>
                        <b>{i.type}</b>
                        <small>{i.note}</small>
                      </span>
                    </div>
                  ))}
              </div>
            )}
            <div className="prep-manage-grid">
              <button
                type="button"
                onClick={() => {
                  const id = prepManageTool.id;
                  closePrepManage();
                  openIssueReport('TOOL', id, 'Αποστείρωση · σύνθεση & προετοιμασία');
                }}
              >
                <TriangleAlert size={16} />
                <span>
                  <b>Αναφορά</b>
                  <small>Βλάβη, φθορά ή άλλη απόκλιση</small>
                </span>
              </button>
              {prepDraft.kind === 'SET' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      closePrepManage();
                      openPrepToolAction('REPLACE');
                    }}
                  >
                    <ArrowRight size={16} />
                    <span>
                      <b>Αντικατάσταση</b>
                      <small>Αντικατάσταση με άλλο φυσικό εργαλείο</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      closePrepManage();
                      openPrepToolAction('SERVICE');
                    }}
                  >
                    <Wrench size={16} />
                    <span>
                      <b>Service</b>
                      <small>Απομάκρυνση για επισκευή / έλεγχο</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      closePrepManage();
                      openPrepToolAction('STOCK');
                    }}
                  >
                    <PackageOpen size={16} />
                    <span>
                      <b>Stock</b>
                      <small>Επιστροφή στο κεντρικό stock</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      closePrepManage();
                      openPrepToolAction('SET');
                    }}
                  >
                    <Layers3 size={16} />
                    <span>
                      <b>Άλλο Set</b>
                      <small>Μεταφορά σε διαφορετικό Set</small>
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {prepToolAction && prepDraft?.kind === 'SET' && (prepSelectedTool || prepReplacementRequirement) && (
        <div className="nested-modal-backdrop" onMouseDown={closePrepToolAction}>
          <div className="tool-issue-card prep-tool-action-card" onMouseDown={e => e.stopPropagation()}>
            <button className="modal-x" aria-label="Κλείσιμο" title="Κλείσιμο" onClick={closePrepToolAction}>
              <X size={17} />
            </button>
            <span className="eyebrow">ΔΙΑΧΕΙΡΙΣΗ ΣΥΝΘΕΣΗΣ</span>
            <h3>
              {prepSelectedTool
                ? `${prepSelectedTool.barcode} · ${prepSelectedTool.name}`
                : `Κάλυψη έλλειψης · ${prepReplacementRequirement?.name || ''}`}
            </h3>
            <p className="prep-action-intro">
              {prepToolAction === 'REPLACE'
                ? prepSelectedTool
                  ? 'Η αντικατάσταση ολοκληρώνεται ως μία ενιαία κίνηση: ορίζεις πού πηγαίνει το υπάρχον εργαλείο και ποιο φυσικό εργαλείο μπαίνει στη θέση του.'
                  : 'Επίλεξε το φυσικό εργαλείο που θα καλύψει την έλλειψη. Με την επιβεβαίωση θα προστεθεί στο Set.'
                : prepToolAction === 'SERVICE'
                  ? 'Το εργαλείο θα αφαιρεθεί από το Set και θα μεταφερθεί στα Χαλασμένα / Service.'
                  : prepToolAction === 'STOCK'
                    ? 'Το εργαλείο θα αφαιρεθεί από το Set και θα επιστρέψει στο κεντρικό Stock.'
                    : 'Το εργαλείο θα αφαιρεθεί από το τρέχον Set και θα προστεθεί σε άλλο Set.'}
            </p>
            {prepToolAction === 'REPLACE' && (
              <>
                {prepSelectedTool && (
                  <div className="prep-replace-flow">
                    <div className="prep-replace-step">
                      <span>1</span>
                      <div>
                        <strong>Εργαλείο που αφαιρείται</strong>
                        <small>
                          {prepSelectedTool.barcode} · {prepSelectedTool.name}
                        </small>
                      </div>
                    </div>
                    <div className="prep-replace-destination">
                      <strong>Πού θα μεταφερθεί το υπάρχον εργαλείο;</strong>
                      <div className="prep-source-buttons">
                        <button
                          type="button"
                          className={prepOutgoingDestination === 'SERVICE' ? 'active' : ''}
                          onClick={() => {
                            setPrepOutgoingDestination('SERVICE');
                            setPrepOutgoingSetId('');
                          }}
                        >
                          Service
                        </button>
                        <button
                          type="button"
                          className={prepOutgoingDestination === 'STOCK' ? 'active' : ''}
                          onClick={() => {
                            setPrepOutgoingDestination('STOCK');
                            setPrepOutgoingSetId('');
                          }}
                        >
                          Stock
                        </button>
                        <button
                          type="button"
                          className={prepOutgoingDestination === 'SET' ? 'active' : ''}
                          onClick={() => setPrepOutgoingDestination('SET')}
                        >
                          Άλλο Set
                        </button>
                      </div>
                      {prepOutgoingDestination === 'SET' && (
                        <label>
                          Set προορισμού
                          <select value={prepOutgoingSetId} onChange={e => setPrepOutgoingSetId(e.target.value)}>
                            <option value="">Επιλογή Set…</option>
                            {prepOtherSets.map(s => (
                              <option key={s.id} value={s.id}>
                                {s.barcode} · {s.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                    <div className="prep-replace-step">
                      <span>2</span>
                      <div>
                        <strong>Εργαλείο αντικατάστασης</strong>
                        <small>Επίλεξε πηγή και φυσικό εργαλείο.</small>
                      </div>
                    </div>
                  </div>
                )}
                <div className="prep-replace-source">
                  <strong>Από πού θα γίνει η αντικατάσταση;</strong>
                  <div className="prep-source-buttons">
                    <button
                      type="button"
                      className={prepReplacementSource === 'STOCK' ? 'active' : ''}
                      onClick={() => {
                        setPrepReplacementSource('STOCK');
                        setPrepReplacementSetId('');
                        setPrepReplacementId('');
                      }}
                    >
                      Stock
                    </button>
                    <button
                      type="button"
                      className={prepReplacementSource === 'SET' ? 'active' : ''}
                      onClick={() => {
                        setPrepReplacementSource('SET');
                        setPrepReplacementSetId('');
                        setPrepReplacementId('');
                      }}
                    >
                      Άλλο Set
                    </button>
                    <button
                      type="button"
                      className={prepReplacementSource === 'STANDALONE' ? 'active' : ''}
                      onClick={() => {
                        setPrepReplacementSource('STANDALONE');
                        setPrepReplacementSetId('');
                        setPrepReplacementId('');
                      }}
                    >
                      Μεμονωμένο σε χρήση
                    </button>
                  </div>
                </div>
                {prepReplacementSource === 'SET' && (
                  <label>
                    1. Επιλογή Set
                    <select
                      value={prepReplacementSetId}
                      onChange={e => {
                        setPrepReplacementSetId(e.target.value);
                        setPrepReplacementId('');
                      }}
                    >
                      <option value="">Επιλογή Set…</option>
                      {prepReplacementSourceSets.map(set => (
                        <option key={set.id} value={set.id}>
                          {set.barcode} · {set.name} ·{' '}
                          {tools.filter(t => t.mode === 'SET_MEMBER' && t.setId === set.id).length} εργαλεία
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  {prepReplacementSource === 'SET' ? '2. Επιλογή εργαλείου' : 'Εργαλείο αντικατάστασης'}
                  <select
                    value={prepReplacementId}
                    disabled={prepReplacementSource === 'SET' && !prepReplacementSetId}
                    onChange={e => setPrepReplacementId(e.target.value)}
                  >
                    <option value="">Επιλογή εργαλείου…</option>
                    {prepReplacementCandidates.map(t => {
                      const sourceSet = t.setId ? sets.find(s => s.id === t.setId) : undefined;
                      const source =
                        prepReplacementSource === 'STOCK'
                          ? 'Stock'
                          : prepReplacementSource === 'SET'
                            ? `Set ${sourceSet?.barcode || '—'} · ${sourceSet?.name || ''}`
                            : `${t.department || 'Τμήμα'} · μεμονωμένο`;
                      return (
                        <option key={t.id} value={t.id}>
                          {t.code === prepReplacementTargetCode ? '★ ' : ''}
                          {t.barcode} · {t.name} · {source}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <div className="prep-replacement-note">
                  <CheckCircle2 size={15} />
                  <span>
                    {prepSelectedTool
                      ? 'Με την επιβεβαίωση γίνονται ταυτόχρονα η έξοδος του υπάρχοντος εργαλείου και η είσοδος του νέου στο Set.'
                      : 'Με την επιβεβαίωση το επιλεγμένο φυσικό εργαλείο προστίθεται στο Set και καλύπτει την έλλειψη.'}
                  </span>
                </div>
                {(() => {
                  const replacement = tools.find(t => t.id === prepReplacementId);
                  const sourceSet = replacement?.setId ? sets.find(s => s.id === replacement.setId) : undefined;
                  return replacement?.mode === 'SET_MEMBER' && sourceSet ? (
                    <div className="prep-block-warning">
                      <TriangleAlert size={16} />
                      <span>Θα αφαιρεθεί από το Set {sourceSet.barcode}, το οποίο θα μείνει με έλλειψη.</span>
                    </div>
                  ) : null;
                })()}
              </>
            )}
            {prepToolAction === 'SET' && (
              <label>
                Set προορισμού
                <select value={prepTargetSetId} onChange={e => setPrepTargetSetId(e.target.value)}>
                  <option value="">Επιλογή Set…</option>
                  {prepOtherSets.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.barcode} · {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="modal-actions">
              <button onClick={closePrepToolAction}>Ακύρωση</button>
              <button
                className="primary"
                disabled={
                  (prepToolAction === 'REPLACE' &&
                    (!prepReplacementId ||
                      (!!prepSelectedTool && prepOutgoingDestination === 'SET' && !prepOutgoingSetId))) ||
                  (prepToolAction === 'SET' && !prepTargetSetId)
                }
                onClick={applyPrepToolAction}
              >
                {prepToolAction === 'REPLACE'
                  ? prepSelectedTool
                    ? 'Επιβεβαίωση αντικατάστασης'
                    : 'Επιβεβαίωση κάλυψης έλλειψης'
                  : prepToolAction === 'SERVICE'
                    ? 'Μεταφορά στα Χαλασμένα / Service'
                    : prepToolAction === 'STOCK'
                      ? 'Μεταφορά στο Stock'
                      : 'Μεταφορά σε άλλο Set'}
              </button>
            </div>
          </div>
        </div>
      )}

      {cycleDraft && (
        <div className="modal-backdrop" onMouseDown={closeCycleCompletion}>
          <div
            className="receipt-card-modal workflow-modal workflow-modal-cycle"
            onMouseDown={e => e.stopPropagation()}
          >
            <button className="modal-x" aria-label="Κλείσιμο" title="Κλείσιμο" onClick={closeCycleCompletion}>
              <X size={18} />
            </button>
            <div className="workflow-modal-head">
              <div className={`ster-kind ${cycleDraft.kind.toLowerCase()}`}>
                {cycleDraft.kind === 'SET' ? <Box size={20} /> : <Stethoscope size={20} />}
              </div>
              <div className="workflow-modal-title">
                <span className="eyebrow">ΑΠΟΣΤΕΙΡΩΣΗ · ΚΑΤΑΓΡΑΦΗ ΚΥΚΛΟΥ</span>
                <h2>
                  {cycleDraft.asset.barcode} · {cycleDraft.asset.name}
                </h2>
                <p>Καταχώρηση αποτελέσματος κύκλου. Η αποδέσμευση γίνεται σε ξεχωριστό quality gate.</p>
              </div>
              <StatusBadge value={cycleDraft.asset.state} />
            </div>
            <div className="workflow-modal-body">
              <div className="cycle-clean-summary">
                <div>
                  <span>Χειριστής</span>
                  <strong>{currentUser.name}</strong>
                </div>
                <div>
                  <span>Τμήμα</span>
                  <strong>{cycleDraft.asset.department || '—'}</strong>
                </div>
                <div>
                  <span>{cycleDraft.kind === 'SET' ? 'Εργαλεία' : 'Τύπος'}</span>
                  <strong>
                    {cycleDraft.kind === 'SET'
                      ? tools.filter(t => t.setId === cycleDraft.asset.id).length || cycleDraft.asset.actual || 0
                      : 'Μεμονωμένο'}
                  </strong>
                </div>
                <div>
                  <span>Ώρα καταχώρησης</span>
                  <strong>{new Date().toLocaleString('el-GR', {dateStyle: 'short', timeStyle: 'short'})}</strong>
                </div>
              </div>
              <div className="cycle-clean-fields">
                <label>
                  Κλίβανος
                  <select value={sterilizer} onChange={e => setSterilizer(e.target.value)}>
                    <option>Κλίβανος 1</option>
                    <option>Κλίβανος 2</option>
                    <option>Κλίβανος 3</option>
                  </select>
                </label>
                <label>
                  Αριθμός κύκλου / φορτίου
                  <input
                    autoFocus
                    value={cycleNumber}
                    onChange={e => setCycleNumber(e.target.value)}
                    placeholder="π.χ. 2026-0813-042"
                  />
                </label>
                <label>
                  Πρόγραμμα
                  <select value={cycleProgram} onChange={e => setCycleProgram(e.target.value)}>
                    <option>134°C · 5 min</option>
                    <option>134°C · 18 min</option>
                    <option>121°C · 20 min</option>
                    <option>Άλλο πρόγραμμα</option>
                  </select>
                </label>
                <label>
                  Χημικός δείκτης
                  <select
                    value={indicatorResult}
                    onChange={e => setIndicatorResult(e.target.value as 'PASS' | 'FAIL' | 'NOT_RECORDED')}
                  >
                    <option value="PASS">Επιτυχής / OK</option>
                    <option value="FAIL">Αποτυχία</option>
                    <option value="NOT_RECORDED">Δεν καταγράφηκε</option>
                  </select>
                </label>
              </div>
              {indicatorResult === 'FAIL' ? (
                <div className="cycle-result-warning">
                  <TriangleAlert size={18} />
                  <div>
                    <strong>Ο κύκλος δεν αποδεσμεύεται</strong>
                    <span>Η εγγραφή παραμένει στην καρτέλα «Κλιβανισμός» για νέο κύκλο.</span>
                  </div>
                </div>
              ) : (
                <div className="cycle-result-ok">
                  <CheckCircle2 size={18} />
                  <div>
                    <strong>Ο κύκλος μπορεί να καταχωρηθεί</strong>
                    <span>Μετά την καταχώρηση η εγγραφή μεταφέρεται στην «Αποδέσμευση» για τελικό έλεγχο.</span>
                  </div>
                </div>
              )}
              <label className="cycle-note">
                Παρατήρηση
                <textarea
                  value={cycleNote}
                  onChange={e => setCycleNote(e.target.value)}
                  placeholder="Προαιρετική παρατήρηση…"
                />
              </label>
            </div>
            <div className="modal-actions workflow-modal-actions">
              <button onClick={closeCycleCompletion}>Ακύρωση</button>
              <button
                className={indicatorResult === 'FAIL' ? 'danger-action primary' : 'primary'}
                disabled={!cycleNumber.trim()}
                onClick={finishCycle}
              >
                {indicatorResult === 'FAIL' ? <TriangleAlert size={16} /> : <PackageCheck size={16} />}{' '}
                {indicatorResult === 'FAIL' ? 'Καταχώρηση αποτυχίας' : 'Ολοκλήρωση κύκλου'}
              </button>
            </div>
          </div>
        </div>
      )}

      {releaseDraft && (
        <div className="modal-backdrop" onMouseDown={closeRelease}>
          <div
            className="receipt-card-modal workflow-modal workflow-modal-cycle"
            onMouseDown={e => e.stopPropagation()}
          >
            <button className="modal-x" aria-label="Κλείσιμο" title="Κλείσιμο" onClick={closeRelease}>
              <X size={18} />
            </button>
            <div className="workflow-modal-head">
              <div className={`ster-kind ${releaseDraft.kind.toLowerCase()}`}>
                {releaseDraft.kind === 'SET' ? <Box size={20} /> : <Stethoscope size={20} />}
              </div>
              <div className="workflow-modal-title">
                <span className="eyebrow">QUALITY GATE · ΑΠΟΔΕΣΜΕΥΣΗ</span>
                <h2>
                  {releaseDraft.asset.barcode} · {releaseDraft.asset.name}
                </h2>
                <p>Τεκμηριωμένος τελικός έλεγχος πριν χαρακτηριστεί έτοιμο για παράδοση.</p>
              </div>
              <StatusBadge value={releaseDraft.asset.state} />
            </div>
            <div className="workflow-modal-body">
              {(() => {
                const cycle = latestPassedCycle(releaseDraft.asset.id);
                return cycle ? (
                  <div className="cycle-clean-summary">
                    <div>
                      <span>Κλίβανος</span>
                      <strong>{cycle.sterilizer}</strong>
                    </div>
                    <div>
                      <span>Κύκλος / φορτίο</span>
                      <strong>{cycle.cycleNumber}</strong>
                    </div>
                    <div>
                      <span>Πρόγραμμα</span>
                      <strong>{cycle.program}</strong>
                    </div>
                    <div>
                      <span>Ολοκληρώθηκε από</span>
                      <strong>{cycle.completedByName}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="cycle-result-warning">
                    <TriangleAlert size={18} />
                    <div>
                      <strong>Δεν βρέθηκε επιτυχής κύκλος</strong>
                      <span>Η αποδέσμευση δεν μπορεί να ολοκληρωθεί.</span>
                    </div>
                  </div>
                );
              })()}
              <section className="release-check-card">
                <div className="receipt-section-title">
                  <div>
                    <strong>Έλεγχοι αποδέσμευσης</strong>
                    <span>Οι κρίσιμοι έλεγχοι πρέπει να επιβεβαιωθούν πριν την αποδέσμευση.</span>
                  </div>
                  <ShieldCheck size={18} />
                </div>
                <label className="release-check-row">
                  <input
                    type="checkbox"
                    checked={releaseChecks.physicalParametersOk}
                    onChange={e => setReleaseChecks(v => ({...v, physicalParametersOk: e.target.checked}))}
                  />
                  <span>
                    <strong>Παράμετροι κύκλου / φυσική καταγραφή</strong>
                    <small>Ελέγχθηκαν τα καταγεγραμμένα στοιχεία του κύκλου και είναι αποδεκτά.</small>
                  </span>
                </label>
                <label className="release-check-row">
                  <input
                    type="checkbox"
                    checked={releaseChecks.chemicalIndicatorOk}
                    onChange={e => setReleaseChecks(v => ({...v, chemicalIndicatorOk: e.target.checked}))}
                  />
                  <span>
                    <strong>Χημικός δείκτης αποδεκτός</strong>
                    <small>Το αποτέλεσμα συμφωνεί με τα κριτήρια της μονάδας.</small>
                  </span>
                </label>
                <label className="release-check-row">
                  <input
                    type="checkbox"
                    checked={releaseChecks.packagingIntegrityOk}
                    onChange={e => setReleaseChecks(v => ({...v, packagingIntegrityOk: e.target.checked}))}
                  />
                  <span>
                    <strong>Συσκευασία στεγνή και ακέραιη</strong>
                    <small>Δεν διαπιστώθηκε υγρασία, ρήξη ή άλλη απόκλιση του sterile barrier.</small>
                  </span>
                </label>
                <label className="release-biological">
                  Βιολογικός δείκτης
                  <select
                    value={biologicalIndicatorResult}
                    onChange={e =>
                      setBiologicalIndicatorResult(e.target.value as 'NOT_REQUIRED' | 'PASS' | 'PENDING' | 'FAIL')
                    }
                  >
                    <option value="NOT_REQUIRED">Δεν απαιτείται για τη συγκεκριμένη διαδικασία</option>
                    <option value="PASS">Αρνητικός / επιτυχής</option>
                    <option value="PENDING">Σε αναμονή αποτελέσματος</option>
                    <option value="FAIL">Θετικός / αποτυχία</option>
                  </select>
                </label>
              </section>
              {biologicalIndicatorResult === 'FAIL' ? (
                <div className="cycle-result-warning">
                  <TriangleAlert size={18} />
                  <div>
                    <strong>Δεν επιτρέπεται αποδέσμευση</strong>
                    <span>Καταχώρησε επανεπεξεργασία και ακολούθησε τη διαδικασία διερεύνησης της μονάδας.</span>
                  </div>
                </div>
              ) : releaseReady ? (
                <div className="cycle-result-ok">
                  <CheckCircle2 size={18} />
                  <div>
                    <strong>Έτοιμο για αποδέσμευση</strong>
                    <span>Οι απαιτούμενοι έλεγχοι έχουν επιβεβαιωθεί.</span>
                  </div>
                </div>
              ) : (
                <div className="release-pending">
                  <Clock3 size={18} />
                  <div>
                    <strong>Εκκρεμεί τελικός έλεγχος</strong>
                    <span>Η εγγραφή παραμένει σε αναμονή αποδέσμευσης.</span>
                  </div>
                </div>
              )}
              <label className="cycle-note">
                Παρατήρηση αποδέσμευσης
                <textarea
                  value={releaseNote}
                  onChange={e => setReleaseNote(e.target.value)}
                  placeholder="Προαιρετική παρατήρηση ή αιτιολογία επανεπεξεργασίας…"
                />
              </label>
            </div>
            <div className="modal-actions workflow-modal-actions release-actions">
              <button onClick={closeRelease}>Ακύρωση</button>
              <button className="release-reprocess" onClick={() => completeRelease('REPROCESS')}>
                <TriangleAlert size={16} /> Μη αποδέσμευση · Επανεπεξεργασία
              </button>
              <button
                className="primary"
                disabled={!releaseReady || !latestPassedCycle(releaseDraft.asset.id)}
                onClick={() => completeRelease('RELEASED')}
              >
                <ShieldCheck size={16} /> Αποδέσμευση προς παράδοση
              </button>
            </div>
          </div>
        </div>
      )}

      {receiptBatchOpen && (
        <div className="modal-backdrop" onMouseDown={closeReceiptBatch}>
          <div
            className="receipt-card-modal workflow-modal delivery-batch-modal"
            onMouseDown={e => e.stopPropagation()}
          >
            <button className="modal-x" aria-label="Κλείσιμο" title="Κλείσιμο" onClick={closeReceiptBatch}>
              <X size={18} />
            </button>
            <div className="workflow-modal-head">
              <div className="ster-kind set">
                <ScanBarcode size={20} />
              </div>
              <div className="workflow-modal-title">
                <span className="eyebrow">ΦΥΣΙΚΗ ΠΑΡΑΛΑΒΗ</span>
                <h2>Μαζική παραλαβή</h2>
                <p>Ταυτοποίησε τον παραδίδοντα μία φορά και σκάναρε διαδοχικά τα αντικείμενα του ίδιου τμήματος.</p>
              </div>
              <div className="delivery-batch-count">
                <strong>{receiptBatchAssets.length}</strong>
                <span>αντικείμενα</span>
              </div>
            </div>
            <div className="delivery-batch-body">
              <BarcodeCapture
                title="Προσθήκη στην παραλαβή"
                subtitle={
                  receiptBatchDepartment
                    ? `Παραλαβή από ${receiptBatchDepartment}`
                    : 'Το πρώτο barcode ορίζει το τμήμα της παραλαβής.'
                }
                feedback={receiptBatchScanFeedback}
                onBarcode={addBarcodeToReceiptBatch}
              />
              <div className="delivery-batch-grid">
                <section className="delivery-batch-assets">
                  <div className="load-assets-head">
                    <div>
                      <strong>Αντικείμενα παραλαβής</strong>
                      <span>
                        {receiptBatchAssets.length} επιλεγμένα
                        {receiptBatchDepartment ? ` · ${receiptBatchDepartment}` : ''}
                      </span>
                    </div>
                    <small>Η λεπτομερής λειτουργική επιθεώρηση γίνεται αργότερα στο «Έλεγχος & Σύνθεση».</small>
                  </div>
                  <div className="delivery-batch-list">
                    {incoming.map(item => {
                      const key = `${item.kind}:${item.id}`;
                      const selected = receiptBatchSelected.has(key);
                      const incompatible =
                        !!receiptBatchDepartment && !selected && item.department !== receiptBatchDepartment;
                      const deviation = receiptBatchDeviations.has(key);
                      return (
                        <label
                          key={key}
                          className={`${selected ? 'selected ' : ''}${incompatible ? 'incompatible ' : ''}${deviation ? 'has-issue' : ''}`.trim()}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={incompatible}
                            onChange={() => toggleReceiptBatchAsset(item)}
                          />
                          <AssetTypeIcon
                            kind={item.kind}
                            maxUses={item.kind === 'TOOL' ? item.maxUses : undefined}
                            size={16}
                          />
                          <div>
                            <span>
                              <b className="mono">{item.barcode}</b>
                              <strong>{item.name}</strong>
                            </span>
                            <small>
                              {item.department || 'Χωρίς τμήμα'} · {item.kind === 'SET' ? 'Σετ' : 'Μεμονωμένο εργαλείο'}
                            </small>
                          </div>
                          {selected && (
                            <button
                              type="button"
                              className={deviation ? 'set-report-btn active' : 'set-report-btn'}
                              onClick={e => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!deviation) openIssueReport(item.kind, item.id, 'Αποστείρωση · μαζική παραλαβή');
                              }}
                            >
                              {deviation ? (
                                <>
                                  <TriangleAlert size={13} /> Απόκλιση καταγράφηκε
                                </>
                              ) : (
                                <>
                                  <TriangleAlert size={13} /> Αναφορά απόκλισης
                                </>
                              )}
                            </button>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </section>
                <section className="delivery-batch-confirm">
                  <div className="delivery-pair">
                    <div className="delivery-person confirmed">
                      <UserCheck size={19} />
                      <div>
                        <span>Παραλαμβάνει</span>
                        <strong>{currentUser.name}</strong>
                        <small>{currentUser.department}</small>
                      </div>
                    </div>
                    <div className={`delivery-person ${receiptBatchIdentityValid ? 'confirmed' : ''}`}>
                      <IdCard size={19} />
                      <div>
                        <span>Παραδίδει</span>
                        <strong>
                          {receiptBatchIdentityValid ? receiptBatchDeliverer?.name : 'Αναμονή ταυτοποίησης'}
                        </strong>
                        <small>{receiptBatchDepartment || 'Σκάναρε πρώτα αντικείμενο'}</small>
                      </div>
                    </div>
                  </div>
                  <section className="delivery-auth">
                    <label>
                      Κωδικός παραδίδοντα
                      <div className="identity-input-row">
                        <input
                          disabled={!receiptBatchDepartment}
                          value={receiptBatchDelivererCode}
                          onChange={e => setReceiptBatchDelivererCode(e.target.value.toUpperCase())}
                          placeholder={receiptBatchDepartment ? 'Προσωπικός κωδικός' : 'Πρώτα σκάναρε αντικείμενο'}
                        />
                        {receiptBatchDemoIdentity && (
                          <button
                            type="button"
                            className="demo-fill-btn"
                            onClick={() => setReceiptBatchDelivererCode(receiptBatchDemoIdentity.code)}
                          >
                            Demo
                          </button>
                        )}
                      </div>
                    </label>
                    {receiptBatchDelivererCode &&
                      (!receiptBatchDeliverer ? (
                        <div className="identity-error">Ο κωδικός δεν αναγνωρίστηκε.</div>
                      ) : !receiptBatchDelivererMatches ? (
                        <div className="identity-mismatch-box">
                          <div className="identity-warning">
                            <TriangleAlert size={15} />
                            <span>
                              Ο χρήστης ανήκει στο {receiptBatchDeliverer.department}, ενώ η παραλαβή αφορά το{' '}
                              {receiptBatchDepartment}.
                            </span>
                          </div>
                          {receiptPolicy.allowCrossDepartmentHandover ? (
                            <label>
                              Αιτιολόγηση εξαίρεσης
                              <textarea
                                value={receiptBatchMismatchReason}
                                onChange={e => setReceiptBatchMismatchReason(e.target.value)}
                                placeholder="Υποχρεωτική αιτιολόγηση…"
                              />
                            </label>
                          ) : (
                            <div className="identity-error">
                              Η πολιτική της μονάδας δεν επιτρέπει αυτή την εξαίρεση.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="identity-result">
                          <CheckCircle2 size={17} />
                          <div>
                            <strong>{receiptBatchDeliverer.name}</strong>
                            <span>
                              {receiptBatchDeliverer.role} · {receiptBatchDeliverer.department}
                            </span>
                          </div>
                        </div>
                      ))}
                  </section>
                  <label className="cycle-note">
                    Παρατήρηση παραλαβής
                    <textarea
                      value={receiptBatchNote}
                      onChange={e => setReceiptBatchNote(e.target.value)}
                      placeholder="Προαιρετική κοινή παρατήρηση…"
                    />
                  </label>
                  <div className="delivery-trace-note">
                    <ShieldCheck size={17} />
                    <span>
                      Με την ολοκλήρωση καταγράφονται κοινό batch ID, παραδίδων, παραλαμβάνων, τμήμα, χρόνος και η
                      δήλωση εμφανής απόκλισης ανά barcode.
                    </span>
                  </div>
                </section>
              </div>
            </div>
            <div className="modal-actions workflow-modal-actions">
              <button onClick={closeReceiptBatch}>Ακύρωση</button>
              <button
                className="primary"
                disabled={!receiptBatchAssets.length || !receiptBatchIdentityValid}
                onClick={completeReceiptBatch}
              >
                <UserRoundCheck size={16} /> Ολοκλήρωση παραλαβής · {receiptBatchAssets.length}
              </button>
            </div>
          </div>
        </div>
      )}

      {deliveryBatchOpen && (
        <div className="modal-backdrop" onMouseDown={closeDeliveryBatch}>
          <div
            className="receipt-card-modal workflow-modal delivery-batch-modal"
            onMouseDown={e => e.stopPropagation()}
          >
            <button className="modal-x" aria-label="Κλείσιμο" title="Κλείσιμο" onClick={closeDeliveryBatch}>
              <X size={18} />
            </button>
            <div className="workflow-modal-head">
              <div className="ster-kind set">
                <ScanBarcode size={20} />
              </div>
              <div className="workflow-modal-title">
                <span className="eyebrow">ΠΑΡΑΔΟΣΗ ΣΤΟ ΤΜΗΜΑ</span>
                <h2>Νέα παράδοση</h2>
                <p>
                  Πρόσθεσε τα αντικείμενα με barcode, scanner υπολογιστή ή χειροκίνητα από τη λίστα. Κάθε παράδοση αφορά
                  ένα τμήμα.
                </p>
              </div>
              <div className="delivery-batch-count">
                <strong>{deliverySelectedAssets.length}</strong>
                <span>επιλεγμένα</span>
              </div>
            </div>
            <div className="delivery-batch-body">
              <BarcodeCapture
                title="Προσθήκη στην παράδοση"
                subtitle={
                  deliveryBatchDepartment
                    ? `Παράδοση προς ${deliveryBatchDepartment}`
                    : 'Το πρώτο barcode ορίζει το τμήμα της παράδοσης.'
                }
                feedback={deliveryScanFeedback}
                onBarcode={addBarcodeToDelivery}
              />
              <div className="delivery-batch-grid">
                <section className="delivery-batch-assets">
                  <div className="load-assets-head">
                    <div>
                      <strong>Αντικείμενα παράδοσης</strong>
                      <span>
                        {deliverySelectedAssets.length} επιλεγμένα
                        {deliveryBatchDepartment ? ` · ${deliveryBatchDepartment}` : ''}
                      </span>
                    </div>
                    <div className="delivery-list-actions">
                      {deliveryBatchDepartment && (
                        <button type="button" className="secondary compact" onClick={toggleAllDeliveryDepartment}>
                          {ready
                            .filter(item => item.department === deliveryBatchDepartment)
                            .every(item => deliverySelected.has(`${item.kind}:${item.id}`))
                            ? 'Αποεπιλογή τμήματος'
                            : 'Επιλογή όλων του τμήματος'}
                        </button>
                      )}
                      <small>
                        {deliveryBatchDepartment
                          ? 'Μπορείς να επιλέξεις πολλά αντικείμενα του ίδιου τμήματος.'
                          : 'Επίλεξε το πρώτο αντικείμενο για να οριστεί το τμήμα.'}
                      </small>
                    </div>
                  </div>
                  <div className="delivery-batch-list">
                    {ready.map(item => {
                      const key = `${item.kind}:${item.id}`;
                      const selected = deliverySelected.has(key);
                      const incompatible =
                        !!deliveryBatchDepartment && !selected && item.department !== deliveryBatchDepartment;
                      const lastLoad = processLoads.find(
                        load =>
                          load.kind === 'STERILIZATION' &&
                          load.status === 'RELEASED' &&
                          load.items.some(loadItem => loadItem.assetId === item.id && loadItem.assetKind === item.kind),
                      );
                      return (
                        <label
                          key={key}
                          className={`${selected ? 'selected ' : ''}${incompatible ? 'incompatible' : ''}`.trim()}
                          title={incompatible ? `Η τρέχουσα παράδοση αφορά το ${deliveryBatchDepartment}` : undefined}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={incompatible}
                            onChange={() => toggleDeliveryAsset(item)}
                          />
                          <AssetTypeIcon
                            kind={item.kind}
                            maxUses={item.kind === 'TOOL' ? item.maxUses : undefined}
                            size={16}
                          />
                          <div>
                            <span>
                              <b className="mono">{item.barcode}</b>
                              <strong>{item.name}</strong>
                            </span>
                            <small>
                              {item.department} ·{' '}
                              {lastLoad ? `Load ${lastLoad.id} / ${lastLoad.cycleNumber}` : 'Αποδεσμευμένο μεμονωμένα'}
                              {incompatible ? ` · Άλλο τμήμα` : ''}
                            </small>
                          </div>
                          {selected && <CheckCircle2 size={17} />}
                        </label>
                      );
                    })}
                  </div>
                </section>
                <section className="delivery-batch-confirm">
                  <div className="delivery-pair">
                    <div className="delivery-person confirmed">
                      <UserCheck size={19} />
                      <div>
                        <span>Παραδίδει</span>
                        <strong>{currentUser.name}</strong>
                        <small>{currentUser.department}</small>
                      </div>
                    </div>
                    <div className={`delivery-person ${deliveryBatchReceiverMatches ? 'confirmed' : ''}`}>
                      <IdCard size={19} />
                      <div>
                        <span>Παραλαμβάνει</span>
                        <strong>
                          {deliveryBatchReceiverMatches ? deliveryBatchReceiver?.name : 'Αναμονή ταυτοποίησης'}
                        </strong>
                        <small>{deliveryBatchDepartment || 'Σκάναρε πρώτα αντικείμενο'}</small>
                      </div>
                    </div>
                  </div>
                  <section className="delivery-auth">
                    <label>
                      Κωδικός παραλαμβάνοντα
                      <div className="identity-input-row">
                        <input
                          disabled={!deliveryBatchDepartment}
                          value={deliveryBatchReceiverCode}
                          onChange={e => setDeliveryBatchReceiverCode(e.target.value.toUpperCase())}
                          placeholder={deliveryBatchDepartment ? 'Προσωπικός κωδικός' : 'Πρώτα σκάναρε αντικείμενο'}
                        />
                        {deliveryBatchDemoIdentity && (
                          <button
                            type="button"
                            className="demo-fill-btn"
                            onClick={() => setDeliveryBatchReceiverCode(deliveryBatchDemoIdentity.code)}
                          >
                            Demo
                          </button>
                        )}
                      </div>
                    </label>
                    {deliveryBatchDemoIdentity && (
                      <small className="demo-code">
                        Demo: {deliveryBatchDemoIdentity.code} · {deliveryBatchDemoIdentity.department}
                      </small>
                    )}
                    {deliveryBatchReceiverCode &&
                      (!deliveryBatchReceiver ? (
                        <div className="identity-error">Ο κωδικός δεν αναγνωρίστηκε.</div>
                      ) : !deliveryBatchReceiverMatches ? (
                        <div className="identity-error">
                          Ο χρήστης ανήκει στο {deliveryBatchReceiver.department}, ενώ η παράδοση αφορά το{' '}
                          {deliveryBatchDepartment}.
                        </div>
                      ) : (
                        <div className="identity-result">
                          <CheckCircle2 size={17} />
                          <div>
                            <strong>{deliveryBatchReceiver.name}</strong>
                            <span>
                              {deliveryBatchReceiver.role} · {deliveryBatchReceiver.department}
                            </span>
                          </div>
                        </div>
                      ))}
                  </section>
                  <label className="cycle-note">
                    Παρατήρηση παράδοσης
                    <textarea
                      value={deliveryBatchNote}
                      onChange={e => setDeliveryBatchNote(e.target.value)}
                      placeholder="Προαιρετική παρατήρηση για ολόκληρη την παράδοση…"
                    />
                  </label>
                  <div className="delivery-trace-note">
                    <ShieldCheck size={17} />
                    <span>
                      Με την ολοκλήρωση καταγράφονται κοινό ID παράδοσης, χρήστης αποστείρωσης, παραλαμβάνων, τμήμα,
                      ημερομηνία/ώρα και σύνδεση κάθε barcode με το ιστορικό κύκλου του.
                    </span>
                  </div>
                </section>
              </div>
            </div>
            <div className="modal-actions workflow-modal-actions">
              <button onClick={closeDeliveryBatch}>Ακύρωση</button>
              <button
                className="primary"
                disabled={!deliverySelectedAssets.length || !deliveryBatchReceiverMatches}
                onClick={completeDeliveryBatch}
              >
                <UserRoundCheck size={16} /> Ολοκλήρωση παράδοσης · {deliverySelectedAssets.length}
              </button>
            </div>
          </div>
        </div>
      )}

      {deliveryDraft && (
        <div className="modal-backdrop" onMouseDown={closeDelivery}>
          <div
            className="receipt-card-modal workflow-modal workflow-modal-delivery"
            onMouseDown={e => e.stopPropagation()}
          >
            <button className="modal-x" aria-label="Κλείσιμο" title="Κλείσιμο" onClick={closeDelivery}>
              <X size={18} />
            </button>
            <div className="workflow-modal-head">
              <div className={`ster-kind ${deliveryDraft.kind.toLowerCase()}`}>
                {deliveryDraft.kind === 'SET' ? <Box size={20} /> : <Stethoscope size={20} />}
              </div>
              <div className="workflow-modal-title">
                <span className="eyebrow">ΠΑΡΑΔΟΣΗ ΣΤΟ ΤΜΗΜΑ</span>
                <h2>
                  {deliveryDraft.asset.barcode} · {deliveryDraft.asset.name}
                </h2>
                <p>Κεντρική Αποστείρωση → {deliveryDraft.asset.department}</p>
              </div>
              <StatusBadge value={deliveryDraft.asset.state} />
            </div>
            <div className="workflow-modal-body">
              <div className="delivery-pair">
                <div className="delivery-person confirmed">
                  <UserCheck size={19} />
                  <div>
                    <span>Παραδίδει</span>
                    <strong>{currentUser.name}</strong>
                    <small>{currentUser.department}</small>
                  </div>
                </div>
                <div className={`delivery-person ${receiver && receiverMatches ? 'confirmed' : ''}`}>
                  <IdCard size={19} />
                  <div>
                    <span>Παραλαμβάνει</span>
                    <strong>{receiver && receiverMatches ? receiver.name : 'Αναμονή ταυτοποίησης'}</strong>
                    <small>{receiver && receiverMatches ? receiver.department : deliveryDraft.asset.department}</small>
                  </div>
                </div>
              </div>
              <section className="delivery-auth">
                <label>
                  Κωδικός παραλαμβάνοντα
                  <div className="identity-input-row">
                    <input
                      autoFocus
                      value={receiverCode}
                      onChange={e => setReceiverCode(e.target.value.toUpperCase())}
                      placeholder="Προσωπικός κωδικός"
                    />
                    {deliveryDemoIdentity && (
                      <button
                        type="button"
                        className="demo-fill-btn"
                        onClick={() => setReceiverCode(deliveryDemoIdentity.code)}
                      >
                        Demo
                      </button>
                    )}
                  </div>
                </label>
                {deliveryDemoIdentity && (
                  <small className="demo-code">
                    Demo: {deliveryDemoIdentity.code} · {deliveryDemoIdentity.department}
                  </small>
                )}
                {receiverCode &&
                  (!receiver ? (
                    <div className="identity-error">Ο κωδικός δεν αναγνωρίστηκε.</div>
                  ) : !receiverMatches ? (
                    <div className="identity-error">
                      Ο χρήστης ανήκει στο {receiver.department}, ενώ η παράδοση αφορά το{' '}
                      {deliveryDraft.asset.department}.
                    </div>
                  ) : (
                    <div className="identity-result">
                      <CheckCircle2 size={17} />
                      <div>
                        <strong>{receiver.name}</strong>
                        <span>
                          {receiver.role} · {receiver.department}
                        </span>
                      </div>
                    </div>
                  ))}
              </section>
              <label className="cycle-note">
                Παρατήρηση παράδοσης
                <textarea
                  value={deliveryNote}
                  onChange={e => setDeliveryNote(e.target.value)}
                  placeholder="Προαιρετική παρατήρηση…"
                />
              </label>
            </div>
            <div className="modal-actions workflow-modal-actions">
              <button onClick={closeDelivery}>Ακύρωση</button>
              <button className="primary" disabled={!receiver || !receiverMatches} onClick={completeDelivery}>
                <UserRoundCheck size={16} /> Ολοκλήρωση παράδοσης / παραλαβής
              </button>
            </div>
          </div>
        </div>
      )}

      {receiptView && !receiptDraft && !prepDraft && (
        <div className="modal-backdrop" onMouseDown={() => setReceiptView(null)}>
          <div className="receipt-card-modal completed" onMouseDown={e => e.stopPropagation()}>
            <button className="modal-x" aria-label="Κλείσιμο" title="Κλείσιμο" onClick={() => setReceiptView(null)}>
              <X size={18} />
            </button>
            <div className="receipt-complete-banner">
              <CheckCircle2 size={20} />
              <div>
                <strong>Η παραλαβή ολοκληρώθηκε</strong>
                <span>Η καρτέλα καταγράφηκε στο ιστορικό.</span>
              </div>
            </div>
            <div className="receipt-card-head">
              <div className={`ster-kind ${receiptView.assetKind.toLowerCase()}`}>
                {receiptView.assetKind === 'SET' ? <Box size={19} /> : <Stethoscope size={19} />}
              </div>
              <div>
                <span>ΚΑΡΤΕΛΑ ΠΑΡΑΛΑΒΗΣ · {receiptView.id.toUpperCase()}</span>
                <h2>
                  {receiptView.barcode} · {receiptView.assetName}
                </h2>
                <p>
                  {receiptView.fromDepartment} → {receiptView.toDepartment}
                </p>
              </div>
            </div>
            <div className="receipt-facts">
              <div>
                <span>Ημερομηνία / ώρα</span>
                <strong>{receiptView.at}</strong>
              </div>
              <div>
                <span>Παρέδωσε</span>
                <strong>{receiptView.deliveredByName}</strong>
                <small>{receiptView.deliveredByDepartment}</small>
              </div>
              <div>
                <span>Παρέλαβε</span>
                <strong>{receiptView.receivedByName}</strong>
                <small>{receiptView.receivedByDepartment}</small>
              </div>
              {receiptView.assetKind === 'SET' && (
                <div>
                  <span>Σύνθεση κατά την παραλαβή</span>
                  <strong>
                    {receiptView.actual} / {receiptView.expected}
                  </strong>
                </div>
              )}
            </div>
            {receiptView.checkPerformed && (
              <div className="receipt-check-read">
                <div>
                  <ClipboardCheck size={17} />
                  <strong>Καταμέτρηση κατά την παραλαβή</strong>
                </div>
                <span>
                  {receiptView.assetKind === 'SET'
                    ? `Παραλήφθηκαν ${receiptView.checkedCount} από ${receiptView.expected}. `
                    : ''}
                  {receiptView.checkResult === 'MISSING' ? 'Καταγράφηκε διαφορά ποσότητας.' : 'Η ποσότητα συμφωνεί.'}
                </span>
              </div>
            )}
            {
              <div className="receipt-check-read">
                <div>
                  {receiptView.visibleDeviation ? <TriangleAlert size={17} /> : <CheckCircle2 size={17} />}
                  <strong>Εμφανής κατάσταση κατά την παραλαβή</strong>
                </div>
                <span>
                  {receiptView.visibleDeviation
                    ? 'Δηλώθηκε εμφανής απόκλιση κατά τη φυσική παραλαβή.'
                    : 'Δεν δηλώθηκε εμφανής απόκλιση κατά τη φυσική παραλαβή.'}
                </span>
                {receiptView.departmentMismatch && (
                  <p>
                    Παράδοση από διαφορετικό τμήμα: {receiptView.departmentMismatchReason || 'Καταγεγραμμένη εξαίρεση'}
                  </p>
                )}
              </div>
            }
            {receiptView.note && (
              <div className="receipt-note-read">
                <span>Παρατήρηση</span>
                <p>{receiptView.note}</p>
              </div>
            )}
            <div className="modal-actions">
              <button className="primary" onClick={() => setReceiptView(null)}>
                Κλείσιμο
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
