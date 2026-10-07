import type {Permission} from '../core/permissions';
import type {
  AssetKind,
  AssetState,
  BinEntry,
  AssetPhoto,
  DeliveryRecord,
  Issue,
  Movement,
  PreparationRecord,
  ProcessLoadRecord,
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderStatus,
  RecallCase,
  ReceiptRecord,
  SetAsset,
  SterilizationCycleRecord,
  SterilizationIndicatorResult,
  SterilizationReleaseRecord,
  BiologicalIndicatorResult,
  Tool,
  WorkflowCheckpointRecord,
} from '../types/domain';

export type SurgicalCount = {
  id: string;
  /** The Set counted (or the standalone instrument, with assetKind TOOL). */
  setId: string;
  assetKind?: 'SET' | 'TOOL';
  /** Instruments ticked as present, and the barcodes of those missing. */
  checkedToolIds?: string[];
  missing?: string[];
  /** Ticked one by one, or all at once ("All present"). */
  mode?: 'ITEM' | 'BULK';
  /** The sterile dates the Set carried when it was counted (they are cleared once it is sent). */
  sterilizedOn?: string;
  sterilizedTime?: string;
  sterileUntil?: string;
  patientCode: string;
  expected: number;
  counted: number;
  result: 'OK' | 'MISSING' | 'DAMAGE';
  note: string;
  at: string;
  by: string;
  signed: boolean;
};

/** VIEWER: read-only (e.g. Nursing Directorate, Operations): sees the hospital, changes nothing. */
export type UserRole = 'DEPARTMENT' | 'STERILIZATION' | 'ADMIN' | 'VIEWER';

export type Toast = {
  id: number;
  text: string;
  /** Takes the action back (offered for a few seconds after a management action). */
  undo?: () => void;
};

export type SessionUser = {
  id: string;
  name: string;
  role: UserRole;
  department: string;
  /** Sterilization supervisor, named by the hospital admin. */
  supervisor?: boolean;
  /** An admin working as another role or department of their hospital. */
  viewAs?: boolean;
};

export type ReceivePayload = {
  batchId?: string;
  deliveredByUserId: string;
  deliveredByName: string;
  deliveredByDepartment: string;
  note?: string;
  visibleDeviation?: boolean;
  departmentMismatch?: boolean;
  departmentMismatchReason?: string;
  checkPerformed?: boolean;
  checkedCount?: number;
  checkResult?: 'OK' | 'MISSING' | 'DAMAGE' | 'OTHER';
  checkNote?: string;
  itemChecks?: Array<{toolId: string; barcode: string; status: 'OK' | 'PROBLEM'}>;
  setChecks?: {containerOk: boolean; compositionOk: boolean; visualOk: boolean};
};

export type PreparationPayload = {
  toolIds: string[];
  checkedToolIds: string[];
  allOk: boolean;
  processChecks?: {
    cleanDry: boolean;
    functionIntegrity: boolean;
    assembly: boolean;
    packaging: boolean;
    labelIndicator: boolean;
  };
  /** Sterile shelf life chosen when packaging is part of this step (2, 3 or 6 months). */
  shelfLifeMonths?: number;
  note?: string;
};

export type SterilizationCompletionPayload = {
  loadId?: string;
  sterilizer: string;
  cycleNumber: string;
  program: string;
  indicatorResult: SterilizationIndicatorResult;
  note?: string;
};

export type SterilizationReleasePayload = {
  loadId?: string;
  cycleRecordId: string;
  physicalParametersOk: boolean;
  chemicalIndicatorOk: boolean;
  packagingIntegrityOk: boolean;
  biologicalIndicatorResult: BiologicalIndicatorResult;
  decision: 'RELEASED' | 'REPROCESS';
  note?: string;
};

export type CreateProcessLoadPayload = {
  kind: 'WASHING' | 'STERILIZATION';
  assetRefs: Array<{kind: AssetKind; id: string}>;
  equipment: string;
  cycleNumber: string;
  program: string;
  /** Set when the chemical indicator is part of the load; its result is recorded at release. */
  chemicalIndicatorResult?: SterilizationIndicatorResult;
  /** The cycle already ended (taken from a connected device): the load goes straight to release. */
  cycleCompleted?: boolean;
  /** 'PENDING' when a biological indicator is part of the load; its result is recorded at release. */
  biologicalIndicatorResult?: BiologicalIndicatorResult;
  note?: string;
};
export type ReleaseProcessLoadPayload = {
  physicalParametersOk: boolean;
  chemicalIndicatorOk: boolean;
  /** The chemical indicator as recorded at release; when absent, `chemicalIndicatorOk` decides (pass / not recorded). */
  chemicalIndicatorResult?: SterilizationIndicatorResult;
  packagingIntegrityOk: boolean;
  biologicalIndicatorResult: BiologicalIndicatorResult;
  decision: 'RELEASED' | 'REPROCESS';
  note?: string;
};

