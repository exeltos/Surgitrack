import {useEffect, useState} from 'react';
import type {AssetKind, AssetState, Movement} from '../../types/domain';
import {findAsset, formatStoreDateTime, uniqueStamp} from '../helpers';
import type {Toast} from '../types';
import {tr} from '../../i18n';
import {DEFAULT_SHELF_LIFE, STERILE_STATES, isShelfLife, sterileUntil} from '../../core/sterileExpiry';
import type {useSurgiSession} from './useSurgiSession';
import type {useSurgiRecords} from './useSurgiRecords';

/** How long a management action can be taken back. */
const UNDO_SECONDS = 10;

export function useSurgiHelpers(p: ReturnType<typeof useSurgiSession> & ReturnType<typeof useSurgiRecords>) {
  const {recallCases, setMovements, setSets, setTools, sets, tools} = p;

  const [toast, setToast] = useState<Toast>();
  const notify = (text: string) => setToast({id: Date.now(), text});
  useEffect(() => {
    if (!toast) return;
    // An offer to undo stays long enough to read it and change one's mind.
    const timer = window.setTimeout(() => setToast(undefined), toast.undo ? UNDO_SECONDS * 1000 : 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const addMovement = (m: Omit<Movement, 'id' | 'at'>) =>
    setMovements(x => [{...m, id: `m${uniqueStamp()}`, at: formatStoreDateTime()}, ...x]);
  const assetName = (kind: AssetKind, id: string) => findAsset(kind, id, sets, tools);
  const isUsageExhausted = (kind: AssetKind, id: string) => {
    const asset = assetName(kind, id);
    if (!asset) return false;
    if (asset.maxUses && (asset.uses || 0) >= asset.maxUses) return true;
    if (kind === 'SET') {
      return tools.some(tool => tool.setId === id && tool.maxUses && (tool.uses || 0) >= tool.maxUses);
    }
    return false;
  };
  const isAssetRecalled = (kind: AssetKind, id: string) =>
    recallCases.some(
      c =>
        c.status === 'OPEN' &&
        c.items.some(item => item.assetKind === kind && item.assetId === id && item.status !== 'CLOSED'),
    );
  const assertCirculationAllowed = (kind: AssetKind, id: string) => {
    const asset = assetName(kind, id);
    if (!asset) return false;
    if (isUsageExhausted(kind, id)) {
      notify(tr('{0}: δεν επιτρέπεται η κυκλοφορία — έχει εξαντληθεί το όριο χρήσεων.', asset.barcode));
      return false;
    }
    if (isAssetRecalled(kind, id)) {
      notify(tr('{0}: δεν επιτρέπεται η κυκλοφορία — βρίσκεται σε ενεργή ανάκληση.', asset.barcode));
      return false;
    }
    return true;
  };
  /**
   * Moves an asset to a state. `sterile` (at release) sets its shelf life; any state outside sterile storage
   * clears the expiry date, since the item is being reprocessed.
   */
  const updateState = (
    kind: AssetKind,
    id: string,
    state: AssetState,
    sterile?: {sterileUntil: string; shelfLifeMonths: number},
  ) => {
    const expiry = (STERILE_STATES as readonly AssetState[]).includes(state)
      ? sterile || {}
      : {sterileUntil: undefined};
    if (kind === 'SET') {
      setSets(x => x.map(a => (a.id === id ? {...a, state, ...expiry} : a)));
      setTools(x => x.map(t => (t.setId === id ? {...t, state} : t)));
      return;
    }
    setTools(x => x.map(a => (a.id === id ? {...a, state, ...expiry} : a)));
  };
  /** Tools whose lives (limited uses) are consumed when this asset is dispatched after a procedure. */
  const livesConsumedBy = (kind: AssetKind, id: string) =>
    kind === 'TOOL'
      ? tools.filter(t => t.id === id && !!t.maxUses)
      : tools.filter(t => t.setId === id && !!t.maxUses && t.state !== 'RETIRED');
  /** Keeps the shelf life chosen at Packaging & Labelling until the release. */
  const chooseShelfLife = (kind: AssetKind, id: string, months?: number) => {
    if (!isShelfLife(months)) return;
    if (kind === 'SET') setSets(x => x.map(a => (a.id === id ? {...a, shelfLifeMonths: months} : a)));
    else setTools(x => x.map(a => (a.id === id ? {...a, shelfLifeMonths: months} : a)));
  };
  /** The shelf life a release gives: the months chosen at packaging, else the hospital default. */
  const releaseShelfLife = (kind: AssetKind, id: string, releasedOn: Date = new Date()) => {
    const chosen = assetName(kind, id)?.shelfLifeMonths;
    const fallback = p.systemSettings.sterileShelfLifeMonths;
    const shelfLifeMonths = isShelfLife(chosen) ? chosen : isShelfLife(fallback) ? fallback : DEFAULT_SHELF_LIFE;
    return {shelfLifeMonths, sterileUntil: sterileUntil(releasedOn, shelfLifeMonths)};
  };
  return {
    addMovement,
    assertCirculationAllowed,
    assetName,
    chooseShelfLife,
    livesConsumedBy,
    notify,
    releaseShelfLife,
    setToast,
    toast,
    updateState,
  };
}
