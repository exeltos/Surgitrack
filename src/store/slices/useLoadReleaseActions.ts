import {loadLabel} from '../../core/loadLabel';
import {releaseIndicatorVerdict} from '../../core/releaseIndicators';
import {STERILE_STATES} from '../../core/sterileExpiry';
import type {
  AssetKind,
  AssetState,
  SterilizationReleaseRecord,
  ProcessLoadRecord,
  RecallCase,
} from '../../types/domain';
import {formatStoreDateTime, uniqueStamp} from '../helpers';
import type {ReleaseProcessLoadPayload} from '../types';
import {workflowStageState} from '../../core/workflow';
import {savedTogether} from '../../data/cloud/useAppRecordSync';
import {useLibraries} from '../../core/LibraryStore';
import {testsState} from '../../core/equipmentTests';
import {tr} from '../../i18n';
import type {useSurgiSession} from './useSurgiSession';
import type {useSurgiRecords} from './useSurgiRecords';
import type {useSurgiHelpers} from './useSurgiHelpers';
import type {useReceiptAndCycleActions} from './useReceiptAndCycleActions';

/**
 * Release, recall and the biological indicator of a sterilizer load (the decision on a load once its cycle ended),
 * and moving a stage's items on: split out of useLoadActions, which makes and runs the loads.
 */
