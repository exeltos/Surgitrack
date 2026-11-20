import {useMemo} from 'react';
import {tr} from '../../../i18n';
import {effectiveState} from '../../../core/workflow';
import {matchesUsage} from '../../../core/usageFilter';
import {latestDispatches} from '../../../core/electronicDispatch';
import {movementStamp} from '../../../core/movementTime';

/** Entries that change a record but move nothing (details, names, uses, a piece added to a composition). */
const EDIT = /^(Επεξεργασία στοιχείων|Έλεγχος ονομασιών|Προσθήκη εργαλείου|Διόρθωση χρήσεων|Συμπλήρωση ορίου)/;

/** «Περιμένουν πολύ»: in the same stage for longer than this. */
export const LONG_WAIT_HOURS = 4;
import type {AssetState} from '../../../types/domain';
import type {Kind, SterilizationRow, AssetDraft} from '../sterilizationTypes';
import type {useSterilizationState} from './useSterilizationState';

export function useSterilizationQueues(p: ReturnType<typeof useSterilizationState>) {
  const {
    attentionFilter,
    departmentFilter,
    movements,
    kindFilter,
    processLoads,
    query,
    queue,
    sets,
    specialtyFilter,
    sterilizationWorkflow,
    systemSettings,
    tools,
    usageFilter,
  } = p;

  // An item left in a stage since turned off in Studio shows (and is handled) in the next enabled stage.
  const stages = sterilizationWorkflow.stages;
  const all = useMemo<SterilizationRow[]>(() => {
    const inStage = <T extends {state: AssetState}>(x: T): T => ({
      ...x,
      state: effectiveState(stages, x.state) as AssetState,
    });
    return [
      ...sets.map(x => ({...inStage(x), kind: 'SET' as const})),
      ...tools.filter(t => t.mode === 'STANDALONE').map(x => ({...inStage(x), kind: 'TOOL' as const})),
    ];
  }, [sets, tools, stages]);
  const incoming = all.filter(x => x.state === 'PENDING_STERILIZATION');
  const washing = all.filter(x => x.state === 'IN_WASHING');
  const preparation = all.filter(x => x.state === 'IN_PREPARATION');
  const packaging = all.filter(x => x.state === 'IN_PACKAGING');
  // Loads in the sterilizer (cycle not ended yet): their items are locked until the end of the cycle.
  const runningLoads = processLoads.filter(load => load.kind === 'STERILIZATION' && load.status === 'OPEN');
  const inSterilizerKeys = new Set(runningLoads.flatMap(load => load.items.map(i => `${i.assetKind}:${i.assetId}`)));
  const loaded = (x: SterilizationRow) => inSterilizerKeys.has(`${x.kind}:${x.id}`);
  const processing = all.filter(x => x.state === 'IN_STERILIZATION' && !loaded(x));
  const inSterilizer = all.filter(x => x.state === 'IN_STERILIZATION' && loaded(x));
  const awaitingRelease = all.filter(x => x.state === 'AWAITING_RELEASE');
  const storage = all.filter(x => x.state === 'IN_STORAGE');
  const ready = all.filter(x => x.state === 'READY_FOR_PICKUP');
  const source =
    queue === 'INCOMING'
      ? incoming
      : queue === 'WASHING'
        ? washing
        : queue === 'PREP'
          ? preparation
          : queue === 'PACKAGING'
            ? packaging
            : queue === 'PROCESS'
              ? processing
              : queue === 'IN_STERILIZER'
                ? inSterilizer
                : queue === 'RELEASE'
                  ? awaitingRelease
                  : queue === 'STORAGE'
                    ? storage
                    : ready;
  const queueValues = (key: 'department' | 'specialty'): string[] =>
    [...new Set<string>(source.map(x => String(x[key] || '')).filter(Boolean))].sort();
  // A Set's instruments, gathered once, only while the usage filter is on.
  const toolsBySet = useMemo(() => {
    const bySet = new Map<string, typeof tools>();
    if (!usageFilter) return bySet;
    for (const t of tools) {
      if (!t.setId) continue;
      const list = bySet.get(t.setId);
      if (list) list.push(t);
      else bySet.set(t.setId, [t]);
    }
    return bySet;
  }, [tools, usageFilter]);
  // The attention filter reads the history once: each item's dispatch note and its last movement (when it got here).
  const attention = useMemo(() => {
    if (!attentionFilter) return undefined;
    // When it got to where it is: its last entry that moved it (a step, a stage check), not an edit of its details,
    // a correction or an undo.
    const lastAt = new Map<string, number>();
    for (const m of movements) {
      if (m.undoes || EDIT.test(m.status)) continue;
      const barcode = m.asset.split(' · ')[0];
      const at = movementStamp(m.at) || 0;
      if (at > (lastAt.get(barcode) || 0)) lastAt.set(barcode, at);
    }
    return {notes: latestDispatches(movements), lastAt};
  }, [attentionFilter, movements]);
  const needsAttention = (x: SterilizationRow) => {
    if (!attention) return true;
    if (attentionFilter === 'NOTE') return !!attention.notes.get(x.barcode)?.note;
    if (attentionFilter === 'SHORT') return x.kind === 'SET' && 'expected' in x && x.actual < x.expected;
    if (attentionFilter === 'WAITING') {
      const at = attention.lastAt.get(x.barcode);
      return !!at && Date.now() - at > LONG_WAIT_HOURS * 3600_000;
    }
    return true;
  };
  const rows = source.filter(
    x =>
      (!departmentFilter || x.department === departmentFilter) &&
      (!specialtyFilter || x.specialty === specialtyFilter) &&
      (!kindFilter || x.kind === kindFilter) &&
      needsAttention(x) &&
      // A Set by its own limit and its instruments' (as in the Sets list), an instrument by its own.
      (!usageFilter ||
        matchesUsage(
          usageFilter,
          x.kind === 'SET' ? [x, ...(toolsBySet.get(x.id) || [])] : [x],
          systemSettings.usageWarningThreshold,
        )) &&
      `${x.barcode} ${x.name} ${x.code || ''} ${x.department || ''} ${x.specialty || ''}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const resolveAssetDraft = (kind: Kind, id: string): AssetDraft | undefined => {
    if (kind === 'SET') {
      const asset = sets.find(item => item.id === id);
      return asset ? {kind: 'SET', asset} : undefined;
    }
    const asset = tools.find(item => item.id === id);
    return asset ? {kind: 'TOOL', asset} : undefined;
  };
  const queueStageLabel =
    queue === 'INCOMING'
      ? tr('Αναμένει φυσική παράδοση')
      : queue === 'WASHING'
        ? tr('Προς καθαρισμό / απολύμανση')
        : queue === 'PREP'
          ? tr('Προς έλεγχο / σύνθεση')
          : queue === 'PACKAGING'
            ? tr('Προς συσκευασία / σήμανση')
            : queue === 'PROCESS'
              ? tr('Προς φόρτωση στον κλίβανο')
              : queue === 'IN_STERILIZER'
                ? tr('Κύκλος σε εξέλιξη')
                : queue === 'RELEASE'
                  ? tr('Αναμένει αποδέσμευση')
                  : queue === 'STORAGE'
                    ? tr('Σε αποθήκευση')
                    : tr('Έτοιμο για το τμήμα');
  return {
    inSterilizer,
    runningLoads,
    all,
    awaitingRelease,
    incoming,
    packaging,
    preparation,
    processing,
    queueStageLabel,
    queueValues,
    ready,
    resolveAssetDraft,
    rows,
    source,
    storage,
    washing,
  };
}
