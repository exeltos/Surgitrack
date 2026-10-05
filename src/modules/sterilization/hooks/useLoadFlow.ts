import {tr} from '../../../i18n';
import type {useSterilizationState} from './useSterilizationState';
import type {useSterilizationQueues} from './useSterilizationQueues';
import type {usePreparationChecks} from './usePreparationChecks';
import type {useIssueReport} from './useIssueReport';
import type {useReceiptFlow} from './useReceiptFlow';
import type {usePreparationFlow} from './usePreparationFlow';
import type {useCycleFlow} from './useCycleFlow';

export function useLoadFlow(
  p: ReturnType<typeof useSterilizationState> &
    ReturnType<typeof useSterilizationQueues> &
    ReturnType<typeof usePreparationChecks> &
    ReturnType<typeof useIssueReport> &
    ReturnType<typeof useReceiptFlow> &
    ReturnType<typeof usePreparationFlow> &
    ReturnType<typeof useCycleFlow>,
) {
  const {
    all,
    createProcessLoad,
    loadChemical,
    loadCycleNumber,
    loadEquipment,
    loadModal,
    loadNote,
    loadProgram,
    loadSelected,
    processLoads,
    processing,
    recallProcessLoad,
    releaseLoadBi,
    releaseLoadChecks,
    releaseLoadId,
    releaseLoadNote,
    releasePolicy,
    releaseProcessLoad,
    setLoadChemical,
    setLoadCycleNumber,
    setLoadEquipment,
    setLoadModal,
    setLoadNote,
    setLoadProgram,
    setLoadScanFeedback,
    setLoadSelected,
    setReleaseLoadBi,
    setReleaseLoadChecks,
    setReleaseLoadId,
    setReleaseLoadNote,
    tools,
    washing,
  } = p;

  const loadCandidates = loadModal === 'WASHING' ? washing : loadModal === 'STERILIZATION' ? processing : [];
  const awaitingLoads = processLoads.filter(
    load => load.kind === 'STERILIZATION' && load.status === 'AWAITING_RELEASE',
  );
  const releasedLoads = processLoads
    .filter(load => load.kind === 'STERILIZATION' && load.status === 'RELEASED')
    .slice(0, 5);
  const openLoad = (kind: 'WASHING' | 'STERILIZATION') => {
    const candidates = kind === 'WASHING' ? washing : processing;
    setLoadModal(kind);
    setLoadSelected(kind === 'STERILIZATION' ? new Set() : new Set(candidates.map(item => `${item.kind}:${item.id}`)));
    setLoadEquipment(kind === 'WASHING' ? 'Πλυντήριο 1' : 'Κλίβανος 1');
    setLoadCycleNumber('');
    setLoadProgram(kind === 'WASHING' ? 'Θερμική απολύμανση' : '134°C · 5 min');
    setLoadChemical('PASS');
    setLoadNote('');
    setLoadScanFeedback(null);
  };
  const closeLoad = () => {
    setLoadModal(null);
    setLoadSelected(new Set());
    setLoadCycleNumber('');
    setLoadNote('');
    setLoadScanFeedback(null);
  };
  const toggleLoadAsset = (key: string) =>
    setLoadSelected(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const addBarcodeToLoad = (raw: string) => {
    const barcode = raw.trim().toUpperCase();
    if (!barcode) return false;
    const eligible = loadCandidates.find(item => item.barcode.toUpperCase() === barcode);
    if (!eligible) {
      const known =
        all.find(item => item.barcode.toUpperCase() === barcode) ||
        tools.find(item => item.barcode.toUpperCase() === barcode);
      setLoadScanFeedback({
        type: 'ERROR',
        message: known
          ? tr('{0} αναγνωρίστηκε, αλλά δεν βρίσκεται στο σωστό στάδιο για αυτό το φορτίο.', barcode)
          : tr('{0} δεν βρέθηκε στο μητρώο.', barcode),
      });
      return false;
    }
    const key = `${eligible.kind}:${eligible.id}`;
    if (loadSelected.has(key)) {
      setLoadScanFeedback({type: 'WARN', message: tr('{0} είναι ήδη στο φορτίο.', barcode)});
      return false;
    }
    setLoadSelected(current => new Set([...current, key]));
    setLoadScanFeedback({type: 'OK', message: tr('{0} · {1} προστέθηκε στο φορτίο.', barcode, eligible.name)});
    return true;
  };
  const completeLoad = () => {
    if (!loadModal || !loadEquipment.trim() || !loadCycleNumber.trim() || !loadProgram.trim() || !loadSelected.size)
      return;
    const candidates = loadModal === 'WASHING' ? washing : processing;
    const assetRefs = candidates
      .filter(item => loadSelected.has(`${item.kind}:${item.id}`))
      .map(item => ({kind: item.kind, id: item.id}));
    const created = createProcessLoad({
      kind: loadModal,
      assetRefs,
      equipment: loadEquipment.trim(),
      cycleNumber: loadCycleNumber.trim(),
      program: loadProgram.trim(),
      chemicalIndicatorResult: loadModal === 'STERILIZATION' ? loadChemical : undefined,
      note: loadNote.trim() || undefined,
    });
    if (created) closeLoad();
  };
  const openLoadRelease = (id: string) => {
    setReleaseLoadId(id);
    setReleaseLoadChecks({
      physicalParametersOk: false,
      chemicalIndicatorOk: !releasePolicy.requireChemicalIndicator,
      packagingIntegrityOk: false,
    });
    setReleaseLoadBi(releasePolicy.biologicalIndicator === 'REQUIRED' ? 'PENDING' : 'NOT_REQUIRED');
    setReleaseLoadNote('');
  };
  const closeLoadRelease = () => {
    setReleaseLoadId(null);
    setReleaseLoadChecks({physicalParametersOk: false, chemicalIndicatorOk: false, packagingIntegrityOk: false});
    setReleaseLoadBi('NOT_REQUIRED');
    setReleaseLoadNote('');
  };
  const completeLoadRelease = (decision: 'RELEASED' | 'REPROCESS') => {
    if (!releaseLoadId) return;
    const done = releaseProcessLoad(releaseLoadId, {
      ...releaseLoadChecks,
      biologicalIndicatorResult: releaseLoadBi,
      decision,
      note: releaseLoadNote.trim() || undefined,
    });
    if (done) closeLoadRelease();
  };
  const recallLoad = (id: string) => {
    const reason = window.prompt(
      tr('Αιτιολογία ανάκλησης φορτίου:'),
      'Μη αποδεκτό αποτέλεσμα δείκτη / απόκλιση μετά την αποδέσμευση',
    );
    if (!reason?.trim()) return;
    recallProcessLoad(id, reason.trim());
  };
  return {
    addBarcodeToLoad,
    awaitingLoads,
    closeLoad,
    closeLoadRelease,
    completeLoad,
    completeLoadRelease,
    loadCandidates,
    openLoad,
    openLoadRelease,
    recallLoad,
    releasedLoads,
    toggleLoadAsset,
  };
}
