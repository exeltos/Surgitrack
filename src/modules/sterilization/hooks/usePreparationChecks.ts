import {tr} from '../../../i18n';
import type {Issue} from '../../../types/domain';
import type {useSterilizationState} from './useSterilizationState';

/** A Set without a composition template still shows its shortage as rows to handle (replace or keep as is). */
export const SET_SHORTAGE_CODE = '__SET_SHORTAGE__';
/** An issue that records a shortage (handled through the Missing rows). */
const isShortageIssue = (i: Issue) =>
  i.type.toLowerCase().includes('έλλει') ||
  i.note.toLowerCase().includes('έλλει') ||
  i.note.toLowerCase().includes('αναμενόμενα');
import type {useSterilizationQueues} from './useSterilizationQueues';

export function usePreparationChecks(
  p: ReturnType<typeof useSterilizationState> & ReturnType<typeof useSterilizationQueues>,
) {
  const {
    acceptedMissingCodes,
    allowMissing,
    issues,
    prepCheckedIds,
    prepDraft,
    prepKeptIssueIds,
    prepManageIssueId,
    prepManageMissingCode,
    prepManageToolId,
    prepProcessChecks,
    prepReplacementRequirement,
    prepReplacementSetId,
    prepReplacementSource,
    prepSelectedToolId,
    sets,
    stageEnabled,
    tools,
  } = p;

  const prepTools = prepDraft?.kind === 'SET' ? tools.filter(t => t.setId === prepDraft.asset.id) : [];
  const prepItemIds = prepDraft ? (prepDraft.kind === 'SET' ? prepTools.map(t => t.id) : [prepDraft.asset.id]) : [];
  const prepItemBarcodes = prepDraft
    ? prepDraft.kind === 'SET'
      ? prepTools.map(t => t.barcode)
      : [prepDraft.asset.barcode]
    : [];
  const prepOpenIssues = prepDraft
    ? issues.filter(
        i =>
          i.status === 'OPEN' &&
          (i.asset.startsWith(prepDraft.asset.barcode) || prepItemBarcodes.some(code => i.asset.startsWith(code))),
      )
    : [];
  const prepAllChecked = prepItemIds.length > 0 && prepItemIds.every(id => prepCheckedIds.has(id));
  const prepExpectedCount = prepDraft?.kind === 'SET' ? prepDraft.asset.expected : 1;
  const prepMissingCount = prepDraft?.kind === 'SET' ? Math.max(0, prepExpectedCount - prepTools.length) : 0;
  const templateMissing =
    prepDraft?.kind === 'SET' && prepDraft.asset.compositionTemplate
      ? prepDraft.asset.compositionTemplate.flatMap(req => {
          const actual = prepTools.filter(t => t.code === req.code).length;
          const missing = Math.max(0, req.quantity - actual);
          return missing ? [{...req, missing}] : [];
        })
      : [];
  // What the template does not explain (no template, or fewer instruments than the Set's expected count).
  const unexplained = prepMissingCount - templateMissing.reduce((sum, req) => sum + req.missing, 0);
  const prepMissingRequirements =
    prepDraft?.kind === 'SET' && unexplained > 0
      ? [
          ...templateMissing,
          {code: SET_SHORTAGE_CODE, name: tr('Εργαλείο που λείπει'), quantity: prepExpectedCount, missing: unexplained},
        ]
      : templateMissing;
  const prepTemplateComplete =
    prepDraft?.kind !== 'SET' || !prepDraft.asset.compositionTemplate?.length || prepMissingRequirements.length === 0;
  const prepCompositionComplete =
    !!prepDraft && (prepDraft.kind === 'TOOL' || (prepMissingCount === 0 && prepTemplateComplete));
  const prepMissingAccepted =
    prepDraft?.kind !== 'SET' ||
    (prepMissingRequirements.length > 0
      ? prepMissingRequirements.every(req => acceptedMissingCodes.has(req.code))
      : prepMissingCount > 0
        ? allowMissing
        : true);
  const prepAcceptedDeviation =
    !!prepDraft && prepDraft.kind === 'SET' && !prepCompositionComplete && prepMissingAccepted;
  const prepResolvedShortageIssues =
    prepDraft?.kind === 'SET' && (prepCompositionComplete || prepAcceptedDeviation)
      ? prepOpenIssues.filter(i => i.asset.startsWith(prepDraft.asset.barcode) && isShortageIssue(i))
      : [];
  const prepResolvedShortageIssueIds = new Set(prepResolvedShortageIssues.map(i => i.id));
  const prepBlockingIssues = prepOpenIssues.filter(
    i => !prepResolvedShortageIssueIds.has(i.id) && !prepKeptIssueIds.has(i.id),
  );
  // Issues about the Set itself (not one of its instruments, not a shortage): listed as rows to handle.
  const prepSetIssues =
    prepDraft?.kind === 'SET'
      ? prepOpenIssues.filter(
          i =>
            i.asset.startsWith(prepDraft.asset.barcode) &&
            !isShortageIssue(i) &&
            !prepTools.some(t => i.asset.startsWith(t.barcode)),
        )
      : [];
  const prepManageIssue = prepManageIssueId ? prepSetIssues.find(i => i.id === prepManageIssueId) : undefined;
  const prepProcessReady =
    prepProcessChecks.functionIntegrity &&
    prepProcessChecks.assembly &&
    (stageEnabled('WASHING') || prepProcessChecks.cleanDry) &&
    (stageEnabled('PACKAGING') || (prepProcessChecks.packaging && prepProcessChecks.labelIndicator));
  const prepReadyForProcess =
    prepAllChecked &&
    prepBlockingIssues.length === 0 &&
    (prepCompositionComplete || prepMissingAccepted) &&
    prepProcessReady;
  const prepSelectedTool = prepSelectedToolId ? tools.find(t => t.id === prepSelectedToolId) : undefined;
  const prepManageTool = prepManageToolId ? tools.find(t => t.id === prepManageToolId) : undefined;
  const prepManageMissing = prepManageMissingCode
    ? prepMissingRequirements.find(req => req.code === prepManageMissingCode)
    : undefined;
  const prepOtherSets = prepDraft?.kind === 'SET' ? sets.filter(s => s.id !== prepDraft.asset.id) : [];
  const prepReplacementSourceSets =
    prepDraft?.kind === 'SET'
      ? sets.filter(
          set =>
            set.id !== prepDraft.asset.id &&
            tools.some(
              t => t.mode === 'SET_MEMBER' && t.setId === set.id && t.state !== 'SERVICE' && t.state !== 'LOST',
            ),
        )
      : [];
  const prepReplacementTargetCode = prepSelectedTool?.code || prepReplacementRequirement?.code;
  const prepReplacementCandidates =
    prepDraft?.kind === 'SET' && prepReplacementTargetCode
      ? tools
          .filter(
            t =>
              t.setId !== prepDraft.asset.id &&
              t.state !== 'SERVICE' &&
              t.state !== 'LOST' &&
              (prepReplacementSource === 'STOCK'
                ? t.mode === 'STOCK'
                : prepReplacementSource === 'SET'
                  ? t.mode === 'SET_MEMBER' && t.setId === prepReplacementSetId
                  : t.mode === 'STANDALONE'),
          )
          .sort(
            (a, b) =>
              Number(b.code === prepReplacementTargetCode) - Number(a.code === prepReplacementTargetCode) ||
              a.name.localeCompare(b.name, 'el'),
          )
      : [];
  return {
    prepAcceptedDeviation,
    prepMissingAccepted,
    prepSetIssues,
    prepManageIssue,
    prepBlockingIssues,
    prepCompositionComplete,
    prepExpectedCount,
    prepItemIds,
    prepManageMissing,
    prepManageTool,
    prepMissingCount,
    prepMissingRequirements,
    prepOpenIssues,
    prepOtherSets,
    prepReadyForProcess,
    prepReplacementCandidates,
    prepReplacementSourceSets,
    prepReplacementTargetCode,
    prepResolvedShortageIssues,
    prepSelectedTool,
    prepTools,
  };
}
