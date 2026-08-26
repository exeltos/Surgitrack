export type AssetKind = 'SET' | 'TOOL';
export type AssetState =
  | 'IN_DEPARTMENT'
  | 'PENDING_STERILIZATION'
  | 'IN_WASHING'
  | 'IN_PREPARATION'
  | 'IN_PACKAGING'
  | 'IN_STERILIZATION'
  | 'AWAITING_RELEASE'
  | 'IN_STORAGE'
  | 'READY_FOR_PICKUP'
  | 'IN_STOCK'
  | 'SERVICE'
  | 'LOST';
export type ToolMode = 'STANDALONE' | 'SET_MEMBER' | 'STOCK';
export interface AssetPhoto {
  id: string;
  name: string;
  dataUrl: string;
  createdAt: string;
}
export interface Tool {
  id: string;
  barcode: string;
  legacyBarcodes?: string[];
  code: string;
  name: string;
  department?: string;
  specialty: string;
  manufacturer?: string;
  mode: ToolMode;
  setId?: string;
  state: AssetState;
  maxUses?: number;
  uses: number;
  sterilizations: number;
  serialNumber?: string;
  purchaseDate?: string;
  warrantyUntil?: string;
  cost?: number;
  notes?: string;
  imageUrl?: string;
  photos?: AssetPhoto[];
}
export interface SetCompositionRequirement {
  code: string;
  name: string;
  quantity: number;
}
export interface SetAsset {
  id: string;
  barcode: string;
  legacyBarcodes?: string[];
  code: string;
  name: string;
  department: string;
  specialty: string;
  manufacturer?: string;
  compositionTemplate?: SetCompositionRequirement[];
  state: AssetState;
  expected: number;
  actual: number;
  patientCode?: string;
  category?: string;
  createdAt?: string;
  notes?: string;
  uses?: number;
  maxUses?: number;
  photos?: AssetPhoto[];
}
export type Asset = SetAsset | Tool;
export interface Movement {
  id: string;
  asset: string;
  assetKind: AssetKind;
  from: string;
  to: string;
  status: string;
  at: string;
  by: string;
  patientCode?: string;
  note?: string;
}
export interface Issue {
  id: string;
  asset: string;
  type: string;
  status: 'OPEN' | 'RESOLVED';
  created: string;
  department: string;
  note: string;
  photos?: AssetPhoto[];
}
export type ReceiptCheckResult = 'OK' | 'MISSING' | 'DAMAGE' | 'OTHER';
export type ReceiptItemCheckStatus = 'OK' | 'PROBLEM';
export interface ReceiptItemCheck {
  toolId: string;
  barcode: string;
  status: ReceiptItemCheckStatus;
}
export interface ReceiptSetChecks {
  containerOk: boolean;
  compositionOk: boolean;
  visualOk: boolean;
}
export interface PreparationProcessChecks {
  cleanDry: boolean;
  functionIntegrity: boolean;
  assembly: boolean;
  packaging: boolean;
  labelIndicator: boolean;
}
export interface PreparationRecord {
  id: string;
  assetId: string;
  assetKind: AssetKind;
  barcode: string;
  assetName: string;
  department: string;
  preparedByUserId: string;
  preparedByName: string;
  preparedByDepartment: string;
  at: string;
  toolIds: string[];
  checkedToolIds: string[];
  allOk: boolean;
  processChecks?: PreparationProcessChecks;
  note?: string;
}
export type SterilizationCycleResult = 'PASSED' | 'FAILED';
export type SterilizationIndicatorResult = 'PASS' | 'FAIL' | 'NOT_RECORDED';
export interface SterilizationCycleRecord {
  id: string;
  loadId?: string;
  assetId: string;
  assetKind: AssetKind;
  barcode: string;
  assetName: string;
  department: string;
  sterilizer: string;
  cycleNumber: string;
  program: string;
  indicatorResult: SterilizationIndicatorResult;
  result: SterilizationCycleResult;
  note?: string;
  completedByUserId: string;
  completedByName: string;
  completedByDepartment: string;
  completedAt: string;
  toolIds: string[];
}
export type SterilizationReleaseDecision = 'RELEASED' | 'REPROCESS';
export type BiologicalIndicatorResult = 'NOT_REQUIRED' | 'PASS' | 'PENDING' | 'FAIL';
export interface SterilizationReleaseRecord {
  id: string;
  loadId?: string;
  assetId: string;
  assetKind: AssetKind;
  barcode: string;
  assetName: string;
  department: string;
  cycleRecordId: string;
  cycleNumber: string;
  sterilizer: string;
  physicalParametersOk: boolean;
  chemicalIndicatorOk: boolean;
  packagingIntegrityOk: boolean;
  biologicalIndicatorResult: BiologicalIndicatorResult;
  decision: SterilizationReleaseDecision;
  note?: string;
  releasedByUserId: string;
  releasedByName: string;
  releasedByDepartment: string;
  releasedAt: string;
}
export type ProcessLoadKind = 'WASHING' | 'STERILIZATION';
export type ProcessLoadStatus =
  'OPEN' | 'PASSED' | 'FAILED' | 'AWAITING_RELEASE' | 'RELEASED' | 'REPROCESS' | 'RECALLED';
export interface ProcessLoadItem {
  assetId: string;
  assetKind: AssetKind;
  barcode: string;
  assetName: string;
  department: string;
}
export interface ProcessLoadRecord {
  id: string;
  kind: ProcessLoadKind;
  equipment: string;
  cycleNumber: string;
  program: string;
  status: ProcessLoadStatus;
  items: ProcessLoadItem[];
  chemicalIndicatorResult?: SterilizationIndicatorResult;
  biologicalIndicatorResult?: BiologicalIndicatorResult;
  physicalParametersOk?: boolean;
  packagingIntegrityOk?: boolean;
  note?: string;
  createdByUserId: string;
  createdByName: string;
  createdAt: string;
  completedAt?: string;
  releasedAt?: string;
  recalledAt?: string;
  recallReason?: string;
}
export interface ReceiptRecord {
  id: string;
  batchId?: string;
  assetId: string;
  assetKind: AssetKind;
  barcode: string;
  assetName: string;
  fromDepartment: string;
  toDepartment: string;
  deliveredByUserId: string;
  deliveredByName: string;
  deliveredByDepartment: string;
  receivedByUserId: string;
  receivedByName: string;
  receivedByDepartment: string;
  at: string;
  note?: string;
  visibleDeviation?: boolean;
  departmentMismatch?: boolean;
  departmentMismatchReason?: string;
  expected?: number;
  actual?: number;
  checkPerformed?: boolean;
  checkedCount?: number;
  checkResult?: ReceiptCheckResult;
  checkNote?: string;
  itemChecks?: ReceiptItemCheck[];
  setChecks?: ReceiptSetChecks;
}
export interface DeliveryRecord {
  id: string;
  batchId?: string;
  assetId: string;
  assetKind: AssetKind;
  barcode: string;
  assetName: string;
  department: string;
  deliveredByUserId: string;
  deliveredByName: string;
  deliveredByDepartment: string;
  receivedByUserId: string;
  receivedByName: string;
  receivedByDepartment: string;
  at: string;
  note?: string;
}

export interface WorkflowCheckpointRecord {
  id: string;
  assetId: string;
  assetKind: AssetKind;
  barcode: string;
  assetName: string;
  department: string;
  stageId: 'WASHING' | 'PACKAGING' | 'STORAGE';
  checks: boolean[];
  note?: string;
  completedByUserId: string;
  completedByName: string;
  completedByDepartment: string;
  completedAt: string;
}
