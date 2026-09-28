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
import {tr, trc, trData} from '../../i18n';

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
    recallCases,
    issues,
    receipts,
    sterilizationCycles,
    currentUser,
    reportIssue,
    reportSetIssue,
    resolveIssues,
    moveTool,
    replaceToolInSet,
    can,
  } = useSurgi();
  // Set changes (cover a shortage, replace, service, stock, another Set) are the supervisor's.
  const canCompose = can('asset.composition.manage');
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
    setQuickScanFeedback(ok ? tr('Το barcode αναγνωρίστηκε.') : tr('Το barcode δεν βρέθηκε στην ενεργή ροή.'));
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
      window.alert(tr('Κατέγραψε πρώτα την εμφανή απόκλιση με αναφορά στο Σετ ή στο συγκεκριμένο εργαλείο.'));
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
          ? tr('{0} αναγνωρίστηκε, αλλά δεν βρίσκεται στο σωστό στάδιο για αυτό το φορτίο.', barcode)
          : tr('{0} δεν βρέθηκε στο μητρώο.', barcode),
      });
      return false;
    }
    const key = `${eligible.kind}:${eligible.id}`;
    if (loadSelected.has(key)) {
      setLoadScanFeedback({type: 'WARN', message: tr('{0} είναι ήδη στο φορτίο.', barcode)});
      return false;
    }
    setLoadSelected(current => new Set([...current, key]));
    setLoadScanFeedback({type: 'OK', message: tr('{0} · {1} προστέθηκε στο φορτίο.', barcode, eligible.name)});
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
      tr('Αιτιολογία ανάκλησης φορτίου:'),
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
    setDeliveryBatchReceiverCode('');
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
      setDeliveryBatchReceiverCode('');
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
      ? tr('Αναμονή φυσικής παραλαβής')
      : queue === 'WASHING'
        ? tr('Καθαρισμός & Απολύμανση')
        : queue === 'PREP'
          ? tr('Έλεγχος & Σύνθεση')
          : queue === 'PACKAGING'
            ? tr('Συσκευασία & Σήμανση')
            : queue === 'PROCESS'
              ? tr('Αποστείρωση')
              : queue === 'RELEASE'
                ? tr('Έλεγχος & Αποδέσμευση')
                : queue === 'STORAGE'
                  ? tr('Αποθήκευση')
                  : tr('Έτοιμα για παραλαβή');
  const queueStageLabel =
    queue === 'INCOMING'
      ? tr('Αναμένει φυσική παράδοση')
      : queue === 'WASHING'
        ? tr('Προς καθαρισμό / απολύμανση')
        : queue === 'PREP'
          ? tr('Προς έλεγχο / σύνθεση')
          : queue === 'PACKAGING'
            ? tr('Προς συσκευασία / σήμανση')
            : queue === 'PROCESS'
              ? tr('Σε αποστείρωση')
              : queue === 'RELEASE'
                ? tr('Αναμένει αποδέσμευση')
                : queue === 'STORAGE'
                  ? tr('Σε αποθήκευση')
                  : tr('Έτοιμο για το τμήμα');
  return (
    <div className="sterilization-workspace">
      <div className="ster-work-head">
        <div>
          <span className="eyebrow">{tr('ΚΕΝΤΡΙΚΗ ΑΠΟΣΤΕΙΡΩΣΗ')}</span>
          <h1>{tr('Χώρος εργασίας Αποστείρωσης')}</h1>
          <p>
            {tr('Η ενεργή ροή του νοσοκομείου εφαρμόζεται αυτόματα από το SurgiTrack Studio με πλήρη ιχνηλασιμότητα.')}
          </p>
        </div>
        <div className="ster-shift">
          <ShieldCheck size={18} />
          <div>
            <small>{tr('Συνδεδεμένος χρήστης')}</small>
            <strong>{trData(currentUser.name)}</strong>
            <span>{trData(currentUser.department)}</span>
          </div>
        </div>
      </div>

      <div className="ster-scan ster-scan-restored">
        <div className="ster-scan-icon">
          <ScanBarcode size={23} />
        </div>
        <div className="ster-scan-copy">
          <strong>{tr('Γρήγορη σάρωση barcode')}</strong>
          <span>{tr('Scanner υπολογιστή ή χειροκίνητη πληκτρολόγηση · Enter για άμεσο άνοιγμα')}</span>
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
            placeholder={tr('S000324 ή T001312')}
            aria-label={tr('Γρήγορη σάρωση barcode')}
          />
          <button type="button" onClick={quickScan}>
            {tr('Άνοιγμα')}
          </button>
        </div>
        {quickScanFeedback && <div className="ster-scan-feedback-inline">{quickScanFeedback}</div>}
      </div>

      <AssetFilterBar
        compact
        query={query}
        onQueryChange={setQuery}
        placeholder={tr('Αναζήτηση με ονομασία, κωδικό, barcode ή τμήμα...')}
        onSubmitQuery={() => scan()}
        filters={[
          {
            key: 'department',
            value: departmentFilter,
            placeholder: tr('Όλα τα τμήματα'),
            options: queueValues('department').map(value => ({value, label: value})),
            onChange: setDepartmentFilter,
          },
          {
            key: 'specialty',
            value: specialtyFilter,
            placeholder: tr('Όλες οι ειδικότητες'),
            options: queueValues('specialty').map(value => ({value, label: value})),
            onChange: setSpecialtyFilter,
          },
          {
            key: 'kind',
            value: kindFilter,
            placeholder: tr('Σετ & εργαλεία'),
            options: [
              {value: 'SET', label: tr('Μόνο Σετ')},
              {value: 'TOOL', label: tr('Μόνο εργαλεία')},
            ],
            onChange: setKindFilter,
          },
        ]}
      />

      <div className="sterile-queues modern workflow-configured-queues">
        <button className={queue === 'INCOMING' ? 'active' : ''} onClick={() => setQueue('INCOMING')}>
          <Send />
          <span>{tr('Παραλαβή')}</span>
          <strong>{incoming.length}</strong>
          <small>Chain of custody</small>
        </button>
        {(stageEnabled('WASHING') || washing.length > 0) && (
          <button className={queue === 'WASHING' ? 'active' : ''} onClick={() => setQueue('WASHING')}>
            <PackageOpen />
            <span>{trc('stage', 'Καθαρισμός')}</span>
            <strong>{washing.length}</strong>
            <small>{tr('Πλύση / απολύμανση')}</small>
          </button>
        )}
        {(stageEnabled('PREPARATION') || preparation.length > 0) && (
          <button className={queue === 'PREP' ? 'active' : ''} onClick={() => setQueue('PREP')}>
            <Layers3 />
            <span>{tr('Έλεγχος & Σύνθεση')}</span>
            <strong>{preparation.length}</strong>
            <small>{tr('Εργαλεία / αποκλίσεις')}</small>
          </button>
        )}
        {(stageEnabled('PACKAGING') || packaging.length > 0) && (
          <button className={queue === 'PACKAGING' ? 'active' : ''} onClick={() => setQueue('PACKAGING')}>
            <Box />
            <span>{tr('Συσκευασία')}</span>
            <strong>{packaging.length}</strong>
            <small>{tr('Barrier / σήμανση')}</small>
          </button>
        )}
        <button className={queue === 'PROCESS' ? 'active' : ''} onClick={() => setQueue('PROCESS')}>
          <Flame />
          <span>{tr('Αποστείρωση')}</span>
          <strong>{processing.length}</strong>
          <small>{tr('Κύκλος / φορτίο')}</small>
        </button>
        {(stageEnabled('RELEASE') || awaitingRelease.length > 0) && (
          <button className={queue === 'RELEASE' ? 'active' : ''} onClick={() => setQueue('RELEASE')}>
            <ShieldCheck />
            <span>{tr('Αποδέσμευση')}</span>
            <strong>{awaitingRelease.length}</strong>
            <small>Quality gate</small>
          </button>
        )}
        {(stageEnabled('STORAGE') || storage.length > 0) && (
          <button className={queue === 'STORAGE' ? 'active' : ''} onClick={() => setQueue('STORAGE')}>
            <PackageCheck />
            <span>{tr('Αποθήκευση')}</span>
            <strong>{storage.length}</strong>
            <small>{tr('Πριν την παράδοση')}</small>
          </button>
        )}
        <button className={queue === 'READY' ? 'active' : ''} onClick={() => setQueue('READY')}>
          <UserRoundCheck />
          <span>{tr('Παράδοση')}</span>
          <strong>{ready.length}</strong>
          <small>{tr('Προς τμήμα')}</small>
        </button>
      </div>

      <div className={`ster-work-panel ${queue === 'INCOMING' ? 'receipt-queue-panel' : ''}`}>
        <div className="ster-panel-head">
          <div>
            <strong>{queueTitle}</strong>
            <span>
              {rows.length} {rows.length === 1 ? tr('εγγραφή') : tr('εγγραφές')}
            </span>
          </div>
          <div className="ster-panel-head-actions">
            {queue === 'INCOMING' && (
              <>
                <span className="ster-hint">
                  {tr('Γρήγορη φυσική παραλαβή · δήλωση εμφανής απόκλισης · προαιρετική καταμέτρηση βάσει πολιτικής.')}
                </span>
                {incoming.length > 0 && (
                  <button className="primary compact" onClick={openReceiptBatch}>
                    <ScanBarcode size={15} /> {tr('Μαζική παραλαβή')}
                  </button>
                )}
              </>
            )}
            {queue === 'WASHING' && (
              <>
                <span className="ster-hint">{tr('Τεκμηριωμένο quality gate καθαρισμού / απολύμανσης.')}</span>
                {washing.length > 0 && (
                  <button className="primary compact" onClick={() => openLoad('WASHING')}>
                    <Layers3 size={15} /> {tr('Νέο φορτίο πλυντηρίου')}
                  </button>
                )}
              </>
            )}
            {queue === 'PREP' && (
              <span className="ster-hint">{tr('Έλεγχος λειτουργικότητας, σύνθεση και διαχείριση αποκλίσεων.')}</span>
            )}
            {queue === 'PACKAGING' && (
              <span className="ster-hint">{tr('Έλεγχος sterile barrier, σήμανσης και δείκτη πριν τον κύκλο.')}</span>
            )}
            {queue === 'PROCESS' && processing.length > 0 && (
              <button className="primary compact" onClick={() => openLoad('STERILIZATION')}>
                <Flame size={15} /> {tr('Δημιουργία φορτίου')}
              </button>
            )}
            {queue === 'STORAGE' && (
              <span className="ster-hint">{tr('Προαιρετικός έλεγχος ασφαλούς αποθήκευσης πριν την παράδοση.')}</span>
            )}
            {queue === 'READY' && ready.length > 0 && (
              <button className="primary compact" onClick={openDeliveryBatch}>
                <ScanBarcode size={15} /> {tr('Νέα παράδοση')}
              </button>
            )}
            {queue === 'RELEASE' && (
              <span className="ster-hint">
                {tr('Αποδέσμευση ανά φορτίο με ενιαία τεκμηρίωση CI/BI και φυσικών παραμέτρων.')}
              </span>
            )}
          </div>
        </div>
        {queue === 'RELEASE' && awaitingLoads.length > 0 && (
          <div className="load-release-strip">
            {awaitingLoads.map(load => (
              <div className="load-release-card" key={load.id}>
                <div>
                  <span>
                    {tr('ΦΟΡΤΙΟ ·') + ' '}
                    {load.id}
                  </span>
                  <strong>
                    {load.equipment} · {load.cycleNumber}
                  </strong>
                  <small>
                    {load.program} · {load.items.length} {tr('αντικείμενα')}
                  </small>
                </div>
                <button className="primary compact" onClick={() => openLoadRelease(load.id)}>
                  <ShieldCheck size={15} /> {tr('Αποδέσμευση φορτίου')}
                </button>
              </div>
            ))}
          </div>
        )}
        {queue === 'RELEASE' && recallCases.some(item => item.status === 'OPEN') && (
          <details className="released-loads" open>
            <summary>
              {tr('Ενεργές ανακλήσεις ·') + ' '}
              {recallCases.filter(item => item.status === 'OPEN').length}
            </summary>
            <div>
              {recallCases
                .filter(item => item.status === 'OPEN')
                .map(recall => (
                  <div key={recall.id}>
                    <span>
                      <b>{recall.id}</b> {tr('· φορτίο') + ' '}
                      {recall.loadId} · {recall.items.filter(item => item.status !== 'CLOSED').length} {tr('εκκρεμή')}
                      <small style={{display: 'block'}}>{recall.reason}</small>
                    </span>
                    <span>
                      {recall.items.filter(item => item.status === 'OUTSTANDING').length} {tr('προς επιστροφή')}
                    </span>
                  </div>
                ))}
            </div>
          </details>
        )}
        {queue === 'RELEASE' && releasedLoads.length > 0 && (
          <details className="released-loads">
            <summary>{tr('Πρόσφατα αποδεσμευμένα φορτία · δυνατότητα ανάκλησης')}</summary>
            <div>
              {releasedLoads.map(load => (
                <div key={load.id}>
                  <span>
                    <b>{load.id}</b> · {load.equipment} · {load.cycleNumber} · {load.items.length} {tr('αντικείμενα')}
                  </span>
                  <button onClick={() => recallLoad(load.id)}>
                    <TriangleAlert size={14} /> {tr('Ανάκληση')}
                  </button>
                </div>
              ))}
            </div>
          </details>
        )}
        {rows.length === 0 ? (
          <div className="empty ster-empty">
            <PackageCheck size={32} />
            <strong>{tr('Δεν υπάρχουν εγγραφές σε αυτό το στάδιο')}</strong>
            <span>{tr('Η ουρά θα ενημερωθεί όταν πραγματοποιηθεί νέα κίνηση.')}</span>
          </div>
        ) : (
          <>
            <div className="ster-list-head">
              <span>{tr('Αντικείμενο')}</span>
              <span>{tr('Τμήμα')}</span>
              <span>{tr('Ειδικότητα')}</span>
              <span>{queue === 'INCOMING' ? tr('Σύνθεση / κατάσταση') : tr('Κατάσταση')}</span>
              <span>{tr('Στάδιο')}</span>
              <span>{tr('Ενέργειες')}</span>
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
                          <span className="ster-type">{x.kind === 'SET' ? tr('ΣΕΤ') : tr('ΕΡΓΑΛΕΙΟ')}</span>
                        </div>
                        <Link to={detail} className="ster-asset-name">
                          {x.name}
                        </Link>
                      </div>
                    </div>
                    <div className="ster-cell-text ster-cell-department">
                      <strong>{trData(x.department) || tr('Χωρίς τμήμα')}</strong>
                      <span className="ster-tablet-specialty">{trData(x.specialty) || '—'}</span>
                    </div>
                    <div className="ster-cell-text ster-cell-specialty">
                      <span>{trData(x.specialty) || '—'}</span>
                    </div>
                    <div className="ster-meta">
                      {queue === 'INCOMING' ? (
                        x.kind === 'SET' ? (
                          <>
                            <small>{tr('Σύνθεση')}</small>
                            <strong className={x.actual !== x.expected ? 'warn-text' : ''}>
                              {x.actual} / {x.expected}
                            </strong>
                          </>
                        ) : (
                          <span className="ster-object-state">{tr('Μεμονωμένο εργαλείο')}</span>
                        )
                      ) : (
                        <StatusBadge value={x.state} />
                      )}{' '}
                      {assetIssues.length > 0 && (
                        <span className="issue-inline">
                          <TriangleAlert size={14} />
                          {assetIssues.length} {tr('ανοικτή')}
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
                          <CheckCircle2 size={15} /> {tr('Παραλαβή')}
                        </button>
                      ) : queue === 'WASHING' ? (
                        <button className="primary compact" onClick={() => openCheckpoint(x.kind, x, 'WASHING')}>
                          <PackageOpen size={15} /> {tr('Έλεγχος σταδίου')}
                        </button>
                      ) : queue === 'PREP' ? (
                        <button
                          className="primary compact ster-primary-action"
                          onClick={() => openPreparation(x.kind, x)}
                        >
                          <Layers3 size={15} /> {tr('Έλεγχος & Σύνθεση') + ' '}
                          <ArrowRight size={14} />
                        </button>
                      ) : queue === 'PACKAGING' ? (
                        <button className="primary compact" onClick={() => openCheckpoint(x.kind, x, 'PACKAGING')}>
                          <Box size={15} /> {tr('Έλεγχος συσκευασίας')}
                        </button>
                      ) : queue === 'PROCESS' ? (
                        <button className="primary compact" onClick={() => openCycleCompletion(x.kind, x)}>
                          <PackageCheck size={15} /> {tr('Καταχώρηση κύκλου')}
                        </button>
                      ) : queue === 'RELEASE' ? (
                        <button className="primary compact" onClick={() => openRelease(x.kind, x)}>
                          <ShieldCheck size={15} /> {tr('Έλεγχος αποδέσμευσης')}
                        </button>
                      ) : queue === 'STORAGE' ? (
                        <button className="primary compact" onClick={() => openCheckpoint(x.kind, x, 'STORAGE')}>
                          <PackageCheck size={15} /> {tr('Έλεγχος αποθήκευσης')}
                        </button>
                      ) : (
                        <button className="primary compact" onClick={() => openDelivery(x.kind, x)}>
                          <UserRoundCheck size={15} /> {tr('Παράδοση στο τμήμα')}
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
            <button className="modal-x" aria-label={tr('Κλείσιμο')} title={tr('Κλείσιμο')} onClick={closeLoad}>
              <X size={18} />
            </button>
            <div className="workflow-modal-head">
              <div className="ster-kind set">
                {loadModal === 'WASHING' ? <PackageOpen size={20} /> : <Flame size={20} />}
              </div>
              <div className="workflow-modal-title">
                <span className="eyebrow">
                  {loadModal === 'WASHING' ? tr('ΦΟΡΤΙΟ ΠΛΥΝΤΗΡΙΟΥ') : tr('ΦΟΡΤΙΟ ΑΠΟΣΤΕΙΡΩΣΗΣ')}
                </span>
                <h2>{tr('Δημιουργία ενιαίου φορτίου')}</h2>
                <p>
                  {tr(
                    'Επίλεξε τα Set/εργαλεία που μπαίνουν στον ίδιο κύκλο. Η εγγραφή του κύκλου θα συνδεθεί με όλα τα επιλεγμένα barcodes.',
                  )}
                </p>
              </div>
            </div>
            <div className="load-modal-body">
              <div className="cycle-clean-fields">
                <label>
                  {loadModal === 'WASHING' ? tr('Πλυντήριο / απολυμαντής') : tr('Κλίβανος')}
                  <input value={loadEquipment} onChange={e => setLoadEquipment(e.target.value)} />
                </label>
                <label>
                  {tr('Αριθμός κύκλου / φορτίου')}
                  <input
                    value={loadCycleNumber}
                    onChange={e => setLoadCycleNumber(e.target.value)}
                    placeholder={tr('π.χ. 2026-0815-07')}
                  />
                </label>
                <label>
                  {tr('Πρόγραμμα')}
                  <input value={loadProgram} onChange={e => setLoadProgram(e.target.value)} />
                </label>
                {loadModal === 'STERILIZATION' && (
                  <label>
                    {tr('Χημικός δείκτης κύκλου')}
                    <select
                      value={loadChemical}
                      onChange={e => setLoadChemical(e.target.value as 'PASS' | 'FAIL' | 'NOT_RECORDED')}
                    >
                      <option value="PASS">{tr('Αποδεκτός')}</option>
                      <option value="FAIL">{tr('Αποτυχία')}</option>
                      <option value="NOT_RECORDED">{tr('Δεν καταγράφηκε')}</option>
                    </select>
                  </label>
                )}
              </div>
              {loadModal === 'STERILIZATION' && (
                <BarcodeCapture
                  title={tr('Προσθήκη στο φορτίο')}
                  subtitle={tr('Σκάναρε, πληκτρολόγησε ή χρησιμοποίησε scanner υπολογιστή.')}
                  placeholder={tr('Barcode · π.χ. S000324')}
                  feedback={loadScanFeedback}
                  onBarcode={addBarcodeToLoad}
                />
              )}
              <section className="load-assets">
                <div className="load-assets-head">
                  <div>
                    <strong>{tr('Περιεχόμενο φορτίου')}</strong>
                    <span>
                      {loadSelected.size} {tr('από') + ' '}
                      {loadCandidates.length} {tr('επιλεγμένα')}
                    </span>
                  </div>
                  {loadModal === 'STERILIZATION' ? (
                    <span className="load-assets-mode">
                      <ScanBarcode size={14} /> {tr('Barcode / χειροκίνητη επιλογή')}
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
                      {loadSelected.size === loadCandidates.length ? tr('Αποεπιλογή όλων') : tr('Επιλογή όλων')}
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
                          <small>{trData(item.department) || tr('Χωρίς τμήμα')}</small>
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
                {tr('Παρατήρηση φορτίου')}
                <textarea
                  value={loadNote}
                  onChange={e => setLoadNote(e.target.value)}
                  placeholder={tr('Προαιρετική παρατήρηση / απόκλιση…')}
                />
              </label>
            </div>
            <div className="modal-actions workflow-modal-actions">
              <button onClick={closeLoad}>{tr('Ακύρωση')}</button>
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
                {tr('Ολοκλήρωση φορτίου ·') + ' '}
                {loadSelected.size}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedReleaseLoad && (
        <div className="modal-backdrop" onMouseDown={closeLoadRelease}>
          <div className="receipt-card-modal workflow-modal load-release-modal" onMouseDown={e => e.stopPropagation()}>
            <button className="modal-x" aria-label={tr('Κλείσιμο')} title={tr('Κλείσιμο')} onClick={closeLoadRelease}>
              <X size={18} />
            </button>
            <div className="workflow-modal-head">
              <div className="ster-kind set">
                <ShieldCheck size={20} />
              </div>
              <div className="workflow-modal-title">
                <span className="eyebrow">{tr('QUALITY GATE · ΑΠΟΔΕΣΜΕΥΣΗ ΦΟΡΤΙΟΥ')}</span>
                <h2>
                  {selectedReleaseLoad.id} · {selectedReleaseLoad.equipment}
                </h2>
                <p>
                  {tr('Κύκλος') + ' '}
                  {selectedReleaseLoad.cycleNumber} · {selectedReleaseLoad.program} · {selectedReleaseLoad.items.length}{' '}
                  {tr('αντικείμενα')}
                </p>
              </div>
            </div>
            <div className="workflow-modal-body">
              <section className="release-check-card">
                <div className="receipt-section-title">
                  <div>
                    <strong>{tr('Έλεγχοι φορτίου')}</strong>
                    <span>
                      {tr('Η απόφαση εφαρμόζεται σε όλα τα αντικείμενα που συνδέονται με το συγκεκριμένο φορτίο.')}
                    </span>
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
                    <strong>{tr('Φυσικές παράμετροι κύκλου αποδεκτές')}</strong>
                  </span>
                </label>
                <label className="release-check-row">
                  <input
                    type="checkbox"
                    checked={releaseLoadChecks.chemicalIndicatorOk}
                    onChange={e => setReleaseLoadChecks(v => ({...v, chemicalIndicatorOk: e.target.checked}))}
                  />
                  <span>
                    <strong>{tr('Χημικός δείκτης αποδεκτός')}</strong>
                  </span>
                </label>
                <label className="release-check-row">
                  <input
                    type="checkbox"
                    checked={releaseLoadChecks.packagingIntegrityOk}
                    onChange={e => setReleaseLoadChecks(v => ({...v, packagingIntegrityOk: e.target.checked}))}
                  />
                  <span>
                    <strong>{tr('Συσκευασίες στεγνές και ακέραιες')}</strong>
                  </span>
                </label>
                <label className="release-biological">
                  {tr('Βιολογικός δείκτης')}
                  <select
                    value={releaseLoadBi}
                    onChange={e => setReleaseLoadBi(e.target.value as 'NOT_REQUIRED' | 'PASS' | 'PENDING' | 'FAIL')}
                  >
                    <option value="NOT_REQUIRED">{tr('Δεν απαιτείται βάσει πολιτικής / κύκλου')}</option>
                    <option value="PASS">{tr('Αρνητικός / επιτυχής')}</option>
                    <option value="PENDING">{tr('Σε αναμονή')}</option>
                    <option value="FAIL">{tr('Θετικός / αποτυχία')}</option>
                  </select>
                </label>
              </section>
              <div className="load-manifest">
                <strong>{tr('Manifest φορτίου')}</strong>
                {selectedReleaseLoad.items.map(item => (
                  <div key={`${item.assetKind}:${item.assetId}`}>
                    <span className="mono">{item.barcode}</span>
                    <b>{item.assetName}</b>
                    <small>{trData(item.department)}</small>
                  </div>
                ))}
              </div>
              <label className="cycle-note">
                {tr('Παρατήρηση αποδέσμευσης')}
                <textarea
                  value={releaseLoadNote}
                  onChange={e => setReleaseLoadNote(e.target.value)}
                  placeholder={tr('Προαιρετική παρατήρηση / αιτιολογία…')}
                />
              </label>
            </div>
            <div className="modal-actions workflow-modal-actions release-actions">
              <button onClick={closeLoadRelease}>{tr('Ακύρωση')}</button>
              <button className="release-reprocess" onClick={() => completeLoadRelease('REPROCESS')}>
                <TriangleAlert size={16} /> {tr('Μη αποδέσμευση · όλο το φορτίο')}
              </button>
              <button className="primary" disabled={!releaseLoadReady} onClick={() => completeLoadRelease('RELEASED')}>
                <ShieldCheck size={16} /> {tr('Αποδέσμευση φορτίου ·') + ' '}
                {selectedReleaseLoad.items.length}
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
            <button className="modal-x" aria-label={tr('Κλείσιμο')} title={tr('Κλείσιμο')} onClick={closeCheckpoint}>
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
                <span className="eyebrow">QUALITY GATE · {tr(checkpointStage.labelEl).toUpperCase()}</span>
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
                  <small>{tr('Καταγράφεται από')}</small>
                  <strong>{trData(currentUser.name)}</strong>
                  <span>
                    {trData(currentUser.department)} ·{' '}
                    {new Date().toLocaleString('el-GR', {dateStyle: 'short', timeStyle: 'short'})}
                  </span>
                </div>
              </div>
              <section className="release-check-card">
                <div className="receipt-section-title">
                  <div>
                    <strong>{tr('Απαιτούμενοι έλεγχοι')}</strong>
                    <span>{tr('Όλοι οι ενεργοί έλεγχοι πρέπει να επιβεβαιωθούν για να προχωρήσει η ροή.')}</span>
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
                {tr('Παρατήρηση σταδίου')}
                <textarea
                  value={checkpointNote}
                  onChange={e => setCheckpointNote(e.target.value)}
                  placeholder={tr('Προαιρετική παρατήρηση ή αριθμός κύκλου / πλυντηρίου…')}
                />
              </label>
            </div>
            <div className="modal-actions workflow-modal-actions">
              <button onClick={closeCheckpoint}>{tr('Ακύρωση')}</button>
              <button className="primary" disabled={!checkpointReady} onClick={finishCheckpoint}>
                <CheckCircle2 size={16} /> {tr('Ολοκλήρωση · Επόμενο στάδιο')}
              </button>
            </div>
          </div>
        </div>
      )}

      {receiptDraft && (
        <div className="modal-backdrop" onMouseDown={closeReceipt}>
          <div className="receipt-card-modal" onMouseDown={e => e.stopPropagation()}>
            <button className="modal-x" aria-label={tr('Κλείσιμο')} title={tr('Κλείσιμο')} onClick={closeReceipt}>
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
                <span>{tr('ΚΑΡΤΕΛΑ ΠΑΡΑΛΑΒΗΣ')}</span>
                <h2>
                  {receiptDraft.asset.barcode} · {receiptDraft.asset.name}
                </h2>
                <p>
                  {trData(receiptDraft.asset.department)} {tr('→ Κεντρική Αποστείρωση')}
                </p>
              </div>
            </div>

            <div className="receipt-card-body receipt-two-column">
              <div className="receipt-left-panel">
                <section className="receipt-work-section">
                  <div className="receipt-section-title">
                    <div>
                      <strong>{tr('Στοιχεία παραλαβής')}</strong>
                      <span>{tr('Φυσική παράδοση και στοιχεία παραλαμβάνοντα.')}</span>
                    </div>
                  </div>
                  <div className="receipt-summary-grid compact-summary">
                    <div>
                      <Building2 />
                      <span>{tr('Τμήμα αποστολής')}</span>
                      <strong>{trData(receiptDraft.asset.department)}</strong>
                    </div>
                    <div>
                      <Clock3 />
                      <span>{tr('Ημερομηνία / ώρα')}</span>
                      <strong>{new Date().toLocaleString('el-GR', {dateStyle: 'short', timeStyle: 'short'})}</strong>
                    </div>
                    <div>
                      <UserCheck />
                      <span>{tr('Παραλαμβάνει')}</span>
                      <strong>{trData(currentUser.name)}</strong>
                      <small>{trData(currentUser.department)}</small>
                    </div>
                    {receiptDraft.kind === 'SET' ? (
                      <div>
                        <ClipboardCheck />
                        <span>{tr('Δηλωμένη σύνθεση')}</span>
                        <strong
                          className={receiptDraft.asset.actual !== receiptDraft.asset.expected ? 'warn-text' : ''}
                        >
                          {receiptExpectedCount} {tr('τεμάχια')}
                        </strong>
                        <small>
                          {receiptExpectedCount} {tr('φυσικές εγγραφές')}
                        </small>
                      </div>
                    ) : (
                      <div>
                        <Stethoscope />
                        <span>{tr('Τύπος')}</span>
                        <strong>{tr('Μεμονωμένο εργαλείο')}</strong>
                      </div>
                    )}
                  </div>
                </section>

                <section className="receipt-work-section identity-work-section">
                  <div className="receipt-section-title">
                    <div>
                      <strong>{tr('Ταυτοποίηση παραδίδοντα')}</strong>
                      <span>{tr('Επιβεβαίωση με προσωπικό κωδικό.')}</span>
                    </div>
                    <IdCard size={18} />
                  </div>
                  <div className="identity-section">
                    <label>
                      {tr('Κωδικός ταυτοποίησης')}
                      <div className="identity-input-row">
                        <input
                          autoFocus
                          value={handoverCode}
                          onChange={e => setHandoverCode(e.target.value.toUpperCase())}
                          placeholder={tr('Κωδικός χρήστη')}
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
                        Demo: {demoIdentity.code} · {trData(demoIdentity.department)}
                      </small>
                    )}
                    {handoverCode &&
                      (!deliverer ? (
                        <div className="identity-error">{tr('Ο κωδικός δεν αναγνωρίστηκε.')}</div>
                      ) : !delivererMatches ? (
                        <div className="identity-mismatch-box">
                          <div className="identity-warning">
                            <TriangleAlert size={16} />
                            <span>
                              {tr('Ο χρήστης ανήκει στο') + ' '}
                              <b>{trData(deliverer.department)}</b>
                              {tr(', ενώ η αποστολή προέρχεται από')} <b>{trData(receiptDraft.asset.department)}</b>.
                            </span>
                          </div>
                          {receiptPolicy.allowCrossDepartmentHandover ? (
                            <label>
                              {tr('Αιτιολόγηση εξαίρεσης')}
                              <textarea
                                value={departmentMismatchReason}
                                onChange={e => setDepartmentMismatchReason(e.target.value)}
                                placeholder={tr('Π.χ. εξουσιοδοτημένη μεταφορά από άλλο τμήμα…')}
                              />
                            </label>
                          ) : (
                            <div className="identity-error">
                              {tr('Η πολιτική της μονάδας δεν επιτρέπει παραλαβή από διαφορετικό τμήμα.')}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="identity-result">
                          <CheckCircle2 size={17} />
                          <div>
                            <strong>{deliverer.name}</strong>
                            <span>
                              {deliverer.role} · {trData(deliverer.department)}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                  <div className="handover-warning compact-warning">
                    <TriangleAlert size={16} />
                    <span>{tr('Η παραλαβή ολοκληρώνεται μόνο μετά την ταυτοποίηση.')}</span>
                  </div>
                </section>

                <section className="receipt-work-section receipt-check-section">
                  <div className="receipt-section-title">
                    <div>
                      <strong>{tr('Εμφανής κατάσταση κατά την παραλαβή')}</strong>
                      <span>{tr('Δεν υποκαθιστά τον αναλυτικό Έλεγχο & Σύνθεση.')}</span>
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
                      <CheckCircle2 size={16} /> {tr('Χωρίς εμφανή απόκλιση')}
                    </button>
                    <button
                      type="button"
                      className={visibleDeviation ? 'active warn' : ''}
                      onClick={() => setVisibleDeviation(true)}
                    >
                      <TriangleAlert size={16} /> {tr('Υπάρχει εμφανής απόκλιση')}
                    </button>
                  </div>
                  {visibleDeviation && (
                    <div className={`handover-warning compact-warning ${receiptDeviationRecorded ? 'recorded' : ''}`}>
                      <TriangleAlert size={16} />
                      <span>
                        {receiptDeviationRecorded
                          ? tr('Η εμφανής απόκλιση έχει καταγραφεί. Μπορείς να ολοκληρώσεις την παραλαβή.')
                          : tr(
                              'Απαιτείται καταγραφή: χρησιμοποίησε «Αναφορά Σετ» ή «Αναφορά» στο συγκεκριμένο εργαλείο.',
                            )}
                      </span>
                    </div>
                  )}
                  {receiptDraft.kind === 'SET' && receiptPolicy.countSetsAtReceipt && (
                    <div className="receipt-count-only">
                      <div>
                        <span>{tr('Αναμενόμενα')}</span>
                        <strong>{receiptExpectedCount}</strong>
                      </div>
                      <label>
                        {tr('Παραληφθέντα')}
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
                          <span>{tr('Η διαφορά ποσότητας θα καταγραφεί αυτόματα ως έλλειψη.')}</span>
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
                        <strong>{tr('Προσθήκη παρατήρησης')}</strong>
                        <small>{tr('Προαιρετική σημείωση για τη φυσική παραλαβή')}</small>
                      </span>
                    </button>
                  ) : (
                    <div className="receipt-inline-note-editor">
                      <div className="receipt-inline-note-head">
                        <div>
                          <strong>{tr('Παρατήρηση παραλαβής')}</strong>
                          <small>{tr('Προαιρετικά')}</small>
                        </div>
                        <button
                          type="button"
                          className="receipt-note-close"
                          onClick={() => {
                            setReceiptNoteOpen(false);
                            setNote('');
                          }}
                          aria-label={tr('Κλείσιμο παρατήρησης')}
                        >
                          <X size={15} />
                        </button>
                      </div>
                      <textarea
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        placeholder={tr('Κατάσταση μεταφοράς ή άλλη παρατήρηση…')}
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
                          <strong>{tr('Φυσική σύνθεση Σετ')}</strong>
                          <span>
                            {receiptTools.length} {tr('εργαλεία — αναφορά μόνο αν εντοπιστεί εμφανές πρόβλημα')}
                          </span>
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
                          <TriangleAlert size={14} /> {tr('Αναφορά Σετ')}
                        </button>
                      </div>
                    </div>
                    <div className="receipt-tool-columns">
                      <span>Barcode</span>
                      <span>{tr('Κωδικός')}</span>
                      <span>{tr('Όνομα εργαλείου')}</span>
                      <span>{tr('Εταιρεία')}</span>
                      <span>{tr('Κατάσταση')}</span>
                      <span>{tr('Ενέργεια')}</span>
                    </div>
                    <div className="prep-tools-scroll receipt-tools-scroll">
                      {receiptTools.length === 0 ? (
                        <div className="empty compact-empty">{tr('Δεν υπάρχουν συνδεδεμένα εργαλεία στο demo.')}</div>
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
                                    {tr('Υπόλοιπο') + ' '}
                                    {remaining}/{t.maxUses}
                                  </small>
                                )}
                              </div>
                              <span className="receipt-tool-manufacturer">{t.manufacturer || '—'}</span>
                              <div className="receipt-tool-state">
                                {problem ? (
                                  toolIssues.map(i => (
                                    <span className="prep-issue-chip" key={i.id}>
                                      <TriangleAlert size={12} />
                                      {trData(i.type)}
                                    </span>
                                  ))
                                ) : (
                                  <span className="prep-ok-chip">{tr('Χωρίς απόκλιση')}</span>
                                )}
                              </div>
                              <button
                                className="tool-report-btn"
                                type="button"
                                onClick={() => openIssueReport('TOOL', t.id, 'Αποστείρωση · κατά την παραλαβή')}
                              >
                                <TriangleAlert size={14} /> {tr('Αναφορά')}
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
                        <strong>{tr('Μεμονωμένο εργαλείο κατά την παραλαβή')}</strong>
                        <span>
                          {tr(
                            'Τα βασικά στοιχεία εμφανίζονται σε μία καθαρή γραμμή · αναφορά μόνο αν εντοπιστεί εμφανές πρόβλημα',
                          )}
                        </span>
                      </div>
                      <div className="prep-tools-toolbar-actions"></div>
                    </div>
                    <div className="receipt-tool-columns">
                      <span>Barcode</span>
                      <span>{tr('Κωδικός')}</span>
                      <span>{tr('Όνομα εργαλείου')}</span>
                      <span>{tr('Εταιρεία')}</span>
                      <span>{tr('Κατάσταση')}</span>
                      <span>{tr('Ενέργεια')}</span>
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
                                  {tr('Υπόλοιπο') + ' '}
                                  {remaining}/{t.maxUses}
                                </small>
                              )}
                            </div>
                            <span className="receipt-tool-manufacturer">{t.manufacturer || '—'}</span>
                            <div className="receipt-tool-state">
                              {problem ? (
                                toolIssues.map(i => (
                                  <span className="prep-issue-chip" key={i.id}>
                                    <TriangleAlert size={12} />
                                    {trData(i.type)}
                                  </span>
                                ))
                              ) : (
                                <span className="prep-ok-chip">{tr('Χωρίς απόκλιση')}</span>
                              )}
                            </div>
                            <button
                              className="tool-report-btn"
                              type="button"
                              onClick={() => openIssueReport('TOOL', t.id, 'Αποστείρωση · κατά την παραλαβή')}
                            >
                              <TriangleAlert size={14} /> {tr('Αναφορά')}
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
              <button onClick={closeReceipt}>{tr('Ακύρωση')}</button>
              <button
                className="primary"
                disabled={!receiptIdentityValid || (visibleDeviation && !receiptDeviationRecorded)}
                onClick={confirmReceipt}
              >
                <UserRoundCheck size={16} /> {tr('Επιβεβαίωση φυσικής παραλαβής')}
              </button>
            </div>
          </div>
        </div>
      )}

      {issueTarget && (
        <div className="nested-modal-backdrop" onMouseDown={closeIssueReport}>
          <div className="tool-issue-card" onMouseDown={e => e.stopPropagation()}>
            <button className="modal-x" aria-label={tr('Κλείσιμο')} title={tr('Κλείσιμο')} onClick={closeIssueReport}>
              <X size={17} />
            </button>
            <span className="eyebrow">{issueTarget.kind === 'SET' ? tr('ΑΝΑΦΟΡΑ ΣΕΤ') : tr('ΑΝΑΦΟΡΑ ΕΡΓΑΛΕΙΟΥ')}</span>
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
              {tr('Τύπος αναφοράς')}
              <select value={issueType} onChange={e => setIssueType(e.target.value)}>
                <option>{tr('Βλάβη / μη λειτουργικό')}</option>
                <option>{tr('Φθορά')}</option>
                <option>{tr('Κατεστραμμένο')}</option>
                {issueTarget.kind === 'SET' && <option>{tr('Έλλειψη σύνθεσης')}</option>}
                <option>{tr('Άλλο πρόβλημα')}</option>
              </select>
            </label>
            <label>
              {tr('Παρατήρηση')}
              <textarea
                value={issueNote}
                onChange={e => setIssueNote(e.target.value)}
                placeholder={
                  issueTarget.kind === 'SET'
                    ? tr('Περιέγραψε το πρόβλημα που αφορά το Σετ…')
                    : tr('Περιέγραψε τι διαπιστώθηκε στο εργαλείο…')
                }
              />
            </label>
            <div className="issue-photo-field">
              <div className="issue-photo-head">
                <div>
                  <strong>{tr('Φωτογραφίες φθοράς / βλάβης')}</strong>
                  <span>{tr('Προαιρετικά, μία ή περισσότερες φωτογραφίες.')}</span>
                </div>
                <div className="issue-photo-actions">
                  <button
                    type="button"
                    className="app-button app-button-secondary app-button-sm"
                    onClick={() => setIssueCameraOpen(true)}
                  >
                    <Camera size={15} /> {tr('Λήψη')}
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
                        aria-label={tr('Αφαίρεση φωτογραφίας')}
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
                {tr('Ακύρωση')}
              </button>
              <button type="button" className="primary" onClick={saveIssueReport}>
                <TriangleAlert size={15} /> {tr('Καταχώρηση αναφοράς')}
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
            <button
              className="modal-x"
              aria-label={tr('Κλείσιμο')}
              title={tr('Κλείσιμο')}
              onClick={() => setPrepDraft(null)}
            >
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
                <span>{tr('ΣΥΝΘΕΣΗ & ΠΡΟΕΤΟΙΜΑΣΙΑ')}</span>
                <h2>
                  {prepDraft.asset.barcode} · {prepDraft.asset.name}
                </h2>
                <p>{tr('Έλεγχος φυσικών εργαλείων μετά το πλύσιμο και πριν τον κλιβανισμό.')}</p>
              </div>
            </div>
            <div className="prep-workspace-body">
              <aside className="prep-control-panel">
                <section className="prep-card-section">
                  <div className="prep-section-head">
                    <div>
                      <strong>{tr('Στοιχεία προετοιμασίας')}</strong>
                      <span>{tr('Ο χρήστης καταγράφεται αυτόματα στην καρτέλα.')}</span>
                    </div>
                  </div>
                  <div className="prep-facts">
                    <div>
                      <UserCheck />
                      <span>{tr('Προετοιμάζει')}</span>
                      <strong>{trData(currentUser.name)}</strong>
                      <small>{trData(currentUser.department)}</small>
                    </div>
                    <div>
                      <Clock3 />
                      <span>{tr('Ημερομηνία / ώρα')}</span>
                      <strong>{new Date().toLocaleString('el-GR', {dateStyle: 'short', timeStyle: 'short'})}</strong>
                    </div>
                    <div>
                      <Layers3 />
                      <span>{tr('Φυσικά εργαλεία')}</span>
                      <strong>{prepItemIds.length}</strong>
                    </div>
                    <div className={prepBlockingIssues.length ? 'warning' : ''}>
                      <TriangleAlert />
                      <span>{tr('Εκκρεμότητες που μπλοκάρουν')}</span>
                      <strong>{prepBlockingIssues.length}</strong>
                    </div>
                  </div>
                </section>
                <section className="prep-card-section prep-quality-section">
                  <div className="prep-section-head">
                    <div>
                      <strong>{tr('Έλεγχος & προετοιμασία')}</strong>
                      <span>{tr('Τεκμηρίωση πριν από συσκευασία και κλιβανισμό.')}</span>
                    </div>
                  </div>
                  <div className="prep-check-summary">
                    <div>
                      <span>{tr('Ελεγμένα εργαλεία')}</span>
                      <strong>
                        {prepCheckedIds.size} / {prepItemIds.length}
                      </strong>
                    </div>
                    <div>
                      <span>{tr('Σύνθεση')}</span>
                      <strong>
                        {prepDraft.kind === 'SET' ? `${prepTools.length} / ${prepDraft.asset.expected}` : '1 / 1'}
                      </strong>
                    </div>
                  </div>
                  {prepBlockingIssues.length > 0 && (
                    <div className="prep-block-warning">
                      <TriangleAlert size={16} />
                      <span>
                        {tr('Υπάρχουν') + ' '}
                        {prepBlockingIssues.length} {tr('εκκρεμότητες που απαιτούν ενέργεια πριν την προώθηση.')}
                      </span>
                    </div>
                  )}
                  {prepAcceptedDeviation && prepBlockingIssues.length === 0 && (
                    <div className="prep-accepted-warning">
                      <CheckCircle2 size={16} />
                      <span>
                        {tr(
                          'Η έλλειψη έχει γίνει αποδεκτή ως τεκμηριωμένη απόκλιση. Η διαδικασία μπορεί να προχωρήσει όταν ολοκληρωθούν οι υπόλοιποι έλεγχοι.',
                        )}
                      </span>
                    </div>
                  )}
                  <div className="prep-process-checks">
                    <strong>{tr('Έλεγχοι πριν τον κλιβανισμό')}</strong>
                    {!stageEnabled('WASHING') && (
                      <label>
                        <input
                          type="checkbox"
                          checked={prepProcessChecks.cleanDry}
                          onChange={e => setPrepProcessChecks(v => ({...v, cleanDry: e.target.checked}))}
                        />
                        <span>
                          <b>{tr('Καθαρότητα & στέγνωμα')}</b>
                          <small>{tr('Τα εργαλεία είναι οπτικά καθαρά και πλήρως στεγνά.')}</small>
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
                        <b>{tr('Ακεραιότητα & λειτουργικότητα')}</b>
                        <small>{tr('Δεν διαπιστώθηκε βλάβη και η λειτουργία είναι αποδεκτή.')}</small>
                      </span>
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={prepProcessChecks.assembly}
                        onChange={e => setPrepProcessChecks(v => ({...v, assembly: e.target.checked}))}
                      />
                      <span>
                        <b>{prepDraft.kind === 'SET' ? tr('Σύνθεση & συναρμολόγηση') : tr('Επιβεβαίωση εργαλείου')}</b>
                        <small>
                          {prepDraft.kind === 'SET'
                            ? tr('Η σύνθεση έχει ελεγχθεί και συναρμολογηθεί σύμφωνα με τη δηλωμένη καρτέλα.')
                            : tr('Το εργαλείο και τα απαιτούμενα μέρη του έχουν ελεγχθεί.')}
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
                            <b>{tr('Συσκευασία / περιέκτης')}</b>
                            <small>{tr('Επιλέχθηκε κατάλληλη και ακέραιη συσκευασία ή περιέκτης.')}</small>
                          </span>
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={prepProcessChecks.labelIndicator}
                            onChange={e => setPrepProcessChecks(v => ({...v, labelIndicator: e.target.checked}))}
                          />
                          <span>
                            <b>{tr('Σήμανση & δείκτης')}</b>
                            <small>{tr('Η σήμανση και ο απαιτούμενος χημικός δείκτης έχουν τοποθετηθεί.')}</small>
                          </span>
                        </label>
                      </>
                    )}
                  </div>
                  <label className="prep-note-field">
                    {tr('Παρατήρηση προετοιμασίας')}
                    <textarea
                      value={prepNote}
                      onChange={e => setPrepNote(e.target.value)}
                      placeholder={tr('Προαιρετική παρατήρηση για σύνθεση, συσκευασία ή άλλη απόκλιση…')}
                    />
                  </label>
                </section>
                <section className="prep-card-section">
                  <div className="prep-section-head">
                    <div>
                      <strong>{tr('Εκτυπώσεις')}</strong>
                      <span>{tr('Φύλλο σύνθεσης Α4 και barcode.')}</span>
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
                        <Printer size={16} /> {tr('Εκτύπωση')}
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
                      <Barcode size={16} /> {tr('Εκτύπωση barcode')}
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
                          ? tr(
                              'Σύνθεση {0}/{1} · {2} {3}',
                              prepTools.length,
                              prepExpectedCount,
                              prepMissingCount,
                              prepMissingCount === 1 ? 'έλλειψη' : 'ελλείψεις',
                            )
                          : tr('Σύνθεση πλήρης · {0}/{1}', prepTools.length, prepExpectedCount)}
                      </strong>
                      <span>
                        {prepMissingCount > 0
                          ? tr('Η έλλειψη εμφανίζεται και διαχειρίζεται μέσα στη λίστα εργαλείων.')
                          : tr('Όλες οι αναμενόμενες θέσεις της σύνθεσης είναι καλυμμένες.')}
                      </span>
                    </div>
                  </div>
                )}
                <div className="prep-tools-head prep-tools-toolbar prep-tools-toolbar-refined">
                  <div className="prep-tools-heading-block">
                    <div>
                      <strong>{prepDraft.kind === 'SET' ? tr('Εργαλεία Σετ') : tr('Μεμονωμένο εργαλείο')}</strong>
                      <span>
                        {prepDraft.kind === 'SET'
                          ? tr('{0} φυσικές εγγραφές — έλεγχος και διαχείριση ανά εργαλείο', prepTools.length)
                          : tr('Έλεγχος και επιβεβαίωση πριν τη συσκευασία')}
                      </span>
                      {prepDraft.kind === 'SET' && prepBlockingIssues.length > 0 && (
                        <button
                          type="button"
                          className="prep-open-issues-filter"
                          title={tr('Εκκρεμότητες που απαιτούν ενέργεια')}
                        >
                          <TriangleAlert size={12} />
                          {prepBlockingIssues.length}{' '}
                          {prepBlockingIssues.length === 1 ? tr('εκκρεμότητα') : tr('εκκρεμότητες')}
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
                            <X size={14} /> {tr('Αποεπιλογή όλων')}
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={14} /> {tr('Επιλογή όλων')}
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
                                    {tr('Ανοικτή αναφορά')}
                                  </span>
                                  <small>{toolIssues.map(i => i.type).join(' · ')}</small>
                                </span>
                              ) : (
                                <span className="prep-ok-chip">{tr('Έτοιμο για έλεγχο')}</span>
                              )}
                            </div>
                            <button
                              className={`tool-manage-btn prep-attention-action ${toolIssues.length ? 'warning' : 'subtle'}`}
                              type="button"
                              onClick={() => openPrepManage(t.id)}
                            >
                              {toolIssues.length ? (
                                <>
                                  <TriangleAlert size={14} /> {tr('Αντιμετώπιση')}
                                </>
                              ) : (
                                <>
                                  {tr('Λεπτομέρειες') + ' '}
                                  <ArrowRight size={14} />
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
                                <small>
                                  {req.code} {tr('· αναμενόμενο εργαλείο που λείπει από τη φυσική σύνθεση')}
                                </small>
                              </div>
                              <div className="prep-tool-state">
                                {accepted ? (
                                  <span className="prep-missing-accepted">{tr('Αποδεκτή απόκλιση')}</span>
                                ) : (
                                  <span className="prep-missing-chip">{tr('Λείπει')}</span>
                                )}
                              </div>
                              {accepted ? (
                                <button
                                  className="tool-manage-btn subtle"
                                  type="button"
                                  onClick={() => undoAcceptedMissing(req.code)}
                                >
                                  {tr('Αναίρεση')}
                                </button>
                              ) : (
                                <button
                                  className="tool-manage-btn warning prep-attention-action"
                                  type="button"
                                  onClick={() => openMissingManage(req.code)}
                                >
                                  <TriangleAlert size={14} /> {tr('Αντιμετώπιση')}
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
                        <span className="prep-ok-chip">{tr('Έτοιμο για έλεγχο')}</span>
                      </div>
                      <button
                        className="tool-manage-btn subtle prep-attention-action"
                        type="button"
                        onClick={() => openPrepManage(prepDraft.asset.id)}
                      >
                        {tr('Λεπτομέρειες') + ' '}
                        <ArrowRight size={14} />
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
                  <strong>{tr('Αποδοχή καταγεγραμμένης έλλειψης')}</strong>
                  <small>
                    {tr('Το Set θα προχωρήσει με') + ' '}
                    {prepMissingCount} {tr('λιγότερα εργαλεία. Η απόκλιση καταγράφεται στο ιστορικό.')}
                  </small>
                </span>
              </label>
            )}
            <div className="modal-actions">
              <button onClick={() => setPrepDraft(null)}>{tr('Ακύρωση')}</button>
              <button
                className="primary"
                disabled={!prepReadyForProcess}
                onClick={() => moveToProcess(prepDraft.kind, prepDraft.asset.id)}
              >
                <Flame size={16} /> {tr('Ολοκλήρωση · Προς κλιβανισμό')}
              </button>
            </div>
          </div>
        </div>
      )}

      {prepManageMissing && prepDraft?.kind === 'SET' && (
        <div className="nested-modal-backdrop" onMouseDown={closePrepManage}>
          <div className="tool-issue-card prep-manage-card" onMouseDown={e => e.stopPropagation()}>
            <button className="modal-x" aria-label={tr('Κλείσιμο')} title={tr('Κλείσιμο')} onClick={closePrepManage}>
              <X size={17} />
            </button>
            <span className="eyebrow">{tr('ΔΙΑΧΕΙΡΙΣΗ ΕΛΛΕΙΨΗΣ')}</span>
            <h3>{prepManageMissing.name}</h3>
            <div className="prep-manage-summary">
              <span>
                {prepManageMissing.code} {tr('· λείπουν') + ' '}
                {prepManageMissing.missing} {tr('από') + ' '}
                {prepManageMissing.quantity}
              </span>
            </div>
            <div className="prep-manage-grid">
              {canCompose && (
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
                    <b>{tr('Κάλυψη έλλειψης')}</b>
                    <small>{tr('Επιλογή εργαλείου από Stock, άλλο Set ή μεμονωμένο')}</small>
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setPrepManageMissingCode(null);
                  openCompositionShortageReport();
                }}
              >
                <TriangleAlert size={16} />
                <span>
                  <b>{tr('Αναφορά')}</b>
                  <small>{tr('Καταγραφή της έλλειψης ως απόκλιση του Set')}</small>
                </span>
              </button>
              <button
                type="button"
                className="prep-no-action-option"
                onClick={() => acceptMissingWithoutAction(prepManageMissing.code)}
              >
                <CheckCircle2 size={16} />
                <span>
                  <b>{tr('Χωρίς ενέργεια')}</b>
                  <small>{tr('Καταγραφή της έλλειψης και συνέχιση της διαδικασίας')}</small>
                </span>
              </button>
            </div>
            {!canCompose && (
              <p className="prep-supervisor-note">
                {tr('Αλλαγές στη σύνθεση του Set (αντικατάσταση, Service, Stock) κάνει ο Προϊστάμενος Αποστείρωσης.')}
              </p>
            )}
          </div>
        </div>
      )}

      {prepManageTool && prepDraft && (
        <div className="nested-modal-backdrop" onMouseDown={closePrepManage}>
          <div className="tool-issue-card prep-manage-card" onMouseDown={e => e.stopPropagation()}>
            <button className="modal-x" aria-label={tr('Κλείσιμο')} title={tr('Κλείσιμο')} onClick={closePrepManage}>
              <X size={17} />
            </button>
            <span className="eyebrow">{tr('ΔΙΑΧΕΙΡΙΣΗ ΕΡΓΑΛΕΙΟΥ')}</span>
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
                <strong>{tr('Φωτογραφίες & τεκμηρίωση')}</strong>
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
                <strong>{tr('Ανοικτές αναφορές')}</strong>
                {issues
                  .filter(i => i.status === 'OPEN' && i.asset.startsWith(prepManageTool.barcode))
                  .map(i => (
                    <div key={i.id}>
                      <TriangleAlert size={13} />
                      <span>
                        <b>{trData(i.type)}</b>
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
                  <b>{tr('Αναφορά')}</b>
                  <small>{tr('Βλάβη, φθορά ή άλλη απόκλιση')}</small>
                </span>
              </button>
              {prepDraft.kind === 'SET' && canCompose && (
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
                      <b>{tr('Αντικατάσταση')}</b>
                      <small>{tr('Αντικατάσταση με άλλο φυσικό εργαλείο')}</small>
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
                      <small>{tr('Απομάκρυνση για επισκευή / έλεγχο')}</small>
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
                      <small>{tr('Επιστροφή στο κεντρικό stock')}</small>
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
                      <b>{tr('Άλλο Set')}</b>
                      <small>{tr('Μεταφορά σε διαφορετικό Set')}</small>
                    </span>
                  </button>
                </>
              )}
            </div>
            {!canCompose && prepDraft.kind === 'SET' && (
              <p className="prep-supervisor-note">
                {tr('Αλλαγές στη σύνθεση του Set (αντικατάσταση, Service, Stock) κάνει ο Προϊστάμενος Αποστείρωσης.')}
              </p>
            )}
          </div>
        </div>
      )}

      {prepToolAction && prepDraft?.kind === 'SET' && (prepSelectedTool || prepReplacementRequirement) && (
        <div className="nested-modal-backdrop" onMouseDown={closePrepToolAction}>
          <div className="tool-issue-card prep-tool-action-card" onMouseDown={e => e.stopPropagation()}>
            <button
              className="modal-x"
              aria-label={tr('Κλείσιμο')}
              title={tr('Κλείσιμο')}
              onClick={closePrepToolAction}
            >
              <X size={17} />
            </button>
            <span className="eyebrow">{tr('ΔΙΑΧΕΙΡΙΣΗ ΣΥΝΘΕΣΗΣ')}</span>
            <h3>
              {prepSelectedTool
                ? `${prepSelectedTool.barcode} · ${prepSelectedTool.name}`
                : tr('Κάλυψη έλλειψης · {0}', prepReplacementRequirement?.name || '')}
            </h3>
            <p className="prep-action-intro">
              {prepToolAction === 'REPLACE'
                ? prepSelectedTool
                  ? tr(
                      'Η αντικατάσταση ολοκληρώνεται ως μία ενιαία κίνηση: ορίζεις πού πηγαίνει το υπάρχον εργαλείο και ποιο φυσικό εργαλείο μπαίνει στη θέση του.',
                    )
                  : tr(
                      'Επίλεξε το φυσικό εργαλείο που θα καλύψει την έλλειψη. Με την επιβεβαίωση θα προστεθεί στο Set.',
                    )
                : prepToolAction === 'SERVICE'
                  ? tr('Το εργαλείο θα αφαιρεθεί από το Set και θα μεταφερθεί στα Χαλασμένα / Service.')
                  : prepToolAction === 'STOCK'
                    ? tr('Το εργαλείο θα αφαιρεθεί από το Set και θα επιστρέψει στο κεντρικό Stock.')
                    : tr('Το εργαλείο θα αφαιρεθεί από το τρέχον Set και θα προστεθεί σε άλλο Set.')}
            </p>
            {prepToolAction === 'REPLACE' && (
              <>
                {prepSelectedTool && (
                  <div className="prep-replace-flow">
                    <div className="prep-replace-step">
                      <span>1</span>
                      <div>
                        <strong>{tr('Εργαλείο που αφαιρείται')}</strong>
                        <small>
                          {prepSelectedTool.barcode} · {prepSelectedTool.name}
                        </small>
                      </div>
                    </div>
                    <div className="prep-replace-destination">
                      <strong>{tr('Πού θα μεταφερθεί το υπάρχον εργαλείο;')}</strong>
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
                          {tr('Άλλο Set')}
                        </button>
                      </div>
                      {prepOutgoingDestination === 'SET' && (
                        <label>
                          {tr('Set προορισμού')}
                          <select value={prepOutgoingSetId} onChange={e => setPrepOutgoingSetId(e.target.value)}>
                            <option value="">{tr('Επιλογή Set…')}</option>
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
                        <strong>{tr('Εργαλείο αντικατάστασης')}</strong>
                        <small>{tr('Επίλεξε πηγή και φυσικό εργαλείο.')}</small>
                      </div>
                    </div>
                  </div>
                )}
                <div className="prep-replace-source">
                  <strong>{tr('Από πού θα γίνει η αντικατάσταση;')}</strong>
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
                      {tr('Άλλο Set')}
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
                      {tr('Μεμονωμένο σε χρήση')}
                    </button>
                  </div>
                </div>
                {prepReplacementSource === 'SET' && (
                  <label>
                    {tr('1. Επιλογή Set')}
                    <select
                      value={prepReplacementSetId}
                      onChange={e => {
                        setPrepReplacementSetId(e.target.value);
                        setPrepReplacementId('');
                      }}
                    >
                      <option value="">{tr('Επιλογή Set…')}</option>
                      {prepReplacementSourceSets.map(set => (
                        <option key={set.id} value={set.id}>
                          {set.barcode} · {set.name} ·{' '}
                          {tools.filter(t => t.mode === 'SET_MEMBER' && t.setId === set.id).length} {tr('εργαλεία')}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  {prepReplacementSource === 'SET' ? tr('2. Επιλογή εργαλείου') : tr('Εργαλείο αντικατάστασης')}
                  <select
                    value={prepReplacementId}
                    disabled={prepReplacementSource === 'SET' && !prepReplacementSetId}
                    onChange={e => setPrepReplacementId(e.target.value)}
                  >
                    <option value="">{tr('Επιλογή εργαλείου…')}</option>
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
                      ? tr(
                          'Με την επιβεβαίωση γίνονται ταυτόχρονα η έξοδος του υπάρχοντος εργαλείου και η είσοδος του νέου στο Set.',
                        )
                      : tr(
                          'Με την επιβεβαίωση το επιλεγμένο φυσικό εργαλείο προστίθεται στο Set και καλύπτει την έλλειψη.',
                        )}
                  </span>
                </div>
                {(() => {
                  const replacement = tools.find(t => t.id === prepReplacementId);
                  const sourceSet = replacement?.setId ? sets.find(s => s.id === replacement.setId) : undefined;
                  return replacement?.mode === 'SET_MEMBER' && sourceSet ? (
                    <div className="prep-block-warning">
                      <TriangleAlert size={16} />
                      <span>
                        {tr('Θα αφαιρεθεί από το Set') + ' '}
                        {sourceSet.barcode}
                        {tr(', το οποίο θα μείνει με έλλειψη.')}
                      </span>
                    </div>
                  ) : null;
                })()}
              </>
            )}
            {prepToolAction === 'SET' && (
              <label>
                {tr('Set προορισμού')}
                <select value={prepTargetSetId} onChange={e => setPrepTargetSetId(e.target.value)}>
                  <option value="">{tr('Επιλογή Set…')}</option>
                  {prepOtherSets.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.barcode} · {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="modal-actions">
              <button onClick={closePrepToolAction}>{tr('Ακύρωση')}</button>
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
                    ? tr('Επιβεβαίωση αντικατάστασης')
                    : tr('Επιβεβαίωση κάλυψης έλλειψης')
                  : prepToolAction === 'SERVICE'
                    ? tr('Μεταφορά στα Χαλασμένα / Service')
                    : prepToolAction === 'STOCK'
                      ? tr('Μεταφορά στο Stock')
                      : tr('Μεταφορά σε άλλο Set')}
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
            <button
              className="modal-x"
              aria-label={tr('Κλείσιμο')}
              title={tr('Κλείσιμο')}
              onClick={closeCycleCompletion}
            >
              <X size={18} />
            </button>
            <div className="workflow-modal-head">
              <div className={`ster-kind ${cycleDraft.kind.toLowerCase()}`}>
                {cycleDraft.kind === 'SET' ? <Box size={20} /> : <Stethoscope size={20} />}
              </div>
              <div className="workflow-modal-title">
                <span className="eyebrow">{tr('ΑΠΟΣΤΕΙΡΩΣΗ · ΚΑΤΑΓΡΑΦΗ ΚΥΚΛΟΥ')}</span>
                <h2>
                  {cycleDraft.asset.barcode} · {cycleDraft.asset.name}
                </h2>
                <p>{tr('Καταχώρηση αποτελέσματος κύκλου. Η αποδέσμευση γίνεται σε ξεχωριστό quality gate.')}</p>
              </div>
              <StatusBadge value={cycleDraft.asset.state} />
            </div>
            <div className="workflow-modal-body">
              <div className="cycle-clean-summary">
                <div>
                  <span>{tr('Χειριστής')}</span>
                  <strong>{trData(currentUser.name)}</strong>
                </div>
                <div>
                  <span>{tr('Τμήμα')}</span>
                  <strong>{trData(cycleDraft.asset.department) || '—'}</strong>
                </div>
                <div>
                  <span>{cycleDraft.kind === 'SET' ? tr('Εργαλεία') : tr('Τύπος')}</span>
                  <strong>
                    {cycleDraft.kind === 'SET'
                      ? tools.filter(t => t.setId === cycleDraft.asset.id).length || cycleDraft.asset.actual || 0
                      : tr('Μεμονωμένο')}
                  </strong>
                </div>
                <div>
                  <span>{tr('Ώρα καταχώρησης')}</span>
                  <strong>{new Date().toLocaleString('el-GR', {dateStyle: 'short', timeStyle: 'short'})}</strong>
                </div>
              </div>
              <div className="cycle-clean-fields">
                <label>
                  {tr('Κλίβανος')}
                  <select value={sterilizer} onChange={e => setSterilizer(e.target.value)}>
                    <option>{tr('Κλίβανος 1')}</option>
                    <option>{tr('Κλίβανος 2')}</option>
                    <option>{tr('Κλίβανος 3')}</option>
                  </select>
                </label>
                <label>
                  {tr('Αριθμός κύκλου / φορτίου')}
                  <input
                    autoFocus
                    value={cycleNumber}
                    onChange={e => setCycleNumber(e.target.value)}
                    placeholder={tr('π.χ. 2026-0813-042')}
                  />
                </label>
                <label>
                  {tr('Πρόγραμμα')}
                  <select value={cycleProgram} onChange={e => setCycleProgram(e.target.value)}>
                    <option>134°C · 5 min</option>
                    <option>134°C · 18 min</option>
                    <option>121°C · 20 min</option>
                    <option>{tr('Άλλο πρόγραμμα')}</option>
                  </select>
                </label>
                <label>
                  {tr('Χημικός δείκτης')}
                  <select
                    value={indicatorResult}
                    onChange={e => setIndicatorResult(e.target.value as 'PASS' | 'FAIL' | 'NOT_RECORDED')}
                  >
                    <option value="PASS">{tr('Επιτυχής / OK')}</option>
                    <option value="FAIL">{tr('Αποτυχία')}</option>
                    <option value="NOT_RECORDED">{tr('Δεν καταγράφηκε')}</option>
                  </select>
                </label>
              </div>
              {indicatorResult === 'FAIL' ? (
                <div className="cycle-result-warning">
                  <TriangleAlert size={18} />
                  <div>
                    <strong>{tr('Ο κύκλος δεν αποδεσμεύεται')}</strong>
                    <span>{tr('Η εγγραφή παραμένει στην καρτέλα «Κλιβανισμός» για νέο κύκλο.')}</span>
                  </div>
                </div>
              ) : (
                <div className="cycle-result-ok">
                  <CheckCircle2 size={18} />
                  <div>
                    <strong>{tr('Ο κύκλος μπορεί να καταχωρηθεί')}</strong>
                    <span>{tr('Μετά την καταχώρηση η εγγραφή μεταφέρεται στην «Αποδέσμευση» για τελικό έλεγχο.')}</span>
                  </div>
                </div>
              )}
              <label className="cycle-note">
                {tr('Παρατήρηση')}
                <textarea
                  value={cycleNote}
                  onChange={e => setCycleNote(e.target.value)}
                  placeholder={tr('Προαιρετική παρατήρηση…')}
                />
              </label>
            </div>
            <div className="modal-actions workflow-modal-actions">
              <button onClick={closeCycleCompletion}>{tr('Ακύρωση')}</button>
              <button
                className={indicatorResult === 'FAIL' ? 'danger-action primary' : 'primary'}
                disabled={!cycleNumber.trim()}
                onClick={finishCycle}
              >
                {indicatorResult === 'FAIL' ? <TriangleAlert size={16} /> : <PackageCheck size={16} />}{' '}
                {indicatorResult === 'FAIL' ? tr('Καταχώρηση αποτυχίας') : tr('Ολοκλήρωση κύκλου')}
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
            <button className="modal-x" aria-label={tr('Κλείσιμο')} title={tr('Κλείσιμο')} onClick={closeRelease}>
              <X size={18} />
            </button>
            <div className="workflow-modal-head">
              <div className={`ster-kind ${releaseDraft.kind.toLowerCase()}`}>
                {releaseDraft.kind === 'SET' ? <Box size={20} /> : <Stethoscope size={20} />}
              </div>
              <div className="workflow-modal-title">
                <span className="eyebrow">{tr('QUALITY GATE · ΑΠΟΔΕΣΜΕΥΣΗ')}</span>
                <h2>
                  {releaseDraft.asset.barcode} · {releaseDraft.asset.name}
                </h2>
                <p>{tr('Τεκμηριωμένος τελικός έλεγχος πριν χαρακτηριστεί έτοιμο για παράδοση.')}</p>
              </div>
              <StatusBadge value={releaseDraft.asset.state} />
            </div>
            <div className="workflow-modal-body">
              {(() => {
                const cycle = latestPassedCycle(releaseDraft.asset.id);
                return cycle ? (
                  <div className="cycle-clean-summary">
                    <div>
                      <span>{tr('Κλίβανος')}</span>
                      <strong>{cycle.sterilizer}</strong>
                    </div>
                    <div>
                      <span>{tr('Κύκλος / φορτίο')}</span>
                      <strong>{cycle.cycleNumber}</strong>
                    </div>
                    <div>
                      <span>{tr('Πρόγραμμα')}</span>
                      <strong>{cycle.program}</strong>
                    </div>
                    <div>
                      <span>{tr('Ολοκληρώθηκε από')}</span>
                      <strong>{cycle.completedByName}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="cycle-result-warning">
                    <TriangleAlert size={18} />
                    <div>
                      <strong>{tr('Δεν βρέθηκε επιτυχής κύκλος')}</strong>
                      <span>{tr('Η αποδέσμευση δεν μπορεί να ολοκληρωθεί.')}</span>
                    </div>
                  </div>
                );
              })()}
              <section className="release-check-card">
                <div className="receipt-section-title">
                  <div>
                    <strong>{tr('Έλεγχοι αποδέσμευσης')}</strong>
                    <span>{tr('Οι κρίσιμοι έλεγχοι πρέπει να επιβεβαιωθούν πριν την αποδέσμευση.')}</span>
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
                    <strong>{tr('Παράμετροι κύκλου / φυσική καταγραφή')}</strong>
                    <small>{tr('Ελέγχθηκαν τα καταγεγραμμένα στοιχεία του κύκλου και είναι αποδεκτά.')}</small>
                  </span>
                </label>
                <label className="release-check-row">
                  <input
                    type="checkbox"
                    checked={releaseChecks.chemicalIndicatorOk}
                    onChange={e => setReleaseChecks(v => ({...v, chemicalIndicatorOk: e.target.checked}))}
                  />
                  <span>
                    <strong>{tr('Χημικός δείκτης αποδεκτός')}</strong>
                    <small>{tr('Το αποτέλεσμα συμφωνεί με τα κριτήρια της μονάδας.')}</small>
                  </span>
                </label>
                <label className="release-check-row">
                  <input
                    type="checkbox"
                    checked={releaseChecks.packagingIntegrityOk}
                    onChange={e => setReleaseChecks(v => ({...v, packagingIntegrityOk: e.target.checked}))}
                  />
                  <span>
                    <strong>{tr('Συσκευασία στεγνή και ακέραιη')}</strong>
                    <small>{tr('Δεν διαπιστώθηκε υγρασία, ρήξη ή άλλη απόκλιση του sterile barrier.')}</small>
                  </span>
                </label>
                <label className="release-biological">
                  {tr('Βιολογικός δείκτης')}
                  <select
                    value={biologicalIndicatorResult}
                    onChange={e =>
                      setBiologicalIndicatorResult(e.target.value as 'NOT_REQUIRED' | 'PASS' | 'PENDING' | 'FAIL')
                    }
                  >
                    <option value="NOT_REQUIRED">{tr('Δεν απαιτείται για τη συγκεκριμένη διαδικασία')}</option>
                    <option value="PASS">{tr('Αρνητικός / επιτυχής')}</option>
                    <option value="PENDING">{tr('Σε αναμονή αποτελέσματος')}</option>
                    <option value="FAIL">{tr('Θετικός / αποτυχία')}</option>
                  </select>
                </label>
              </section>
              {biologicalIndicatorResult === 'FAIL' ? (
                <div className="cycle-result-warning">
                  <TriangleAlert size={18} />
                  <div>
                    <strong>{tr('Δεν επιτρέπεται αποδέσμευση')}</strong>
                    <span>
                      {tr('Καταχώρησε επανεπεξεργασία και ακολούθησε τη διαδικασία διερεύνησης της μονάδας.')}
                    </span>
                  </div>
                </div>
              ) : releaseReady ? (
                <div className="cycle-result-ok">
                  <CheckCircle2 size={18} />
                  <div>
                    <strong>{tr('Έτοιμο για αποδέσμευση')}</strong>
                    <span>{tr('Οι απαιτούμενοι έλεγχοι έχουν επιβεβαιωθεί.')}</span>
                  </div>
                </div>
              ) : (
                <div className="release-pending">
                  <Clock3 size={18} />
                  <div>
                    <strong>{tr('Εκκρεμεί τελικός έλεγχος')}</strong>
                    <span>{tr('Η εγγραφή παραμένει σε αναμονή αποδέσμευσης.')}</span>
                  </div>
                </div>
              )}
              <label className="cycle-note">
                {tr('Παρατήρηση αποδέσμευσης')}
                <textarea
                  value={releaseNote}
                  onChange={e => setReleaseNote(e.target.value)}
                  placeholder={tr('Προαιρετική παρατήρηση ή αιτιολογία επανεπεξεργασίας…')}
                />
              </label>
            </div>
            <div className="modal-actions workflow-modal-actions release-actions">
              <button onClick={closeRelease}>{tr('Ακύρωση')}</button>
              <button className="release-reprocess" onClick={() => completeRelease('REPROCESS')}>
                <TriangleAlert size={16} /> {tr('Μη αποδέσμευση · Επανεπεξεργασία')}
              </button>
              <button
                className="primary"
                disabled={!releaseReady || !latestPassedCycle(releaseDraft.asset.id)}
                onClick={() => completeRelease('RELEASED')}
              >
                <ShieldCheck size={16} /> {tr('Αποδέσμευση προς παράδοση')}
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
            <button className="modal-x" aria-label={tr('Κλείσιμο')} title={tr('Κλείσιμο')} onClick={closeReceiptBatch}>
              <X size={18} />
            </button>
            <div className="workflow-modal-head">
              <div className="ster-kind set">
                <ScanBarcode size={20} />
              </div>
              <div className="workflow-modal-title">
                <span className="eyebrow">{tr('ΦΥΣΙΚΗ ΠΑΡΑΛΑΒΗ')}</span>
                <h2>{tr('Μαζική παραλαβή')}</h2>
                <p>
                  {tr('Ταυτοποίησε τον παραδίδοντα μία φορά και σκάναρε διαδοχικά τα αντικείμενα του ίδιου τμήματος.')}
                </p>
              </div>
              <div className="delivery-batch-count">
                <strong>{receiptBatchAssets.length}</strong>
                <span>{tr('αντικείμενα')}</span>
              </div>
            </div>
            <div className="delivery-batch-body">
              <BarcodeCapture
                title={tr('Προσθήκη στην παραλαβή')}
                subtitle={
                  receiptBatchDepartment
                    ? tr('Παραλαβή από {0}', receiptBatchDepartment)
                    : tr('Το πρώτο barcode ορίζει το τμήμα της παραλαβής.')
                }
                feedback={receiptBatchScanFeedback}
                onBarcode={addBarcodeToReceiptBatch}
              />
              <div className="delivery-batch-grid">
                <section className="delivery-batch-assets">
                  <div className="load-assets-head">
                    <div>
                      <strong>{tr('Αντικείμενα παραλαβής')}</strong>
                      <span>
                        {receiptBatchAssets.length} {tr('επιλεγμένα')}
                        {receiptBatchDepartment ? ` · ${receiptBatchDepartment}` : ''}
                      </span>
                    </div>
                    <small>{tr('Η λεπτομερής λειτουργική επιθεώρηση γίνεται αργότερα στο «Έλεγχος & Σύνθεση».')}</small>
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
                              {trData(item.department) || tr('Χωρίς τμήμα')} ·{' '}
                              {item.kind === 'SET' ? tr('Σετ') : tr('Μεμονωμένο εργαλείο')}
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
                                  <TriangleAlert size={13} /> {tr('Απόκλιση καταγράφηκε')}
                                </>
                              ) : (
                                <>
                                  <TriangleAlert size={13} /> {tr('Αναφορά απόκλισης')}
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
                        <span>{tr('Παραλαμβάνει')}</span>
                        <strong>{trData(currentUser.name)}</strong>
                        <small>{trData(currentUser.department)}</small>
                      </div>
                    </div>
                    <div className={`delivery-person ${receiptBatchIdentityValid ? 'confirmed' : ''}`}>
                      <IdCard size={19} />
                      <div>
                        <span>{tr('Παραδίδει')}</span>
                        <strong>
                          {receiptBatchIdentityValid ? receiptBatchDeliverer?.name : tr('Αναμονή ταυτοποίησης')}
                        </strong>
                        <small>{receiptBatchDepartment || tr('Σκάναρε πρώτα αντικείμενο')}</small>
                      </div>
                    </div>
                  </div>
                  <section className="delivery-auth">
                    <label>
                      {tr('Κωδικός παραδίδοντα')}
                      <div className="identity-input-row">
                        <input
                          disabled={!receiptBatchDepartment}
                          value={receiptBatchDelivererCode}
                          onChange={e => setReceiptBatchDelivererCode(e.target.value.toUpperCase())}
                          placeholder={
                            receiptBatchDepartment ? tr('Προσωπικός κωδικός') : tr('Πρώτα σκάναρε αντικείμενο')
                          }
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
                        <div className="identity-error">{tr('Ο κωδικός δεν αναγνωρίστηκε.')}</div>
                      ) : !receiptBatchDelivererMatches ? (
                        <div className="identity-mismatch-box">
                          <div className="identity-warning">
                            <TriangleAlert size={15} />
                            <span>
                              {tr('Ο χρήστης ανήκει στο') + ' '}
                              {trData(receiptBatchDeliverer.department)}
                              {tr(', ενώ η παραλαβή αφορά το')} {receiptBatchDepartment}.
                            </span>
                          </div>
                          {receiptPolicy.allowCrossDepartmentHandover ? (
                            <label>
                              {tr('Αιτιολόγηση εξαίρεσης')}
                              <textarea
                                value={receiptBatchMismatchReason}
                                onChange={e => setReceiptBatchMismatchReason(e.target.value)}
                                placeholder={tr('Υποχρεωτική αιτιολόγηση…')}
                              />
                            </label>
                          ) : (
                            <div className="identity-error">
                              {tr('Η πολιτική της μονάδας δεν επιτρέπει αυτή την εξαίρεση.')}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="identity-result">
                          <CheckCircle2 size={17} />
                          <div>
                            <strong>{receiptBatchDeliverer.name}</strong>
                            <span>
                              {receiptBatchDeliverer.role} · {trData(receiptBatchDeliverer.department)}
                            </span>
                          </div>
                        </div>
                      ))}
                  </section>
                  <label className="cycle-note">
                    {tr('Παρατήρηση παραλαβής')}
                    <textarea
                      value={receiptBatchNote}
                      onChange={e => setReceiptBatchNote(e.target.value)}
                      placeholder={tr('Προαιρετική κοινή παρατήρηση…')}
                    />
                  </label>
                  <div className="delivery-trace-note">
                    <ShieldCheck size={17} />
                    <span>
                      {tr(
                        'Με την ολοκλήρωση καταγράφονται κοινό batch ID, παραδίδων, παραλαμβάνων, τμήμα, χρόνος και η δήλωση εμφανής απόκλισης ανά barcode.',
                      )}
                    </span>
                  </div>
                </section>
              </div>
            </div>
            <div className="modal-actions workflow-modal-actions">
              <button onClick={closeReceiptBatch}>{tr('Ακύρωση')}</button>
              <button
                className="primary"
                disabled={!receiptBatchAssets.length || !receiptBatchIdentityValid}
                onClick={completeReceiptBatch}
              >
                <UserRoundCheck size={16} /> {tr('Ολοκλήρωση παραλαβής ·') + ' '}
                {receiptBatchAssets.length}
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
            <button className="modal-x" aria-label={tr('Κλείσιμο')} title={tr('Κλείσιμο')} onClick={closeDeliveryBatch}>
              <X size={18} />
            </button>
            <div className="workflow-modal-head">
              <div className="ster-kind set">
                <ScanBarcode size={20} />
              </div>
              <div className="workflow-modal-title">
                <span className="eyebrow">{tr('ΠΑΡΑΔΟΣΗ ΣΤΟ ΤΜΗΜΑ')}</span>
                <h2>{tr('Νέα παράδοση')}</h2>
                <p>
                  {tr(
                    'Πρόσθεσε τα αντικείμενα με barcode, scanner υπολογιστή ή χειροκίνητα από τη λίστα. Κάθε παράδοση αφορά ένα τμήμα.',
                  )}
                </p>
              </div>
              <div className="delivery-batch-count">
                <strong>{deliverySelectedAssets.length}</strong>
                <span>{tr('επιλεγμένα')}</span>
              </div>
            </div>
            <div className="delivery-batch-body">
              <BarcodeCapture
                title={tr('Προσθήκη στην παράδοση')}
                subtitle={
                  deliveryBatchDepartment
                    ? tr('Παράδοση προς {0}', deliveryBatchDepartment)
                    : tr('Το πρώτο barcode ορίζει το τμήμα της παράδοσης.')
                }
                feedback={deliveryScanFeedback}
                onBarcode={addBarcodeToDelivery}
              />
              <div className="delivery-batch-grid">
                <section className="delivery-batch-assets">
                  <div className="load-assets-head">
                    <div>
                      <strong>{tr('Αντικείμενα παράδοσης')}</strong>
                      <span>
                        {deliverySelectedAssets.length} {tr('επιλεγμένα')}
                        {deliveryBatchDepartment ? ` · ${deliveryBatchDepartment}` : ''}
                      </span>
                    </div>
                    <div className="delivery-list-actions">
                      {deliveryBatchDepartment && (
                        <button type="button" className="secondary compact" onClick={toggleAllDeliveryDepartment}>
                          {ready
                            .filter(item => item.department === deliveryBatchDepartment)
                            .every(item => deliverySelected.has(`${item.kind}:${item.id}`))
                            ? tr('Αποεπιλογή τμήματος')
                            : tr('Επιλογή όλων του τμήματος')}
                        </button>
                      )}
                      <small>
                        {deliveryBatchDepartment
                          ? tr('Μπορείς να επιλέξεις πολλά αντικείμενα του ίδιου τμήματος.')
                          : tr('Επίλεξε το πρώτο αντικείμενο για να οριστεί το τμήμα.')}
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
                          title={
                            incompatible ? tr('Η τρέχουσα παράδοση αφορά το {0}', deliveryBatchDepartment) : undefined
                          }
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
                              {trData(item.department)} ·{' '}
                              {lastLoad
                                ? `Load ${lastLoad.id} / ${lastLoad.cycleNumber}`
                                : tr('Αποδεσμευμένο μεμονωμένα')}
                              {incompatible ? tr(' · Άλλο τμήμα') : ''}
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
                        <span>{tr('Παραδίδει')}</span>
                        <strong>{trData(currentUser.name)}</strong>
                        <small>{trData(currentUser.department)}</small>
                      </div>
                    </div>
                    <div className={`delivery-person ${deliveryBatchReceiverMatches ? 'confirmed' : ''}`}>
                      <IdCard size={19} />
                      <div>
                        <span>{tr('Παραλαμβάνει')}</span>
                        <strong>
                          {deliveryBatchReceiverMatches ? deliveryBatchReceiver?.name : tr('Αναμονή ταυτοποίησης')}
                        </strong>
                        <small>{deliveryBatchDepartment || tr('Σκάναρε πρώτα αντικείμενο')}</small>
                      </div>
                    </div>
                  </div>
                  <section className="delivery-auth">
                    <label>
                      {tr('Κωδικός παραλαμβάνοντα')}
                      <div className="identity-input-row">
                        <input
                          disabled={!deliveryBatchDepartment}
                          value={deliveryBatchReceiverCode}
                          onChange={e => setDeliveryBatchReceiverCode(e.target.value.toUpperCase())}
                          placeholder={
                            deliveryBatchDepartment ? tr('Προσωπικός κωδικός') : tr('Πρώτα σκάναρε αντικείμενο')
                          }
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
                        Demo: {deliveryBatchDemoIdentity.code} · {trData(deliveryBatchDemoIdentity.department)}
                      </small>
                    )}
                    {deliveryBatchReceiverCode &&
                      (!deliveryBatchReceiver ? (
                        <div className="identity-error">{tr('Ο κωδικός δεν αναγνωρίστηκε.')}</div>
                      ) : !deliveryBatchReceiverMatches ? (
                        <div className="identity-error">
                          {tr('Ο χρήστης ανήκει στο') + ' '}
                          {trData(deliveryBatchReceiver.department)}
                          {tr(', ενώ η παράδοση αφορά το')} {deliveryBatchDepartment}.
                        </div>
                      ) : (
                        <div className="identity-result">
                          <CheckCircle2 size={17} />
                          <div>
                            <strong>{deliveryBatchReceiver.name}</strong>
                            <span>
                              {deliveryBatchReceiver.role} · {trData(deliveryBatchReceiver.department)}
                            </span>
                          </div>
                        </div>
                      ))}
                  </section>
                  <label className="cycle-note">
                    {tr('Παρατήρηση παράδοσης')}
                    <textarea
                      value={deliveryBatchNote}
                      onChange={e => setDeliveryBatchNote(e.target.value)}
                      placeholder={tr('Προαιρετική παρατήρηση για ολόκληρη την παράδοση…')}
                    />
                  </label>
                  <div className="delivery-trace-note">
                    <ShieldCheck size={17} />
                    <span>
                      {tr(
                        'Με την ολοκλήρωση καταγράφονται κοινό ID παράδοσης, χρήστης αποστείρωσης, παραλαμβάνων, τμήμα, ημερομηνία/ώρα και σύνδεση κάθε barcode με το ιστορικό κύκλου του.',
                      )}
                    </span>
                  </div>
                </section>
              </div>
            </div>
            <div className="modal-actions workflow-modal-actions">
              <button onClick={closeDeliveryBatch}>{tr('Ακύρωση')}</button>
              <button
                className="primary"
                disabled={!deliverySelectedAssets.length || !deliveryBatchReceiverMatches}
                onClick={completeDeliveryBatch}
              >
                <UserRoundCheck size={16} /> {tr('Ολοκλήρωση παράδοσης ·') + ' '}
                {deliverySelectedAssets.length}
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
            <button className="modal-x" aria-label={tr('Κλείσιμο')} title={tr('Κλείσιμο')} onClick={closeDelivery}>
              <X size={18} />
            </button>
            <div className="workflow-modal-head">
              <div className={`ster-kind ${deliveryDraft.kind.toLowerCase()}`}>
                {deliveryDraft.kind === 'SET' ? <Box size={20} /> : <Stethoscope size={20} />}
              </div>
              <div className="workflow-modal-title">
                <span className="eyebrow">{tr('ΠΑΡΑΔΟΣΗ ΣΤΟ ΤΜΗΜΑ')}</span>
                <h2>
                  {deliveryDraft.asset.barcode} · {deliveryDraft.asset.name}
                </h2>
                <p>
                  {tr('Κεντρική Αποστείρωση →') + ' '}
                  {trData(deliveryDraft.asset.department)}
                </p>
              </div>
              <StatusBadge value={deliveryDraft.asset.state} />
            </div>
            <div className="workflow-modal-body">
              <div className="delivery-pair">
                <div className="delivery-person confirmed">
                  <UserCheck size={19} />
                  <div>
                    <span>{tr('Παραδίδει')}</span>
                    <strong>{trData(currentUser.name)}</strong>
                    <small>{trData(currentUser.department)}</small>
                  </div>
                </div>
                <div className={`delivery-person ${receiver && receiverMatches ? 'confirmed' : ''}`}>
                  <IdCard size={19} />
                  <div>
                    <span>{tr('Παραλαμβάνει')}</span>
                    <strong>{receiver && receiverMatches ? receiver.name : tr('Αναμονή ταυτοποίησης')}</strong>
                    <small>{receiver && receiverMatches ? receiver.department : deliveryDraft.asset.department}</small>
                  </div>
                </div>
              </div>
              <section className="delivery-auth">
                <label>
                  {tr('Κωδικός παραλαμβάνοντα')}
                  <div className="identity-input-row">
                    <input
                      autoFocus
                      value={receiverCode}
                      onChange={e => setReceiverCode(e.target.value.toUpperCase())}
                      placeholder={tr('Προσωπικός κωδικός')}
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
                    Demo: {deliveryDemoIdentity.code} · {trData(deliveryDemoIdentity.department)}
                  </small>
                )}
                {receiverCode &&
                  (!receiver ? (
                    <div className="identity-error">{tr('Ο κωδικός δεν αναγνωρίστηκε.')}</div>
                  ) : !receiverMatches ? (
                    <div className="identity-error">
                      {tr('Ο χρήστης ανήκει στο') + ' '}
                      {trData(receiver.department)}
                      {tr(', ενώ η παράδοση αφορά το')} {trData(deliveryDraft.asset.department)}.
                    </div>
                  ) : (
                    <div className="identity-result">
                      <CheckCircle2 size={17} />
                      <div>
                        <strong>{receiver.name}</strong>
                        <span>
                          {receiver.role} · {trData(receiver.department)}
                        </span>
                      </div>
                    </div>
                  ))}
              </section>
              <label className="cycle-note">
                {tr('Παρατήρηση παράδοσης')}
                <textarea
                  value={deliveryNote}
                  onChange={e => setDeliveryNote(e.target.value)}
                  placeholder={tr('Προαιρετική παρατήρηση…')}
                />
              </label>
            </div>
            <div className="modal-actions workflow-modal-actions">
              <button onClick={closeDelivery}>{tr('Ακύρωση')}</button>
              <button className="primary" disabled={!receiver || !receiverMatches} onClick={completeDelivery}>
                <UserRoundCheck size={16} /> {tr('Ολοκλήρωση παράδοσης / παραλαβής')}
              </button>
            </div>
          </div>
        </div>
      )}

      {receiptView && !receiptDraft && !prepDraft && (
        <div className="modal-backdrop" onMouseDown={() => setReceiptView(null)}>
          <div className="receipt-card-modal completed" onMouseDown={e => e.stopPropagation()}>
            <button
              className="modal-x"
              aria-label={tr('Κλείσιμο')}
              title={tr('Κλείσιμο')}
              onClick={() => setReceiptView(null)}
            >
              <X size={18} />
            </button>
            <div className="receipt-complete-banner">
              <CheckCircle2 size={20} />
              <div>
                <strong>{tr('Η παραλαβή ολοκληρώθηκε')}</strong>
                <span>{tr('Η καρτέλα καταγράφηκε στο ιστορικό.')}</span>
              </div>
            </div>
            <div className="receipt-card-head">
              <div className={`ster-kind ${receiptView.assetKind.toLowerCase()}`}>
                {receiptView.assetKind === 'SET' ? <Box size={19} /> : <Stethoscope size={19} />}
              </div>
              <div>
                <span>
                  {tr('ΚΑΡΤΕΛΑ ΠΑΡΑΛΑΒΗΣ ·') + ' '}
                  {receiptView.id.toUpperCase()}
                </span>
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
                <span>{tr('Ημερομηνία / ώρα')}</span>
                <strong>{receiptView.at}</strong>
              </div>
              <div>
                <span>{tr('Παρέδωσε')}</span>
                <strong>{receiptView.deliveredByName}</strong>
                <small>{receiptView.deliveredByDepartment}</small>
              </div>
              <div>
                <span>{tr('Παρέλαβε')}</span>
                <strong>{receiptView.receivedByName}</strong>
                <small>{receiptView.receivedByDepartment}</small>
              </div>
              {receiptView.assetKind === 'SET' && (
                <div>
                  <span>{tr('Σύνθεση κατά την παραλαβή')}</span>
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
                  <strong>{tr('Καταμέτρηση κατά την παραλαβή')}</strong>
                </div>
                <span>
                  {receiptView.assetKind === 'SET'
                    ? tr('Παραλήφθηκαν {0} από {1}. ', receiptView.checkedCount, receiptView.expected)
                    : ''}
                  {receiptView.checkResult === 'MISSING'
                    ? tr('Καταγράφηκε διαφορά ποσότητας.')
                    : tr('Η ποσότητα συμφωνεί.')}
                </span>
              </div>
            )}
            {
              <div className="receipt-check-read">
                <div>
                  {receiptView.visibleDeviation ? <TriangleAlert size={17} /> : <CheckCircle2 size={17} />}
                  <strong>{tr('Εμφανής κατάσταση κατά την παραλαβή')}</strong>
                </div>
                <span>
                  {receiptView.visibleDeviation
                    ? tr('Δηλώθηκε εμφανής απόκλιση κατά τη φυσική παραλαβή.')
                    : tr('Δεν δηλώθηκε εμφανής απόκλιση κατά τη φυσική παραλαβή.')}
                </span>
                {receiptView.departmentMismatch && (
                  <p>
                    {tr('Παράδοση από διαφορετικό τμήμα:') + ' '}
                    {receiptView.departmentMismatchReason || tr('Καταγεγραμμένη εξαίρεση')}
                  </p>
                )}
              </div>
            }
            {receiptView.note && (
              <div className="receipt-note-read">
                <span>{tr('Παρατήρηση')}</span>
                <p>{receiptView.note}</p>
              </div>
            )}
            <div className="modal-actions">
              <button className="primary" onClick={() => setReceiptView(null)}>
                {tr('Κλείσιμο')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