export function useLoadReleaseActions(
  p: ReturnType<typeof useSurgiSession> &
    ReturnType<typeof useSurgiRecords> &
    ReturnType<typeof useSurgiHelpers> &
    ReturnType<typeof useReceiptAndCycleActions>,
) {
  // A load is not released while the latest test of its sterilizer failed.
  const {sterilizers: sterilizerList} = useLibraries();
  const {
    addMovement,
    assetName,
    currentUser,
    nextStateAfter,
    notify,
    processLoads,
    recallCases,
    reprocessState,
    setProcessLoads,
    setRecallCases,
    setSterilizationReleases,
    sterilizationCycles,
    sterilizationWorkflow,
    tools,
    updateState,
    releaseShelfLife,
  } = p;
  // A load in a notice: its sterilizer and cycle, not its id (see loadLabel).
  const named = (loadId: string) => {
    const load = processLoads.find(item => item.id === loadId);
    return load ? `«${loadLabel(load)}»` : loadId;
  };

  const releaseProcessLoad = (loadId: string, payload: ReleaseProcessLoadPayload) => {
    const load = processLoads.find(item => item.id === loadId && item.kind === 'STERILIZATION');
    if (!load || load.status !== 'AWAITING_RELEASE') return;
    const policy = sterilizationWorkflow.releasePolicy || {
      requireChemicalIndicator: false,
      biologicalIndicator: 'OPTIONAL' as const,
      allowReleaseWhileBiPending: false,
    };
    // A load is not released while the latest test of its sterilizer failed.
    const failedSterilizer = sterilizerList.find(
      item => item.el === load.equipment && testsState(item.tests) === 'FAILED',
    );
    if (payload.decision === 'RELEASED' && failedSterilizer) {
      notify(
        tr(
          'Το φορτίο {0} δεν αποδεσμεύτηκε: ο κλίβανος «{1}» έχει αποτυχημένη δοκιμή.',
          named(loadId),
          failedSterilizer.el,
        ),
        true,
      );
      return undefined;
    }
    const chemical = payload.chemicalIndicatorResult ?? (payload.chemicalIndicatorOk ? 'PASS' : 'NOT_RECORDED');
    const canRelease =
      payload.physicalParametersOk &&
      payload.packagingIntegrityOk &&
      releaseIndicatorVerdict(policy, chemical, payload.biologicalIndicatorResult).ok &&
      payload.decision === 'RELEASED';
    const decision = canRelease ? 'RELEASED' : 'REPROCESS';
    const passedCycle = (assetId: string) =>
      sterilizationCycles.find(c => c.loadId === loadId && c.assetId === assetId && c.result === 'PASSED');
    // Released only with every item's passed cycle on record: never half a load, and never a load closed while
    // items stay waiting for it.
    const noCycle = load.items.filter(item => !passedCycle(item.assetId));
    if (decision === 'RELEASED' && noCycle.length) {
      notify(
        tr(
          'Το φορτίο {0} δεν αποδεσμεύτηκε: λείπει η καταγραφή κύκλου για {1}.',
          named(loadId),
          noCycle.map(item => item.barcode).join(', '),
        ),
        true,
      );
      return undefined;
    }
    const now = formatStoreDateTime();
    load.items.forEach((item, index) => {
      const cycle = passedCycle(item.assetId);
      if (!cycle) {
        // Not released: back to reprocessing like the rest of the load (no release record without a cycle).
        updateState(item.assetKind, item.assetId, reprocessState());
        addMovement({
          asset: `${item.barcode} · ${item.assetName}`,
          assetKind: item.assetKind,
          from: 'Αποδέσμευση',
          to: 'Επανεπεξεργασία',
          status: `Μη αποδέσμευση φορτίου ${loadId} · κύκλος ${load.cycleNumber}`,
          by: currentUser.name,
        });
        return;
      }
      const shelfLife = decision === 'RELEASED' ? releaseShelfLife(item.assetKind, item.assetId) : undefined;
      const record: SterilizationReleaseRecord = {
        id: `sr${uniqueStamp()}-${index}`,
        workflowVersion: sterilizationWorkflow.version,
        loadId,
        assetId: item.assetId,
        assetKind: item.assetKind,
        barcode: item.barcode,
        assetName: item.assetName,
        department: item.department,
        cycleRecordId: cycle.id,
        cycleNumber: cycle.cycleNumber,
        sterilizer: cycle.sterilizer,
        physicalParametersOk: payload.physicalParametersOk,
        chemicalIndicatorOk: chemical === 'PASS',
        packagingIntegrityOk: payload.packagingIntegrityOk,
        biologicalIndicatorResult: payload.biologicalIndicatorResult,
        decision,
        note: payload.note,
        releasedByUserId: currentUser.id,
        releasedByName: currentUser.name,
        releasedByDepartment: currentUser.department,
        releasedAt: now,
        ...shelfLife,
      };
      setSterilizationReleases(list => [record, ...list]);
      if (shelfLife) updateState(item.assetKind, item.assetId, nextStateAfter('RELEASE'), shelfLife);
      else updateState(item.assetKind, item.assetId, reprocessState());
      addMovement({
        asset: `${item.barcode} · ${item.assetName}`,
        assetKind: item.assetKind,
        from: 'Αποδέσμευση',
        to:
          decision === 'RELEASED'
            ? sterilizationWorkflow.stages.find(s => workflowStageState[s.id] === nextStateAfter('RELEASE'))?.labelEl ||
              'Έτοιμα'
            : 'Επανεπεξεργασία',
        status: `${decision === 'RELEASED' ? 'Αποδέσμευση' : 'Μη αποδέσμευση'} φορτίου ${loadId} · κύκλος ${load.cycleNumber}`,
        by: currentUser.name,
      });
    });
    const updated: ProcessLoadRecord = {
      ...load,
      status: decision,
      physicalParametersOk: payload.physicalParametersOk,
      packagingIntegrityOk: payload.packagingIntegrityOk,
      chemicalIndicatorResult: chemical,
      biologicalIndicatorResult: payload.biologicalIndicatorResult,
      note: payload.note || load.note,
      releasedAt: now,
    };
    setProcessLoads(list => list.map(item => (item.id === loadId ? updated : item)));
    if (decision === 'RELEASED') {
      const releasedKeys = new Set(load.items.map(item => `${item.assetKind}:${item.assetId}`));
      setRecallCases(cases =>
        cases.map(recall => {
          if (recall.status !== 'OPEN') return recall;
          const items = recall.items.map(item =>
            releasedKeys.has(`${item.assetKind}:${item.assetId}`) ? {...item, status: 'CLOSED' as const} : item,
          );
          const closed = items.every(item => item.status === 'CLOSED');
          return {
            ...recall,
            items,
            status: closed ? ('CLOSED' as const) : ('OPEN' as const),
            closedAt: closed ? now : recall.closedAt,
          };
        }),
      );
    }
    notify(
      decision === 'RELEASED'
        ? tr('Το φορτίο {0} αποδεσμεύτηκε ({1} αντικείμενα).', named(loadId), load.items.length)
        : tr('Το φορτίο {0} δεν αποδεσμεύτηκε και επέστρεψε σε επανεπεξεργασία.', named(loadId)),
      decision !== 'RELEASED',
    );
    return updated;
  };
  const recallProcessLoad = (loadId: string, reason: string) => {
    const load = processLoads.find(item => item.id === loadId && item.kind === 'STERILIZATION');
    if (!load || load.status !== 'RELEASED' || !reason.trim()) return;
    if (recallCases.some(c => c.loadId === loadId && c.status === 'OPEN')) {
      notify(tr('Υπάρχει ήδη ενεργή ανάκληση για το φορτίο {0}.', named(loadId)), true);
      return;
    }
    const now = formatStoreDateTime();
    // Only what is still sterile from this load is called back; an item already sent back and in a new
    // cycle stays where it is (it is being reprocessed anyway).
    const stillSterile = (state?: AssetState) => !!state && (STERILE_STATES as readonly string[]).includes(state);
    const caseItems = load.items.map(item => {
      const asset = assetName(item.assetKind, item.assetId);
      const currentState = asset?.state || ('IN_DEPARTMENT' as AssetState);
      return {
        ...item,
        currentState,
        patientCode: asset && 'patientCode' in asset ? asset.patientCode : undefined,
        status: (currentState === 'IN_DEPARTMENT' ? 'OUTSTANDING' : 'REPROCESSING') as 'OUTSTANDING' | 'REPROCESSING',
      };
    });
    const recallCase: RecallCase = {
      id: `recall-${uniqueStamp()}`,
      loadId,
      cycleNumber: load.cycleNumber,
      sterilizer: load.equipment,
      reason: reason.trim(),
      openedAt: now,
      openedByUserId: currentUser.id,
      openedByName: currentUser.name,
      status: 'OPEN',
      items: caseItems,
    };
    setRecallCases(list => [recallCase, ...list]);
    load.items.forEach(item => {
      const asset = assetName(item.assetKind, item.assetId);
      if (!asset || !stillSterile(asset.state)) return;
      updateState(
        item.assetKind,
        item.assetId,
        asset.state === 'IN_DEPARTMENT' ? 'PENDING_STERILIZATION' : reprocessState(),
      );
      addMovement({
        asset: `${item.barcode} · ${item.assetName}`,
        assetKind: item.assetKind,
        from: asset.department || 'Κυκλοφορία',
        to: 'Ανάκληση / Επανεπεξεργασία',
        status: `ΑΝΑΚΛΗΣΗ ${recallCase.id} · φορτίο ${loadId} · ${reason.trim()}`,
        by: currentUser.name,
        patientCode: asset && 'patientCode' in asset ? asset.patientCode : undefined,
      });
    });
    setProcessLoads(list =>
      list.map(item =>
        item.id === loadId ? {...item, status: 'RECALLED', recalledAt: now, recallReason: reason.trim()} : item,
      ),
    );
    notify(
      tr('Άνοιξε η ανάκληση {0} για το φορτίο {1} ({2} αντικείμενα).', recallCase.id, named(loadId), load.items.length),
    );
  };
  /**
   * A stage the hospital turns off: what is in it moves on to the next stage it runs, so the stage's tab
   * empties and goes away. Each move is in the history.
   */
  const advanceStageItems = (fromState: AssetState, toState: AssetState, stageLabel: string) => {
    const moving = [
      ...p.sets.filter(set => set.state === fromState).map(set => ({kind: 'SET' as AssetKind, asset: set})),
      ...tools
        .filter(tool => tool.mode === 'STANDALONE' && tool.state === fromState)
        .map(tool => ({kind: 'TOOL' as AssetKind, asset: tool})),
    ];
    moving.forEach(({kind, asset}) => {
      updateState(kind, asset.id, toState);
      addMovement({
        asset: `${asset.barcode} · ${asset.name}`,
        assetKind: kind,
        from: stageLabel,
        to: sterilizationWorkflow.stages.find(s => workflowStageState[s.id] === toState)?.labelEl || toState,
        status: `Το στάδιο «${stageLabel}» απενεργοποιήθηκε`,
        by: currentUser.name,
      });
    });
    return moving.length;
  };
  /**
   * The biological indicator of a load released while it was pending: a pass is recorded on the load;
   * a failure records it and recalls the whole load.
   */
  const recordBiologicalResult = (loadId: string, result: 'PASS' | 'FAIL') => {
    const load = processLoads.find(item => item.id === loadId && item.kind === 'STERILIZATION');
    if (!load || load.status !== 'RELEASED' || load.biologicalIndicatorResult !== 'PENDING') return;
    setProcessLoads(list =>
      list.map(item => (item.id === loadId ? {...item, biologicalIndicatorResult: result} : item)),
    );
    load.items.forEach(item =>
      addMovement({
        asset: `${item.barcode} · ${item.assetName}`,
        assetKind: item.assetKind,
        from: 'Αποδέσμευση',
        to: result === 'PASS' ? 'Αποδεσμεύτηκε' : 'Ανάκληση / Επανεπεξεργασία',
        status: `Βιολογικός δείκτης ${result === 'PASS' ? 'επιτυχής' : 'ανεπιτυχής'} · φορτίο ${loadId} · κύκλος ${load.cycleNumber}`,
        by: currentUser.name,
      }),
    );
    if (result === 'FAIL') recallProcessLoad(loadId, 'Ανεπιτυχής βιολογικός δείκτης');
    else notify(tr('Ο βιολογικός δείκτης του φορτίου {0} καταγράφηκε επιτυχής.', named(loadId)));
  };
  return {
    advanceStageItems,
    recordBiologicalResult,
    recallProcessLoad,
    // All its records reach the server together, or none of them (S5).
    releaseProcessLoad: savedTogether(releaseProcessLoad),
  };
}
