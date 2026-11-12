import {createContext, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {type SurgiDataMode} from '../data/repositories';
import type {CloudWorkspace} from '../data/cloud/CloudWorkspaceGate';
import type {SurgiStoreValue} from './types';
import {useSurgiStore} from './slices/useSurgiStore';
import {useLibraries} from '../core/LibraryStore';
import {cancelledRecordIds} from '../core/movementUndo';
import {createHolder, publish, useTrackedValue, type StoreHolder} from './trackedStore';

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
// The context carries a holder that never changes: a component is redrawn only when a value it read changes
// (see trackedStore), not on every change of the store.
const Ctx = createContext<StoreHolder<SurgiStoreValue> | null>(null);
// eslint-disable-next-line react-refresh/only-export-components
export const useSurgi = () => {
  const holder = useContext(Ctx);
  if (!holder) throw new Error('useSurgi outside provider');
  return useTrackedValue(holder);
};
/**
 * The list as `list`, but the same array as last time when it holds the same records: a list filtered again
 * after an unrelated change keeps its identity, so the screens that read it are not redrawn (see trackedStore).
 */
function useSameList<T>(list: T[]): T[] {
  const last = useRef(list);
  const previous = last.current;
  if (previous !== list && (previous.length !== list.length || list.some((item, i) => item !== previous[i])))
    last.current = list;
  return last.current;
}

export function SurgiProvider({
  children,
  dataMode = 'DEMO',
  cloud,
}: {
  children: ReactNode;
  dataMode?: SurgiDataMode;
  cloud?: CloudWorkspace | null;
}) {
  const {
    acknowledgeOutOfUse,
    activeDepartment,
    addAssetPhotos,
    addToolsToSet,
    applyColorPlan,
    assignDepartment,
    assertCirculationAllowed,
    can,
    cloudOrganizationId,
    completeDeliveryToDepartment,
    completeSterilizationCycle,
    completeWorkflowCheckpoint,
    configureUsageLimit,
    correctUses,
    recordUsage,
    undoInfo,
    undoMovement,
    stageReturnInfo,
    returnToStage,
    counts,
    createProcessLoad,
    createPurchaseOrder,
    createSet,
    createTool,
    currentUser,
    deleteSet,
    deleteTool,
    deliveries,
    duplicateSet,
    duplicateTool,
    issues,
    lifecycleAlerts,
    markLost,
    moveTool,
    movements,
    nextBarcode,
    permissions,
    preparations,
    processLoads,
    purchaseOrders,
    addToBin,
    purgeExpiredBin,
    purgeFromBin,
    removeFromBin,
    recallCases,
    recallProcessLoad,
    recycleBin,
    receipts,
    receiveAtSterilization,
    receivePurchaseOrder,
    recordCount,
    forgetMovements,
    recordPreparation,
    reissueBarcode,
    releaseProcessLoad,
    finishProcessLoad,
    startCycleSimulation,
    recordBiologicalResult,
    advanceStageItems,
    releaseSterilization,
    removeAssetPhoto,
    renameTools,
    restoreFromBin,
    replaceFromStock,
    replaceToolInSet,
    reportIssue,
    reportSetIssue,
    resolveIssues,
    retireAsset,
    returnToService,
    role,
    sessionReady,
    sessionUser,
    sendSetToService,
    sendToSterilization,
    setColorMarker,
    setPurchaseOrderStatus,
    setRole,
    setSessionUser,
    setToast,
    sets,
    sterilizationCycles,
    sterilizationReleases,
    switchIdentity,
    syncCompositionNames,
    toast,
    tools,
    undoable,
    updateSet,
    updateTool,
    workflowCheckpoints,
  } = useSurgiStore({dataMode, cloud});
  // Studio settings the actions read (workflow stages and policies, permissions): a change must reach them.
  const {sterilizationWorkflow, rolePermissions, systemSettings, sterilizers, washers} = useLibraries();

  const activeTools = useMemo(() => tools.filter(t => t.state !== 'RETIRED'), [tools]);
  const retiredTools = useMemo(() => tools.filter(t => t.state === 'RETIRED'), [tools]);
  // A receipt, delivery, preparation or stage check whose movement was undone stays recorded but no longer counts.
  const cancelled = useMemo(() => cancelledRecordIds(movements), [movements]);
  const validReceipts = useSameList(useMemo(() => receipts.filter(r => !cancelled.has(r.id)), [receipts, cancelled]));
  const validDeliveries = useSameList(
    useMemo(() => deliveries.filter(d => !cancelled.has(d.id)), [deliveries, cancelled]),
  );
  const validPreparations = useSameList(
    useMemo(() => preparations.filter(r => !cancelled.has(r.id)), [preparations, cancelled]),
  );
  const validCheckpoints = useSameList(
    useMemo(() => workflowCheckpoints.filter(r => !cancelled.has(r.id)), [workflowCheckpoints, cancelled]),
  );
  const value = useMemo(
    () => ({
      sets,
      tools: activeTools,
      retiredTools,
      movements,
      issues,
      counts,
      receipts: validReceipts,
      preparations: validPreparations,
      sterilizationCycles,
      processLoads,
      recallCases,
      sterilizationReleases,
      workflowCheckpoints: validCheckpoints,
      deliveries: validDeliveries,
      purchaseOrders,
      recycleBin,
      restoreFromBin,
      addToBin,
      removeFromBin,
      purgeFromBin,
      purgeExpiredBin,
      replaceFromStock,
      receivePurchaseOrder,
      createPurchaseOrder,
      setPurchaseOrderStatus,
      organizationId: cloudOrganizationId,
      organizationName: cloud?.organizationName,
      lifecycleAlerts,
      toast,
      role,
      activeDepartment,
      currentUser,
      sessionReady,
      permissions,
      can,
      setRole,
      setSessionUser,
      switchIdentity,
      sendToSterilization,
      circulationAllowed: assertCirculationAllowed,
      receiveAtSterilization,
      recordPreparation,
      completeSterilizationCycle,
      createProcessLoad,
      releaseProcessLoad,
      finishProcessLoad,
      startCycleSimulation,
      recordBiologicalResult,
      advanceStageItems,
      recallProcessLoad,
      releaseSterilization,
      completeWorkflowCheckpoint,
      completeDeliveryToDepartment,
      configureUsageLimit,
      correctUses,
      recordUsage,
      undoInfo,
      undoMovement,
      stageReturnInfo,
      returnToStage,
      recordCount,
      forgetMovements,
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
    // The actions are recreated every render and close over the state listed here, so keep this list in
    // sync with the state they read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      sets,
      tools,
      movements,
      issues,
      counts,
      validReceipts,
      validPreparations,
      sterilizationCycles,
      processLoads,
      recallCases,
      sterilizationReleases,
      validCheckpoints,
      validDeliveries,
      purchaseOrders,
      recycleBin,
      lifecycleAlerts,
      toast,
      role,
      sessionUser,
      cloudOrganizationId,
      sterilizationWorkflow,
      rolePermissions,
      systemSettings,
      // A sterilizer or washer taken out of service is refused when a load is made.
      sterilizers,
      washers,
    ],
  );
  const [holder] = useState(() => createHolder<SurgiStoreValue>(value));
  // Set while drawing, so the components drawn after it in the same pass already see it; they and the others
  // that read a changed value are told once it is on the screen.
  holder.value = value;
  useLayoutEffect(() => publish(holder), [holder, value]);
  return <Ctx.Provider value={holder}>{children}</Ctx.Provider>;
}
