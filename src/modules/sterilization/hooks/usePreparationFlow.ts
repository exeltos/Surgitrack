import type {Asset} from '../../../types/domain';
import {EMPTY_COLOR_PLAN} from '../../../core/colorTapes';
import type {Kind} from '../sterilizationTypes';
import type {useSterilizationState} from './useSterilizationState';
import type {useSterilizationQueues} from './useSterilizationQueues';
import type {usePreparationChecks} from './usePreparationChecks';
import type {useIssueReport} from './useIssueReport';
import type {useReceiptFlow} from './useReceiptFlow';

export function usePreparationFlow(
  p: ReturnType<typeof useSterilizationState> &
    ReturnType<typeof useSterilizationQueues> &
    ReturnType<typeof usePreparationChecks> &
    ReturnType<typeof useIssueReport> &
    ReturnType<typeof useReceiptFlow>,
) {
  const {
    applyColorPlan,
    colorQuestion,
    issues,
    moveTool,
    prepCheckedIds,
    prepDraft,
    prepOpenIssues,
    prepOutgoingDestination,
    prepOutgoingSetId,
    prepReplacementId,
    prepReplacementRequirement,
    prepSelectedTool,
    prepTargetSetId,
    prepToolAction,
    prepTools,
    replaceToolInSet,
    resolveAssetDraft,
    setAcceptedMissingCodes,
    setAllowMissing,
    setPrepCheckedIds,
    setPrepDraft,
    setPrepManageMissingCode,
    setPrepManageToolId,
    setPrepNote,
    setPrepOutgoingDestination,
    setPrepOutgoingSetId,
    setPrepProcessChecks,
    setPrepReplacementId,
    setPrepReplacementRequirement,
    setPrepReplacementSetId,
    setPrepReplacementSource,
    setPrepSelectedToolId,
    setPrepTargetSetId,
    setPrepToolAction,
    setReceiptView,
    sets,
  } = p;

  const openPreparation = (kind: Kind, asset: Asset) => {
    const draft = resolveAssetDraft(kind, asset.id);
    if (!draft) return;
    setPrepDraft(draft);
    setReceiptView(null);
    setAllowMissing(false);
    setPrepCheckedIds(new Set());
    setPrepSelectedToolId(null);
    setPrepReplacementRequirement(null);
    setPrepManageToolId(null);
    setPrepManageMissingCode(null);
    setAcceptedMissingCodes(new Set());
    setPrepToolAction(null);
    setPrepNote('');
    p.setShelfLife(asset.shelfLifeMonths || p.defaultShelfLife);
    setPrepProcessChecks({
      cleanDry: false,
      functionIntegrity: false,
      assembly: false,
      packaging: false,
      labelIndicator: false,
    });
  };
  const togglePrepItem = (id: string) =>
    setPrepCheckedIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const prepEligibleIds = prepDraft
    ? prepDraft.kind === 'SET'
      ? prepTools.filter(t => !issues.some(i => i.status === 'OPEN' && i.asset.startsWith(t.barcode))).map(t => t.id)
      : prepOpenIssues.length
        ? []
        : [prepDraft.asset.id]
    : [];
  const prepAllEligibleSelected = prepEligibleIds.length > 0 && prepEligibleIds.every(id => prepCheckedIds.has(id));
  const toggleAllPrepChecks = () => setPrepCheckedIds(prepAllEligibleSelected ? new Set() : new Set(prepEligibleIds));
  const openPrepManage = (toolId: string) => {
    setPrepManageMissingCode(null);
    setPrepManageToolId(toolId);
    setPrepSelectedToolId(toolId);
    setPrepReplacementRequirement(null);
  };
  const openMissingManage = (code: string) => {
    setPrepManageToolId(null);
    setPrepManageMissingCode(code);
  };
  const closePrepManage = () => {
    setPrepManageToolId(null);
    setPrepManageMissingCode(null);
    setPrepToolAction(null);
  };
  const acceptMissingWithoutAction = (code: string) => {
    setAcceptedMissingCodes(current => new Set(current).add(code));
    setPrepManageMissingCode(null);
  };
  const undoAcceptedMissing = (code: string) =>
    setAcceptedMissingCodes(current => {
      const next = new Set(current);
      next.delete(code);
      return next;
    });
  const openPrepToolAction = (action: 'REPLACE' | 'SERVICE' | 'STOCK' | 'SET') => {
    if (!prepSelectedTool && !(action === 'REPLACE' && prepReplacementRequirement)) return;
    setPrepToolAction(action);
    setPrepReplacementId('');
    setPrepReplacementSource('STOCK');
    setPrepReplacementSetId('');
    setPrepOutgoingDestination('SERVICE');
    setPrepOutgoingSetId('');
    setPrepTargetSetId('');
  };
  const closePrepToolAction = () => {
    setPrepToolAction(null);
    setPrepReplacementRequirement(null);
    setPrepReplacementId('');
    setPrepReplacementSetId('');
    setPrepOutgoingSetId('');
    setPrepTargetSetId('');
  };
  const applyPrepToolAction = async () => {
    if (!prepDraft || prepDraft.kind !== 'SET' || (!prepSelectedTool && !prepReplacementRequirement)) return;
    // The instrument that joins a Set here, and that Set: ask about its own color first.
    const joining =
      prepToolAction === 'REPLACE' && prepReplacementId
        ? {toolId: prepReplacementId, setId: prepDraft.asset.id}
        : prepToolAction === 'SET' && prepSelectedTool && prepTargetSetId
          ? {toolId: prepSelectedTool.id, setId: prepTargetSetId}
          : null;
    const plan = joining ? await colorQuestion.ask([joining.toolId], joining.setId) : EMPTY_COLOR_PLAN;
    if (!plan) return;
    const takeSetColor = () => {
      if (joining) applyColorPlan(plan, sets.find(s => s.id === joining.setId)?.barcode || '');
    };
    if (prepToolAction === 'REPLACE') {
      if (!prepReplacementId) return;
      if (!prepSelectedTool) {
        moveTool(prepReplacementId, 'SET', prepDraft.asset.id);
        takeSetColor();
        if (prepReplacementRequirement)
          setAcceptedMissingCodes(current => {
            const next = new Set(current);
            next.delete(prepReplacementRequirement.code);
            return next;
          });
        setPrepSelectedToolId(prepReplacementId);
        setPrepReplacementRequirement(null);
        closePrepToolAction();
        return;
      }
      replaceToolInSet(
        prepDraft.asset.id,
        prepSelectedTool.id,
        prepReplacementId,
        prepOutgoingDestination,
        prepOutgoingDestination === 'SET' ? prepOutgoingSetId : undefined,
      );
      takeSetColor();
      setPrepCheckedIds(current => {
        const next = new Set(current);
        next.delete(prepSelectedTool.id);
        return next;
      });
      setPrepSelectedToolId(prepReplacementId);
      closePrepToolAction();
      return;
    }
    if (!prepSelectedTool) return;
    if (prepToolAction === 'SET') {
      if (!prepTargetSetId) return;
      moveTool(prepSelectedTool.id, 'SET', prepTargetSetId);
      takeSetColor();
    } else if (prepToolAction === 'SERVICE') {
      moveTool(prepSelectedTool.id, 'SERVICE');
    } else if (prepToolAction === 'STOCK') {
      moveTool(prepSelectedTool.id, 'STOCK');
    } else return;
    setAllowMissing(false);
    setPrepCheckedIds(current => {
      const next = new Set(current);
      next.delete(prepSelectedTool.id);
      return next;
    });
    setPrepSelectedToolId(null);
    closePrepToolAction();
  };
  return {
    acceptMissingWithoutAction,
    applyPrepToolAction,
    closePrepManage,
    closePrepToolAction,
    openMissingManage,
    openPrepManage,
    openPrepToolAction,
    openPreparation,
    prepAllEligibleSelected,
    prepEligibleIds,
    toggleAllPrepChecks,
    togglePrepItem,
    undoAcceptedMissing,
  };
}
