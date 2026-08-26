import type {Permission} from '../core/permissions';
import type {
  AssetKind,
  AssetPhoto,
  DeliveryRecord,
  Issue,
  Movement,
  PreparationRecord,
  ProcessLoadRecord,
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
  setId: string;
  patientCode: string;
  expected: number;
  counted: number;
  result: 'OK' | 'MISSING' | 'DAMAGE';
  note: string;
  at: string;
  by: string;
  signed: boolean;
};

export type UserRole = 'DEPARTMENT' | 'STERILIZATION' | 'ADMIN';

export type Toast = {
  id: number;
  text: string;
};

export type SessionUser = {
  id: string;
  name: string;
  role: UserRole;
  department: string;
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
  chemicalIndicatorResult?: SterilizationIndicatorResult;
  note?: string;
};
export type ReleaseProcessLoadPayload = {
  physicalParametersOk: boolean;
  chemicalIndicatorOk: boolean;
  packagingIntegrityOk: boolean;
  biologicalIndicatorResult: BiologicalIndicatorResult;
  decision: 'RELEASED' | 'REPROCESS';
  note?: string;
};

export type WorkflowCheckpointPayload = {
  stageId: 'WASHING' | 'PACKAGING' | 'STORAGE';
  checks: boolean[];
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
  >
>;

export type SurgiStoreValue = {
  sets: SetAsset[];
  tools: Tool[];
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
  lifecycleAlerts: LifecycleAlert[];
  toast?: Toast;
  role: UserRole;
  activeDepartment: string;
  currentUser: SessionUser;
  permissions: readonly Permission[];
  can: (permission: Permission) => boolean;
  setRole: (role: UserRole) => void;
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
  recallProcessLoad: (loadId: string, reason: string) => void;
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
  moveTool: (toolId: string, destination: 'STOCK' | 'SET' | 'SERVICE' | 'REMOVE', setId?: string) => void;
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
  reissueBarcode: (kind: AssetKind, id: string, reason?: string) => void;
  duplicateSet: (id: string, withTools?: boolean) => void;
  duplicateTool: (id: string) => string | undefined;
  deleteSet: (id: string, deleteTools?: boolean) => void;
  deleteTool: (id: string) => void;
  reportSetIssue: (
    setId: string,
    targetToolIds: string[],
    type: string,
    note: string,
    photos?: AssetPhoto[],
    source?: string,
  ) => void;
  retireAsset: (kind: AssetKind, id: string) => void;
  updateSet: (id: string, patch: SetUpdatePatch) => void;
  updateTool: (id: string, patch: ToolUpdatePatch) => void;
  addToolsToSet: (setId: string, toolIds: string[]) => void;
  clearToast: () => void;
};
