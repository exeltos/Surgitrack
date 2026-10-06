import type {
  BinEntry,
  DeliveryRecord,
  Issue,
  Movement,
  PreparationRecord,
  ProcessLoadRecord,
  PurchaseOrder,
  RecallCase,
  ReceiptRecord,
  SetAsset,
  SterilizationCycleRecord,
  SterilizationReleaseRecord,
  Tool,
  WorkflowCheckpointRecord,
} from '../../types/domain';
import type {SurgicalCount} from '../../store/types';

export type SurgiDataMode = 'DEMO' | 'PRODUCTION';

export type SurgiInitialData = {
  sets: SetAsset[];
  tools: Tool[];
  movements: Movement[];
  issues: Issue[];
  // Workflow history; only present when loaded from a cloud workspace.
  counts?: SurgicalCount[];
  receipts?: ReceiptRecord[];
  preparations?: PreparationRecord[];
  sterilizationCycles?: SterilizationCycleRecord[];
  processLoads?: ProcessLoadRecord[];
  recallCases?: RecallCase[];
  sterilizationReleases?: SterilizationReleaseRecord[];
  workflowCheckpoints?: WorkflowCheckpointRecord[];
  deliveries?: DeliveryRecord[];
  purchaseOrders?: PurchaseOrder[];
  recycleBin?: BinEntry[];
};

/**
 * Boundary between the application state and its backing data source.
 * The current web demo is in-memory; a future Supabase/API repository can
 * implement the same contract without pages importing seed data directly.
 */
export interface SurgiRepository {
  readonly mode: SurgiDataMode;
  getInitialData(): SurgiInitialData;
}
