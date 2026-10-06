import {useEffect, useState} from 'react';
import type {AssetKind, AssetState, Movement} from '../../types/domain';
import {findAsset, formatStoreDateTime, uniqueStamp} from '../helpers';
import type {Toast} from '../types';
import {tr} from '../../i18n';
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
  const updateState = (kind: AssetKind, id: string, state: AssetState) => {
    if (kind === 'SET') {
      setSets(x => x.map(a => (a.id === id ? {...a, state} : a)));
      setTools(x => x.map(t => (t.setId === id ? {...t, state} : t)));
      return;
    }
    setTools(x => x.map(a => (a.id === id ? {...a, state} : a)));
  };
  /** Tools whose lives (limited uses) are consumed when this asset is dispatched after a procedure. */
  const livesConsumedBy = (kind: AssetKind, id: string) =>
    kind === 'TOOL'
      ? tools.filter(t => t.id === id && !!t.maxUses)
      : tools.filter(t => t.setId === id && !!t.maxUses && t.state !== 'RETIRED');
  return {addMovement, assertCirculationAllowed, assetName, livesConsumedBy, notify, setToast, toast, updateState};
}
