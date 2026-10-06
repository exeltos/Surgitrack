import {useEffect} from 'react';
import {entryFromDraft, planRestore, isExpired} from '../../core/recycleBin';
import {onBinDraft} from '../../core/binBridge';
import type {BinEntry} from '../../types/domain';
import {tr} from '../../i18n';
import type {useSurgiSession} from './useSurgiSession';
import type {useSurgiRecords} from './useSurgiRecords';
import type {useSurgiHelpers} from './useSurgiHelpers';

export function useRecycleBinActions(
  p: ReturnType<typeof useSurgiSession> & ReturnType<typeof useSurgiRecords> & ReturnType<typeof useSurgiHelpers>,
) {
  const {addMovement, currentUser, notify, recycleBin, setRecycleBin, setSets, setTools, sets, tools} = p;

  // Deletions made in the Studio libraries (a store above this one) arrive here.
  useEffect(
    () => onBinDraft(draft => setRecycleBin(x => [entryFromDraft(draft, currentUser.name), ...x])),
    [currentUser.name, setRecycleBin],
  );
  /** Keeps something deleted elsewhere (a device) for 30 days. */
  const addToBin = (entry: BinEntry) => setRecycleBin(x => [entry, ...x]);
  /** Takes an entry out of the bin without a message (after it was restored somewhere else). */
  const removeFromBin = (id: string) => setRecycleBin(x => x.filter(e => e.id !== id));
  /** Undoes a deletion: the Set or instrument comes back as it was, and leaves the bin. Returns false when it cannot. */
  const restoreFromBin = (id: string) => {
    const entry = recycleBin.find(e => e.id === id);
    // Libraries and devices are put back by the bin page, which can reach them.
    if (!entry || (entry.kind !== 'SET' && entry.kind !== 'TOOL')) return false;
    const plan = planRestore(entry, {sets, tools});
    if (!plan.ok) {
      notify(
        entry.kind === 'SET'
          ? tr('Δεν έγινε επαναφορά: υπάρχει ήδη Σετ με barcode {0}.', plan.barcode)
          : tr('Δεν έγινε επαναφορά: υπάρχει ήδη εργαλείο με barcode {0}.', plan.barcode),
      );
      return false;
    }
    const revert = new Map(plan.revert.map(t => [t.id, t]));
    if (plan.set) setSets(x => [plan.set!, ...x]);
    if (plan.setCountDelta)
      setSets(x =>
        x.map(s => (s.id === plan.setCountDelta!.setId ? {...s, actual: s.actual + plan.setCountDelta!.delta} : s)),
      );
    if (plan.add.length || revert.size) setTools(x => [...plan.add, ...x.map(t => revert.get(t.id) ?? t)]);
    setRecycleBin(x => x.filter(e => e.id !== id));
    addMovement({
      asset: entry.label,
      assetKind: entry.kind === 'SET' ? 'SET' : 'TOOL',
      from: 'Κάδος',
      to: plan.set?.department || (plan.add[0]?.mode === 'STOCK' ? 'Απόθεμα' : plan.add[0]?.department) || 'Απόθεμα',
      status: 'Επαναφορά από τον Κάδο',
      by: currentUser.name,
    });
    notify(
      plan.skipped.length
        ? tr('Έγινε επαναφορά. {0} εργαλεία δεν επανήλθαν: {1}.', plan.skipped.length, plan.skipped.join(', '))
        : tr('Έγινε επαναφορά: {0}.', entry.label),
    );
    return true;
  };
  /** Deletes an entry for good (the bin's «Οριστική διαγραφή»). */
  const purgeFromBin = (id: string) => {
    setRecycleBin(x => x.filter(e => e.id !== id));
    notify(tr('Διαγράφηκε οριστικά από τον Κάδο.'));
  };
  /** Clears what stayed past its 30 days; returns how many. */
  const purgeExpiredBin = () => {
    const expired = recycleBin.filter(e => isExpired(e));
    if (expired.length) setRecycleBin(x => x.filter(e => !isExpired(e)));
    return expired.length;
  };
  return {addToBin, purgeExpiredBin, purgeFromBin, removeFromBin, restoreFromBin};
}
