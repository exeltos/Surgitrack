import {useCallback, useRef, useSyncExternalStore} from 'react';

/**
 * The store's value, shared without making every screen draw again on every change.
 *
 * With the whole store in one React context, any change (a movement saved, a look for changes from another
 * device) redrew every screen and panel that reads the store, at a large hospital's size for up to a second.
 * Here the context only carries a holder; each component that reads the store is redrawn when one of the
 * values it read changes (by identity: the store replaces a collection when it changes), not otherwise.
 *
 * - Data and the functions that answer questions about the state while a screen draws (RENDER_READS) are
 *   tracked: reading one makes the component follow it.
 * - Actions (ACTIONS) are not: they change the state, and are called from buttons and forms. Each is handed
 *   out as one stable function that always calls the store's latest version, so a component that only uses
 *   actions is not redrawn when the state changes, and an action never runs on an old picture of the state.
 * A function of the store in neither list fails storeKeys.test.ts.
 */

/** Functions of the store that change it. */
export const ACTIONS = new Set([
  'restoreFromBin',
  'addToBin',
  'removeFromBin',
  'purgeFromBin',
  'purgeExpiredBin',
  'replaceFromStock',
  'receivePurchaseOrder',
  'createPurchaseOrder',
  'setPurchaseOrderStatus',
  'setRole',
  'setSessionUser',
  'switchIdentity',
  'sendToSterilization',
  'receiveAtSterilization',
  'recordPreparation',
  'completeSterilizationCycle',
  'createProcessLoad',
  'releaseProcessLoad',
  'finishProcessLoad',
  'startCycleSimulation',
  'recordBiologicalResult',
  'advanceStageItems',
  'recallProcessLoad',
  'releaseSterilization',
  'completeWorkflowCheckpoint',
  'completeDeliveryToDepartment',
  'configureUsageLimit',
  'correctUses',
  'recordUsage',
  'undoMovement',
  'returnToStage',
  'recordCount',
  'forgetMovements',
  'moveTool',
  'replaceToolInSet',
  'reportIssue',
  'reportSetIssue',
  'resolveIssues',
  'addAssetPhotos',
  'removeAssetPhoto',
  'createTool',
  'createSet',
  'reissueBarcode',
  'duplicateSet',
  'duplicateTool',
  'deleteSet',
  'deleteTool',
  'acknowledgeOutOfUse',
  'retireAsset',
  'setColorMarker',
  'applyColorPlan',
  'markLost',
  'returnToService',
  'sendSetToService',
  'assignDepartment',
  'updateSet',
  'updateTool',
  'renameTools',
  'syncCompositionNames',
  'addToolsToSet',
  'clearToast',
]);

/** Functions of the store that read the state and are used while a screen draws: followed like data. */
export const RENDER_READS = new Set([
  'can',
  'circulationAllowed',
  'undoInfo',
  'stageReturnInfo',
  'undoable',
  'nextBarcode',
]);

type Value = Record<string, unknown>;

/** What the context carries: the latest value and who wants to hear of a new one. */
export type StoreHolder<T> = {
  value: T;
  listeners: Set<() => void>;
  /** The stable function handed out for each action. */
  actions: Map<string, (...args: unknown[]) => unknown>;
};

export const createHolder = <T>(value: T): StoreHolder<T> => ({value, listeners: new Set(), actions: new Map()});

/** Puts a new value in the holder; the components are told by publish, once it is on the screen. */
export const publish = <T>(holder: StoreHolder<T>) => holder.listeners.forEach(listener => listener());

const stableAction = <T>(holder: StoreHolder<T>, key: string) => {
  let action = holder.actions.get(key);
  if (!action) {
    action = (...args: unknown[]) => ((holder.value as Value)[key] as (...a: unknown[]) => unknown)(...args);
    holder.actions.set(key, action);
  }
  return action;
};

/**
 * The store's value as this component sees it: reading a value (or a RENDER_READS function) makes the
 * component follow it; actions come back stable. Spreading or listing the keys follows them all.
 */
export function useTrackedValue<T extends object>(holder: StoreHolder<T>): T {
  const state = useRef<{seen: Map<string, unknown>; version: number; view?: T} | null>(null);
  if (!state.current) state.current = {seen: new Map(), version: 0};
  const own = state.current;
  const subscribe = useCallback(
    (listener: () => void) => {
      holder.listeners.add(listener);
      return () => {
        holder.listeners.delete(listener);
      };
    },
    [holder],
  );
  // A new version when one of the values this component read is no longer the same.
  const snapshot = () => {
    const value = holder.value as Value;
    for (const [key, seen] of own.seen)
      if (value[key] !== seen) {
        for (const k of own.seen.keys()) own.seen.set(k, value[k]);
        own.version += 1;
        break;
      }
    return own.version;
  };
  useSyncExternalStore(subscribe, snapshot, snapshot);
  if (!own.view) {
    const read = (key: string) => {
      const value = (holder.value as Value)[key];
      if (ACTIONS.has(key) && typeof value === 'function') return stableAction(holder, key);
      if (!own.seen.has(key)) own.seen.set(key, value);
      return value;
    };
    own.view = new Proxy({} as T, {
      get: (_, key) => (typeof key === 'string' ? read(key) : undefined),
      has: (_, key) => typeof key === 'string' && key in (holder.value as Value),
      ownKeys: () => {
        const keys = Object.keys(holder.value as Value);
        keys.forEach(read);
        return keys;
      },
      getOwnPropertyDescriptor: (_, key) =>
        typeof key === 'string' && key in (holder.value as Value)
          ? {configurable: true, enumerable: true, writable: false, value: read(key)}
          : undefined,
    });
  }
  return own.view;
}