export type WorkflowCheckpointPayload = {
  stageId: 'WASHING' | 'PACKAGING' | 'STORAGE';
  checks: boolean[];
  /** At Packaging & Labelling: the sterile shelf life (2, 3 or 6 months). */
  shelfLifeMonths?: number;
  note?: string;
};

export type DeliveryPayload = {
  batchId?: string;
  receivedByUserId: string;
  receivedByName: string;
  receivedByDepartment: string;
  note?: string;
};

export type LifecycleAlert = {
  id: string;
  assetId: string;
  assetKind: AssetKind;
  barcode: string;
  name: string;
  remaining: number;
  maxUses: number;
};

export type CreateToolPayload = {
  name: string;
  code: string;
  department: string;
  specialty: string;
  manufacturer?: string;
  quantity: number;
  maxUses?: number;
  notes?: string;
  serialNumber?: string;
};

export type CreateSetPayload = {
  name: string;
  code: string;
  department: string;
  specialty: string;
  manufacturer?: string;
  toolIds: string[];
  maxUses?: number;
  notes?: string;
};

export type SetUpdatePatch = Partial<
  Pick<
    SetAsset,
    | 'name'
    | 'code'
    | 'barcode'
    | 'department'
    | 'specialty'
    | 'manufacturer'
    | 'state'
    | 'category'
    | 'notes'
    | 'maxUses'
    | 'ownership'
    | 'ownerName'
  >
>;

export type ToolUpdatePatch = Partial<
  Pick<
    Tool,
    | 'name'
    | 'code'
    | 'barcode'
    | 'department'
    | 'specialty'
    | 'manufacturer'
    | 'state'
    | 'notes'
    | 'serialNumber'
    | 'purchaseDate'
    | 'warrantyUntil'
    | 'cost'
    | 'maxUses'
    | 'ownership'
    | 'ownerName'
  >
>;

