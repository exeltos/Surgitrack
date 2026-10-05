import {formatStoreDateTime, uniqueStamp} from '../helpers';
import {tr} from '../../i18n';
import type {useSurgiSession} from './useSurgiSession';
import type {useSurgiRecords} from './useSurgiRecords';
import type {useSurgiHelpers} from './useSurgiHelpers';
import type {useReceiptAndCycleActions} from './useReceiptAndCycleActions';
import type {useLoadActions} from './useLoadActions';

export function useAssetHelpers(
  p: ReturnType<typeof useSurgiSession> &
    ReturnType<typeof useSurgiRecords> &
    ReturnType<typeof useSurgiHelpers> &
    ReturnType<typeof useReceiptAndCycleActions> &
    ReturnType<typeof useLoadActions>,
) {
  const {addMovement, currentUser, issues, setIssues, setSets, setToast, setTools, sets, tools} = p;

  /** Opens an issue on the asset unless one of the same kind is already open. */
  const openIssue = (asset: {barcode: string; name: string}, type: string, department: string, note: string) =>
    // Checked against the latest list, so a report closed by the same action does not block it.
    setIssues(x =>
      x.some(i => i.status === 'OPEN' && i.type === type && i.asset.startsWith(asset.barcode))
        ? x
        : [
            {
              id: `i${uniqueStamp()}`,
              asset: `${asset.barcode} · ${asset.name}`,
              type,
              status: 'OPEN',
              created: formatStoreDateTime(),
              department,
              note,
            },
            ...x,
          ],
    );
  const undoable = (label: string, run: () => void) => {
    const before = {sets, tools, issues};
    run();
    const undo = () => {
      const revert =
        <T extends {id: string}>(previous: T[]) =>
        (list: T[]) => {
          const old = new Map(previous.map(r => [r.id, r]));
          const now = new Set(list.map(r => r.id));
          // Records the action created go; changed ones get their earlier version; removed ones return.
          return [...previous.filter(r => !now.has(r.id)), ...list.filter(r => old.has(r.id)).map(r => old.get(r.id)!)];
        };
      setSets(revert(before.sets));
      setTools(revert(before.tools));
      // Problem reports are never deleted: one the action opened is closed as taken back.
      const oldIssues = new Map(before.issues.map(i => [i.id, i]));
      setIssues(list =>
        list.map(i =>
          oldIssues.has(i.id)
            ? oldIssues.get(i.id)!
            : i.status === 'OPEN'
              ? {...i, status: 'RESOLVED', note: `${i.note} · Αναιρέθηκε`}
              : i,
        ),
      );
      addMovement({
        asset: label,
        assetKind: 'TOOL',
        from: '—',
        to: '—',
        status: 'Αναίρεση ενέργειας',
        by: currentUser.name,
        note: label,
      });
      setToast({id: Date.now(), text: tr('Η ενέργεια αναιρέθηκε.')});
    };
    // The action's own message, now with the offer to take it back.
    setToast(current => ({id: Date.now(), text: current?.text || label, undo}));
  };
  return {openIssue, undoable};
}
