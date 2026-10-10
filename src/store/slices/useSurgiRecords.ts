import {useState} from 'react';
import type {
  BinEntry,
  DeliveryRecord,
  PurchaseOrder,
  PreparationRecord,
  ReceiptRecord,
  SterilizationCycleRecord,
  SterilizationReleaseRecord,
  WorkflowCheckpointRecord,
  ProcessLoadRecord,
  RecallCase,
} from '../../types/domain';
import {useAppRecordSync} from '../../data/cloud/useAppRecordSync';
import {mergeRemote} from '../../data/cloud/remoteChanges';
import type {CloudRecord} from '../../data/cloud/appRecords';
import type {SurgicalCount} from '../types';
import type {useSurgiSession} from './useSurgiSession';

export function useSurgiRecords(p: ReturnType<typeof useSurgiSession>) {
  const {cloud, initialData} = p;

  const [sets, setSets] = useState(initialData.sets);
  const [tools, setTools] = useState(() => {
    const departmentOfSet = new Map(initialData.sets.map(set => [set.id, set.department]));
    return initialData.tools.map(tool =>
      tool.state === 'RETIRED'
        ? tool
        : tool.mode === 'STOCK'
          ? {...tool, department: undefined, state: 'IN_STOCK' as const}
          : tool.mode === 'SET_MEMBER'
            ? {...tool, department: (tool.setId && departmentOfSet.get(tool.setId)) || tool.department}
            : tool,
    );
  });
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
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(initialData.purchaseOrders || []);
  const [recycleBin, setRecycleBin] = useState<BinEntry[]>(initialData.recycleBin || []);
  const cloudOrganizationId = cloud?.organizationId;
  // What other devices saved goes into the same lists (see useAppRecordSync).
  const merged =
    <T extends {id: string}>(set: (update: (list: T[]) => T[]) => void) =>
    (remote: CloudRecord[], removed: string[], append?: boolean) =>
      set(list => mergeRemote(list, remote as unknown as T[], removed, append));
  useAppRecordSync(cloudOrganizationId, 'sets', sets, merged(setSets));
  useAppRecordSync(cloudOrganizationId, 'tools', tools, merged(setTools));
  useAppRecordSync(cloudOrganizationId, 'movements', movements, merged(setMovements));
  useAppRecordSync(cloudOrganizationId, 'issues', issues, merged(setIssues));
  useAppRecordSync(cloudOrganizationId, 'counts', counts, merged(setCounts));
  useAppRecordSync(cloudOrganizationId, 'receipts', receipts, merged(setReceipts));
  useAppRecordSync(cloudOrganizationId, 'preparations', preparations, merged(setPreparations));
  useAppRecordSync(cloudOrganizationId, 'sterilizationCycles', sterilizationCycles, merged(setSterilizationCycles));
  useAppRecordSync(cloudOrganizationId, 'processLoads', processLoads, merged(setProcessLoads));
  useAppRecordSync(cloudOrganizationId, 'recallCases', recallCases, merged(setRecallCases));
  useAppRecordSync(
    cloudOrganizationId,
    'sterilizationReleases',
    sterilizationReleases,
    merged(setSterilizationReleases),
  );
  useAppRecordSync(cloudOrganizationId, 'workflowCheckpoints', workflowCheckpoints, merged(setWorkflowCheckpoints));
  useAppRecordSync(cloudOrganizationId, 'deliveries', deliveries, merged(setDeliveries));
  useAppRecordSync(cloudOrganizationId, 'purchaseOrders', purchaseOrders, merged(setPurchaseOrders));
  useAppRecordSync(cloudOrganizationId, 'recycleBin', recycleBin, merged(setRecycleBin));
  return {
    cloudOrganizationId,
    counts,
    deliveries,
    issues,
    movements,
    preparations,
    processLoads,
    purchaseOrders,
    recallCases,
    recycleBin,
    receipts,
    setCounts,
    setDeliveries,
    setIssues,
    setMovements,
    setPreparations,
    setProcessLoads,
    setPurchaseOrders,
    setRecycleBin,
    setRecallCases,
    setReceipts,
    setSets,
    setSterilizationCycles,
    setSterilizationReleases,
    setTools,
    setWorkflowCheckpoints,
    sets,
    sterilizationCycles,
    sterilizationReleases,
    tools,
    workflowCheckpoints,
  };
}
