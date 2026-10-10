import {useMemo} from 'react';
import {tr} from '../../../i18n';
import {effectiveState} from '../../../core/workflow';
import type {AssetState} from '../../../types/domain';
import type {Kind, SterilizationRow, AssetDraft} from '../sterilizationTypes';
import type {useSterilizationState} from './useSterilizationState';

export function useSterilizationQueues(p: ReturnType<typeof useSterilizationState>) {
  const {
    departmentFilter,
    kindFilter,
    processLoads,
    query,
    queue,
    sets,
    specialtyFilter,
    sterilizationWorkflow,
    tools,
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
              : queue === 'IN_STERILIZER'
                ? tr('Στον κλίβανο')
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
