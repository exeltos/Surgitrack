import {tr} from '../../../i18n';
import {printReleaseForm} from '../printRelease';
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
    loadChemicalOn,
    loadBiologicalOn,
    setLoadChemicalOn,
    setLoadBiologicalOn,
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
    releaseLoadChem,
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
    setReleaseLoadChem,
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
  // Released loads still waiting for their biological indicator come first (all of them), then the latest.
  const released = processLoads.filter(load => load.kind === 'STERILIZATION' && load.status === 'RELEASED');
  const releasedLoads = [
    ...released.filter(load => load.biologicalIndicatorResult === 'PENDING'),
    ...released.filter(load => load.biologicalIndicatorResult !== 'PENDING').slice(0, 5),
  ];
  /** Opens a load with everything of the stage preselected, or only the given `kind:id` keys. */
  const openLoad = (kind: 'WASHING' | 'STERILIZATION', preselected?: readonly string[]) => {
    const candidates = kind === 'WASHING' ? washing : processing;
    setLoadModal(kind);
    setLoadSelected(new Set(preselected ?? candidates.map(item => `${item.kind}:${item.id}`)));
    setLoadEquipment(kind === 'WASHING' ? 'Πλυντήριο 1' : p.defaultSterilizer);
    setLoadCycleNumber('');
    setLoadProgram(kind === 'WASHING' ? 'Θερμική απολύμανση' : '134°C · 5 min');
    setLoadChemical('NOT_RECORDED');
    setLoadChemicalOn(true);
    setLoadBiologicalOn(releasePolicy.biologicalIndicator === 'REQUIRED');
    p.setLoadFromDevice(false);
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
      chemicalIndicatorResult:
        loadModal === 'STERILIZATION' && (loadChemicalOn || loadChemical === 'FAIL') ? loadChemical : undefined,
      biologicalIndicatorResult: loadModal === 'STERILIZATION' && loadBiologicalOn ? 'PENDING' : undefined,
      cycleCompleted: loadModal === 'STERILIZATION' && p.loadFromDevice,
      note: loadNote.trim() || undefined,
    });
    if (created) closeLoad();
  };
  const openLoadRelease = (id: string) => {
    setReleaseLoadId(id);
    setReleaseLoadChecks({physicalParametersOk: false, chemicalIndicatorOk: false, packagingIntegrityOk: false});
    setReleaseLoadChem('NOT_RECORDED');
    const planned = processLoads.find(load => load.id === id);
    setReleaseLoadBi(
      planned?.biologicalIndicatorResult === 'PENDING' || releasePolicy.biologicalIndicator === 'REQUIRED'
        ? 'PENDING'
        : 'NOT_REQUIRED',
    );
    setReleaseLoadNote('');
  };
  const closeLoadRelease = () => {
    setReleaseLoadId(null);
    setReleaseLoadChecks({physicalParametersOk: false, chemicalIndicatorOk: false, packagingIntegrityOk: false});
    setReleaseLoadChem('NOT_RECORDED');
    setReleaseLoadBi('NOT_REQUIRED');
    setReleaseLoadNote('');
  };
  const completeLoadRelease = (decision: 'RELEASED' | 'REPROCESS') => {
    if (!releaseLoadId) return;
    const done = releaseProcessLoad(releaseLoadId, {
      ...releaseLoadChecks,
      chemicalIndicatorOk: releaseLoadChem === 'PASS',
      chemicalIndicatorResult: releaseLoadChem,
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
  /** Prints the release form of a load: blank while in the sterilizer, filled in once released. */
  const printLoadForm = (loadId: string) => {
    const load = p.processLoads.find(item => item.id === loadId);
    if (!load) return;
    const releases = p.sterilizationReleases.filter(r => r.loadId === loadId);
    const items = load.items.map(item => {
      const release = releases.find(r => r.assetId === item.assetId);
      const asset =
        item.assetKind === 'SET' ? p.sets.find(x => x.id === item.assetId) : p.tools.find(x => x.id === item.assetId);
      return {
        barcode: item.barcode,
        name: item.assetName,
        kind: item.assetKind,
        department: item.department,
        shelfLifeMonths: release?.shelfLifeMonths ?? asset?.shelfLifeMonths,
        sterileUntil: release?.sterileUntil,
      };
    });
    const first = releases[0];
    const released = load.status === 'RELEASED' || load.status === 'REPROCESS' || load.status === 'RECALLED';
    printReleaseForm({
      load,
      items,
      hospital: p.organizationName,
      approver: first
        ? {name: first.releasedByName, department: first.releasedByDepartment}
        : {name: p.currentUser.name, department: p.currentUser.department},
      released:
        released && load.releasedAt
          ? {at: load.releasedAt, decision: load.status === 'REPROCESS' ? 'REPROCESS' : 'RELEASED'}
          : undefined,
      label: p.systemSettings.label,
    });
  };
  return {
    printLoadForm,
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