export type SurgiStoreValue = {
  /** The hospital whose data is open (cloud workspaces only). */
  organizationId?: string;
  organizationName?: string;
  sets: SetAsset[];
  tools: Tool[];
  /** Tools taken out of circulation, kept only as history. */
  retiredTools: Tool[];
  movements: Movement[];
  issues: Issue[];
  counts: SurgicalCount[];
  receipts: ReceiptRecord[];
  preparations: PreparationRecord[];
  sterilizationCycles: SterilizationCycleRecord[];
  processLoads: ProcessLoadRecord[];
  recallCases: RecallCase[];
  sterilizationReleases: SterilizationReleaseRecord[];
  workflowCheckpoints: WorkflowCheckpointRecord[];
  deliveries: DeliveryRecord[];
  purchaseOrders: PurchaseOrder[];
  recycleBin: BinEntry[];
  restoreFromBin: (id: string) => boolean;
  addToBin: (entry: BinEntry) => void;
  removeFromBin: (id: string) => void;
  purgeFromBin: (id: string) => void;
  purgeExpiredBin: () => number;
  replaceFromStock: (pairs: Array<{toolId: string; stockToolId: string; setId: string}>) => void;
  receivePurchaseOrder: (id: string, quantities?: number[]) => void;
  createPurchaseOrder: (lines: PurchaseOrderLine[], details?: {supplier?: string; note?: string}) => string;
  setPurchaseOrderStatus: (id: string, status: PurchaseOrderStatus) => void;
  lifecycleAlerts: LifecycleAlert[];
  toast?: Toast;
  role: UserRole;
  activeDepartment: string;
  currentUser: SessionUser;
  permissions: readonly Permission[];
  can: (permission: Permission) => boolean;
  setRole: (role: UserRole) => void;
  /** Demo only: work as another identity (role and department). */
  switchIdentity: (user: SessionUser) => void;
  sendToSterilization: (kind: AssetKind, id: string, patientCode?: string, note?: string) => void;
  receiveAtSterilization: (kind: AssetKind, id: string, payload: ReceivePayload) => ReceiptRecord | undefined;
  recordPreparation: (kind: AssetKind, id: string, payload: PreparationPayload) => PreparationRecord | undefined;
  completeSterilizationCycle: (
    kind: AssetKind,
    id: string,
    payload: SterilizationCompletionPayload,
  ) => SterilizationCycleRecord | undefined;
  createProcessLoad: (payload: CreateProcessLoadPayload) => ProcessLoadRecord | undefined;
  releaseProcessLoad: (loadId: string, payload: ReleaseProcessLoadPayload) => ProcessLoadRecord | undefined;
  /** End of cycle for a load in the sterilizer: on to release, or the whole load back to reprocessing. */
  finishProcessLoad: (loadId: string, result: 'PASSED' | 'FAILED', note?: string) => ProcessLoadRecord | undefined;
  recallProcessLoad: (loadId: string, reason: string) => void;
  /** The biological indicator of a load released while pending: a failure recalls the whole load. */
  recordBiologicalResult: (loadId: string, result: 'PASS' | 'FAIL') => void;
  /** Moves what is in a stage being turned off on to the next stage the hospital runs; returns how many. */
  advanceStageItems: (fromState: AssetState, toState: AssetState, stageLabel: string) => number;
  releaseSterilization: (
    kind: AssetKind,
    id: string,
    payload: SterilizationReleasePayload,
  ) => SterilizationReleaseRecord | undefined;
  completeWorkflowCheckpoint: (
    kind: AssetKind,
    id: string,
    payload: WorkflowCheckpointPayload,
  ) => WorkflowCheckpointRecord | undefined;
  completeDeliveryToDepartment: (kind: AssetKind, id: string, payload: DeliveryPayload) => DeliveryRecord | undefined;
  configureUsageLimit: (kind: AssetKind, id: string, maxUses?: number) => void;
  recordCount: (payload: Omit<SurgicalCount, 'id' | 'at' | 'by' | 'signed'>) => void;
  moveTool: (
    toolId: string,
    destination: 'STOCK' | 'SET' | 'SERVICE' | 'REMOVE',
    setId?: string,
    note?: string,
  ) => void;
  replaceToolInSet: (
    setId: string,
    outgoingToolId: string,
    replacementToolId: string,
    outgoingDestination: 'STOCK' | 'SERVICE' | 'SET',
    outgoingSetId?: string,
  ) => void;
  reportIssue: (toolId: string, type: string, note: string, source?: string, photos?: AssetPhoto[]) => void;
  resolveIssues: (issueIds: string[], resolutionNote?: string) => void;
  addAssetPhotos: (kind: AssetKind, id: string, photos: AssetPhoto[]) => void;
  removeAssetPhoto: (kind: AssetKind, id: string, photoId: string) => void;
  nextBarcode: (kind: AssetKind) => string;
  createTool: (payload: CreateToolPayload) => string[];
  createSet: (payload: CreateSetPayload) => string;
  reissueBarcode: (kind: AssetKind, id: string, reason?: string) => string;
  duplicateSet: (id: string, withTools?: boolean) => void;
  duplicateTool: (id: string) => string | undefined;
  deleteSet: (id: string, deleteTools?: boolean) => void;
  deleteTool: (id: string) => void;
  acknowledgeOutOfUse: (id: string) => void;
  reportSetIssue: (
    setId: string,
    targetToolIds: string[],
    type: string,
    note: string,
    photos?: AssetPhoto[],
    source?: string,
  ) => void;
  retireAsset: (kind: AssetKind, id: string) => void;
  setColorMarker: (
    kind: AssetKind,
    id: string,
    value: {mode?: 'SET' | 'OWN' | 'NONE'; tapes: string[]},
    description: string,
  ) => void;
  applyColorPlan: (plan: import('../core/colorTapes').ColorPlan, setBarcode: string) => void;
  markLost: (kind: AssetKind, id: string, note?: string) => void;
  returnToService: (kind: AssetKind, id: string, note?: string) => void;
  sendSetToService: (id: string, note?: string) => void;
  /** Gives a Set (and its instruments) or a standalone / stock instrument to a department. */
  assignDepartment: (kind: AssetKind, id: string, department: string, note?: string) => void;
  /**
   * Runs a management action and offers to take it back for a few seconds. Undoing restores the
   * Sets, instruments and problem reports as they were; the history keeps both entries.
   */
  undoable: (label: string, run: () => void) => void;
  updateSet: (id: string, patch: SetUpdatePatch) => void;
  updateTool: (id: string, patch: ToolUpdatePatch) => void;
  /** Renames many instruments at once (the name check), with one history entry and an undo. */
  renameTools: (changes: Array<{id: string; name: string}>, label: string) => void;
  /** Set compositions take the names their instruments now carry. */
  syncCompositionNames: () => void;
  addToolsToSet: (setId: string, toolIds: string[]) => void;
  clearToast: () => void;
};
