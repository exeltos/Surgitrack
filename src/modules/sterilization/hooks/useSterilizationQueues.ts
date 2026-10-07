import {useMemo} from 'react';
import {tr} from '../../../i18n';
import type {Kind, SterilizationRow, AssetDraft} from '../sterilizationTypes';
import type {useSterilizationState} from './useSterilizationState';

export function useSterilizationQueues(p: ReturnType<typeof useSterilizationState>) {
  const {departmentFilter, kindFilter, query, queue, sets, specialtyFilter, tools} = p;

  const all = useMemo<SterilizationRow[]>(
    () => [
      ...sets.map(x => ({...x, kind: 'SET' as const})),
      ...tools.filter(t => t.mode === 'STANDALONE').map(x => ({...x, kind: 'TOOL' as const})),
    ],
    [sets, tools],
  );
  const incoming = all.filter(x => x.state === 'PENDING_STERILIZATION');
  const washing = all.filter(x => x.state === 'IN_WASHING');
  const preparation = all.filter(x => x.state === 'IN_PREPARATION');
  const packaging = all.filter(x => x.state === 'IN_PACKAGING');
  const processing = all.filter(x => x.state === 'IN_STERILIZATION');
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
              : queue === 'RELEASE'
                ? awaitingRelease
                : queue === 'STORAGE'
                  ? storage
                  : ready;
  const queueValues = (key: 'department' | 'specialty'): string[] =>
    [...new Set<string>(source.map(x => String(x[key] || '')).filter(Boolean))].sort();
  const rows = source.filter(
    x =>
      (!departmentFilter || x.department === departmentFilter) &&
      (!specialtyFilter || x.specialty === specialtyFilter) &&
      (!kindFilter || x.kind === kindFilter) &&
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
  const queueTitle =
    queue === 'INCOMING'
      ? tr('Αναμονή φυσικής παραλαβής')
      : queue === 'WASHING'
        ? tr('Καθαρισμός & Απολύμανση')
        : queue === 'PREP'
          ? tr('Έλεγχος & Σύνθεση')
          : queue === 'PACKAGING'
            ? tr('Συσκευασία & Σήμανση')
            : queue === 'PROCESS'
              ? tr('Φόρτωση κλιβάνου')
              : queue === 'RELEASE'
                ? tr('Έλεγχος & Αποδέσμευση')
                : queue === 'STORAGE'
                  ? tr('Αποθήκευση')
                  : tr('Έτοιμα για παραλαβή');
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
              : queue === 'RELEASE'
                ? tr('Αναμένει αποδέσμευση')
                : queue === 'STORAGE'
                  ? tr('Σε αποθήκευση')
                  : tr('Έτοιμο για το τμήμα');
  return {
    all,
    awaitingRelease,
    incoming,
    packaging,
    preparation,
    processing,
    queueStageLabel,
    queueTitle,
    queueValues,
    ready,
    resolveAssetDraft,
    rows,
    source,
    storage,
    washing,
  };
}
