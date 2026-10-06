import {useState} from 'react';
import type {
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
import type {SurgicalCount} from '../types';
import type {useSurgiSession} from './useSurgiSession';

export function useSurgiRecords(p: ReturnType<typeof useSurgiSession>) {
  const {cloud, initialData} = p;

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
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(initialData.purchaseOrders || []);
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
  useAppRecordSync(cloudOrganizationId, 'purchaseOrders', purchaseOrders);
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
    receipts,
    setCounts,
    setDeliveries,
    setIssues,
    setMovements,
    setPreparations,
    setProcessLoads,
    setPurchaseOrders,
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
