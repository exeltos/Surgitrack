import type {Asset} from '../../../types/domain';
import {releaseIndicatorVerdict} from '../../../core/releaseIndicators';
import type {Kind} from '../sterilizationTypes';
import type {useSterilizationState} from './useSterilizationState';
import type {useSterilizationQueues} from './useSterilizationQueues';
import type {usePreparationChecks} from './usePreparationChecks';
import type {useIssueReport} from './useIssueReport';
import type {useReceiptFlow} from './useReceiptFlow';
import type {usePreparationFlow} from './usePreparationFlow';

export function useCycleFlow(
  p: ReturnType<typeof useSterilizationState> &
    ReturnType<typeof useSterilizationQueues> &
    ReturnType<typeof usePreparationChecks> &
    ReturnType<typeof useIssueReport> &
    ReturnType<typeof useReceiptFlow> &
    ReturnType<typeof usePreparationFlow>,
) {
  const {
    biologicalIndicatorResult,
    checkpointChecks,
    checkpointDraft,
    checkpointNote,
    completeWorkflowCheckpoint,
    prepAcceptedDeviation,
    prepCheckedIds,
    prepCompositionComplete,
    prepDraft,
    prepItemIds,
    prepMissingCount,
    prepMissingRequirements,
    prepNote,
    prepProcessChecks,
    prepReadyForProcess,
    prepResolvedShortageIssues,
    processLoads,
    recordPreparation,
    releaseChecks,
    releaseDraft,
    releaseLoadBi,
    releaseLoadChem,
    releaseLoadChecks,
    releaseLoadId,
    releaseNote,
    releaseSterilization,
    resolveAssetDraft,
    resolveIssues,
    setAcceptedMissingCodes,
    setBiologicalIndicatorResult,
    setCheckpointChecks,
    setCheckpointDraft,
    setCheckpointNote,
    setPrepCheckedIds,
    setPrepDraft,
    setPrepManageMissingCode,
    setPrepManageToolId,
    setPrepNote,
    setPrepProcessChecks,
    setPrepReplacementRequirement,
    setPrepSelectedToolId,
    setPrepToolAction,
    setReleaseChecks,
    setReleaseDraft,
    setReleaseNote,
    sterilizationCycles,
    sterilizationWorkflow,
  } = p;

  const selectedReleaseLoad = releaseLoadId ? processLoads.find(load => load.id === releaseLoadId) : undefined;
  const releasePolicy = sterilizationWorkflow.releasePolicy || {
    requireChemicalIndicator: false,
    biologicalIndicator: 'OPTIONAL' as const,
    allowReleaseWhileBiPending: false,
  };
  const releaseVerdict = releaseIndicatorVerdict(releasePolicy, releaseLoadChem, releaseLoadBi);
  const releaseLoadReady =
    releaseLoadChecks.physicalParametersOk && releaseLoadChecks.packagingIntegrityOk && releaseVerdict.ok;
  const latestPassedCycle = (assetId: string) =>
    sterilizationCycles.find(c => c.assetId === assetId && c.result === 'PASSED');
  const moveToProcess = (kind: Kind, id: string) => {
    if (!prepDraft || !prepReadyForProcess) return;
    if (prepResolvedShortageIssues.length)
      resolveIssues(
        prepResolvedShortageIssues.map(i => i.id),
        prepAcceptedDeviation
          ? 'Η έλλειψη έγινε αποδεκτή τεκμηριωμένα και το Set προωθήθηκε με απόκλιση.'
          : 'Η σύνθεση αποκαταστάθηκε πριν την προώθηση.',
      );
    recordPreparation(kind, id, {
      toolIds: prepItemIds,
      checkedToolIds: [...prepCheckedIds],
      allOk: prepCompositionComplete,
      processChecks: prepProcessChecks,
      // Without a Packaging & Labelling stage the shelf life is chosen here.
      shelfLifeMonths: sterilizationWorkflow.stages.some(stage => stage.id === 'PACKAGING' && stage.enabled)
        ? undefined
        : p.shelfLife,
      note: [
        prepNote,
        prepAcceptedDeviation
          ? `Αποδεκτή απόκλιση σύνθεσης: ${prepMissingRequirements.length ? prepMissingRequirements.map(req => `${req.missing}× ${req.name}`).join(', ') : `${prepMissingCount} εργαλείο/α`}`
          : '',
      ]
        .filter(Boolean)
        .join(' · '),
    });
    setPrepDraft(null);
    setPrepCheckedIds(new Set());
    setPrepSelectedToolId(null);
    setPrepReplacementRequirement(null);
    setPrepManageToolId(null);
    setPrepManageMissingCode(null);
    setAcceptedMissingCodes(new Set());
    setPrepToolAction(null);
    setPrepNote('');
    setPrepProcessChecks({
      cleanDry: false,
      functionIntegrity: false,
      assembly: false,
      packaging: false,
      labelIndicator: false,
    });
  };
  const openRelease = (kind: Kind, asset: Asset) => {
    const draft = resolveAssetDraft(kind, asset.id);
    if (!draft) return;
    setReleaseDraft(draft);
    const cycle = latestPassedCycle(asset.id);
    setReleaseChecks({
      physicalParametersOk: false,
      chemicalIndicatorOk: cycle?.indicatorResult === 'PASS',
      packagingIntegrityOk: false,
    });
    setBiologicalIndicatorResult('NOT_REQUIRED');
    setReleaseNote('');
  };
  const closeRelease = () => {
    setReleaseDraft(null);
    setReleaseChecks({physicalParametersOk: false, chemicalIndicatorOk: false, packagingIntegrityOk: false});
    setBiologicalIndicatorResult('NOT_REQUIRED');
    setReleaseNote('');
  };
  const releaseReady =
    Object.values(releaseChecks).every(Boolean) &&
    (biologicalIndicatorResult === 'NOT_REQUIRED' || biologicalIndicatorResult === 'PASS');
  const completeRelease = (decision: 'RELEASED' | 'REPROCESS') => {
    if (!releaseDraft) return;
    const cycle = latestPassedCycle(releaseDraft.asset.id);
    if (!cycle) return;
    if (decision === 'RELEASED' && !releaseReady) return;
    const done = releaseSterilization(releaseDraft.kind, releaseDraft.asset.id, {
      cycleRecordId: cycle.id,
      ...releaseChecks,
      biologicalIndicatorResult,
      decision,
      note: releaseNote,
    });
    if (!done) return;
    closeRelease();
  };
  const openCheckpoint = (kind: Kind, asset: Asset, stageId: 'WASHING' | 'PACKAGING' | 'STORAGE') => {
    const draft = resolveAssetDraft(kind, asset.id);
    if (!draft) return;
    const stage = sterilizationWorkflow.stages.find(item => item.id === stageId);
    setCheckpointDraft({draft, stageId});
    setCheckpointChecks(new Array(stage?.checksEl.length || 0).fill(false));
    setCheckpointNote('');
    p.setShelfLife(asset.shelfLifeMonths || p.defaultShelfLife);
  };
  const closeCheckpoint = () => {
    setCheckpointDraft(null);
    setCheckpointChecks([]);
    setCheckpointNote('');
  };
  const checkpointStage = checkpointDraft
    ? sterilizationWorkflow.stages.find(stage => stage.id === checkpointDraft.stageId)
    : undefined;
  const checkpointReady =
    !!checkpointStage && checkpointChecks.length === checkpointStage.checksEl.length && checkpointChecks.every(Boolean);
  const finishCheckpoint = () => {
    if (!checkpointDraft || !checkpointReady) return;
    const done = completeWorkflowCheckpoint(checkpointDraft.draft.kind, checkpointDraft.draft.asset.id, {
      stageId: checkpointDraft.stageId,
      checks: checkpointChecks,
      shelfLifeMonths: checkpointDraft.stageId === 'PACKAGING' ? p.shelfLife : undefined,
      note: checkpointNote,
    });
    if (!done) return;
    closeCheckpoint();
  };
  return {
    checkpointReady,
    checkpointStage,
    closeCheckpoint,
    closeRelease,
    completeRelease,
    finishCheckpoint,
    latestPassedCycle,
    moveToProcess,
    openCheckpoint,
    openRelease,
    releaseLoadReady,
    releaseVerdict,
    releasePolicy,
    releaseReady,
    selectedReleaseLoad,
  };
}
