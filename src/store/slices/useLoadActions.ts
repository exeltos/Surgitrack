import {useEffect, useRef} from 'react';
import {loadLabel} from '../../core/loadLabel';
import type {
  AssetKind,
  AssetState,
  DeliveryRecord,
  SterilizationCycleRecord,
  WorkflowCheckpointRecord,
  ProcessLoadRecord,
} from '../../types/domain';
import {formatStoreDateTime, uniqueStamp} from '../helpers';
import {demoSigned} from '../../data/cloud/handover';
import type {CreateProcessLoadPayload, DeliveryPayload, WorkflowCheckpointPayload} from '../types';
import {workflowStageState} from '../../core/workflow';
import {
  buildCycleData,
  curve,
  DEFAULT_SPEED,
  elapsedMinutes,
  evaluate,
  isFinished,
  planFor,
  ranMinutes,
  type SimRun,
  type SimScenario,
} from '../../core/cycleSimulator';
import {formatDateTime} from '../../core/displayDate';
import {useHasModule} from '../../data/cloud/modulesContext';
import {savedTogether} from '../../data/cloud/useAppRecordSync';
import {useLibraries} from '../../core/LibraryStore';
import {testsState} from '../../core/equipmentTests';
import {sendSimulatedCycle, simulatedDeviceName} from '../../data/cloud/simulatedDevice';
import {takeSnapshot} from '../../core/movementUndo';
import {tr} from '../../i18n';
import type {useSurgiSession} from './useSurgiSession';
import type {useSurgiRecords} from './useSurgiRecords';
import type {useSurgiHelpers} from './useSurgiHelpers';
import type {useReceiptAndCycleActions} from './useReceiptAndCycleActions';

export function useLoadActions(
  p: ReturnType<typeof useSurgiSession> &
    ReturnType<typeof useSurgiRecords> &
    ReturnType<typeof useSurgiHelpers> &
    ReturnType<typeof useReceiptAndCycleActions>,
) {
  // A simulated cycle is also reported to the connected devices (device-ingest) where the hospital has them.
  const withDevices = useHasModule('DEVICES');
  // Equipment taken out of service (a breakdown, maintenance) is not loaded.
  const {sterilizers: sterilizerList, washers: washerList} = useLibraries();
  const {
    addMovement,
    assertCirculationAllowed,
    assetName,
    currentUser,
    nextStateAfter,
    notify,
    processLoads,
    reprocessState,
    setDeliveries,
    setProcessLoads,
    setSterilizationCycles,
    setTools,
    setWorkflowCheckpoints,
    sets,
    sterilizationWorkflow,
    tools,
    updateState,
    chooseShelfLife,
  } = p;
  // A load in a notice: its sterilizer and cycle, not its id (see loadLabel).
  const named = (loadId: string) => {
    const load = processLoads.find(item => item.id === loadId);
    return load ? `«${loadLabel(load)}»` : loadId;
  };

  const createProcessLoad = (payload: CreateProcessLoadPayload) => {
    const expectedState: AssetState = payload.kind === 'WASHING' ? 'IN_WASHING' : 'IN_STERILIZATION';
    const outOfService = (payload.kind === 'WASHING' ? washerList : sterilizerList).find(
      item => item.el === payload.equipment.trim() && item.outOfService,
    );
    if (outOfService) {
      notify(tr('Ο εξοπλισμός «{0}» είναι εκτός λειτουργίας.', outOfService.el), true);
      return;
    }
    // A sterilizer or washer whose latest test failed is not loaded until a passing one is recorded.
    const washing = payload.kind === 'WASHING';
    const failedTest = (washing ? washerList : sterilizerList).find(
      item =>
        item.el === payload.equipment.trim() &&
        testsState(item.tests, Date.now(), washing ? 'WASHER' : 'STERILIZER') === 'FAILED',
    );
    if (failedTest) {
      notify(
        washing
          ? tr('Το πλυντήριο «{0}» έχει αποτυχημένη δοκιμή: καταγράψτε επιτυχή δοκιμή για να φορτωθεί.', failedTest.el)
          : tr('Ο κλίβανος «{0}» έχει αποτυχημένη δοκιμή: καταγράψτε επιτυχή δοκιμή για να φορτωθεί.', failedTest.el),
        true,
      );
      return;
    }
    const refs = payload.assetRefs
      .map(ref => ({ref, asset: assetName(ref.kind, ref.id)}))
      .filter(
        (entry): entry is {ref: {kind: AssetKind; id: string}; asset: NonNullable<ReturnType<typeof assetName>>} =>
          !!entry.asset && entry.asset.state === expectedState,
      );
    if (!refs.length) {
      notify(tr('Δεν επιλέχθηκαν έγκυρα αντικείμενα για το φορτίο.'), true);
      return;
    }
    const loadId = `L${uniqueStamp()}`;
    const items = refs.map(({ref, asset}) => ({
      assetId: ref.id,
      assetKind: ref.kind,
      barcode: asset.barcode,
      assetName: asset.name,
      department: asset.department || 'Τμήμα',
    }));
    const now = formatStoreDateTime();
    if (payload.kind === 'WASHING') {
      const washFailed = payload.washResult === 'FAIL';
      const washValues = {
        ...(payload.washTemperature !== undefined ? {washTemperature: payload.washTemperature} : {}),
        ...(payload.washA0 !== undefined ? {washA0: payload.washA0} : {}),
      };
      if (washFailed) {
        // A failed wash moves nothing on: the items stay in the washing stage to go through the washer again.
        refs.forEach(({ref, asset}) =>
          addMovement({
            asset: `${asset.barcode} · ${asset.name}`,
            assetKind: ref.kind,
            from: 'Καθαρισμός',
            to: 'Καθαρισμός',
            status: `Φορτίο πλυντηρίου ${loadId} · ${payload.equipment} · ${payload.cycleNumber} · ΑΠΟΤΥΧΙΑ`,
            by: currentUser.name,
          }),
        );
        const failed: ProcessLoadRecord = {
          id: loadId,
          workflowVersion: sterilizationWorkflow.version,
          kind: 'WASHING',
          equipment: payload.equipment,
          cycleNumber: payload.cycleNumber,
          program: payload.program,
          status: 'FAILED',
          items,
          ...washValues,
          note: payload.note,
          createdByUserId: currentUser.id,
          createdByName: currentUser.name,
          createdAt: now,
          completedAt: now,
        };
        setProcessLoads(list => [failed, ...list]);
        notify(
          tr('Το φορτίο {0} απέτυχε: τα αντικείμενα μένουν στον καθαρισμό για νέα πλύση.', `«${loadLabel(payload)}»`),
          true,
        );
        return failed;
      }
      const stage = sterilizationWorkflow.stages.find(stage => stage.id === 'WASHING');
      refs.forEach(({ref, asset}) => {
        const checkpoint: WorkflowCheckpointRecord = {
          id: `wc${uniqueStamp()}-${ref.id}`,
          workflowVersion: sterilizationWorkflow.version,
          assetId: ref.id,
          assetKind: ref.kind,
          barcode: asset.barcode,
          assetName: asset.name,
          department: asset.department || 'Τμήμα',
          stageId: 'WASHING',
          checks: (stage?.checksEl || []).map(() => true),
          note: `Φορτίο ${loadId} · ${payload.equipment} · κύκλος ${payload.cycleNumber}${payload.note ? ` · ${payload.note}` : ''}`,
          completedByUserId: currentUser.id,
          completedByName: currentUser.name,
          completedByDepartment: currentUser.department,
          completedAt: now,
        };
        // As it is before, so that an item washed by mistake can be undone (the load itself stays recorded).
        const undo = takeSnapshot('STAGE', ref.kind, ref.id, sets, tools, {
          after: nextStateAfter('WASHING') as AssetState,
          recordId: checkpoint.id,
          stage: stage?.labelEl || 'Καθαρισμός',
        });
        setWorkflowCheckpoints(list => [checkpoint, ...list]);
        updateState(ref.kind, ref.id, nextStateAfter('WASHING'));
        addMovement({
          asset: `${asset.barcode} · ${asset.name}`,
          assetKind: ref.kind,
          from: 'Καθαρισμός',
          to:
            sterilizationWorkflow.stages.find(s => workflowStageState[s.id] === nextStateAfter('WASHING'))?.labelEl ||
            'Επόμενο στάδιο',
          status: `Φορτίο πλυντηρίου ${loadId} · ${payload.equipment} · ${payload.cycleNumber} · ${payload.program}`,
          by: currentUser.name,
          undo,
        });
      });
      const record: ProcessLoadRecord = {
        id: loadId,
        workflowVersion: sterilizationWorkflow.version,
        kind: 'WASHING',
        equipment: payload.equipment,
        cycleNumber: payload.cycleNumber,
        program: payload.program,
        status: 'PASSED',
        items,
        ...washValues,
        note: payload.note,
        createdByUserId: currentUser.id,
        createdByName: currentUser.name,
        createdAt: now,
        completedAt: now,
      };
      setProcessLoads(list => [record, ...list]);
      notify(tr('Το φορτίο {0} ολοκληρώθηκε για {1} αντικείμενα.', `«${loadLabel(payload)}»`, items.length));
      return record;
    }
    // A load stays "in the sterilizer" until its cycle ends; a cycle taken from a connected device has ended.
    const deviceFailed = payload.chemicalIndicatorResult === 'FAIL';
    const running = !deviceFailed && !payload.cycleCompleted;
    const record: ProcessLoadRecord = {
      id: loadId,
      workflowVersion: sterilizationWorkflow.version,
      kind: 'STERILIZATION',
      equipment: payload.equipment,
      cycleNumber: payload.cycleNumber,
      program: payload.program,
      status: running ? 'OPEN' : deviceFailed ? 'FAILED' : 'AWAITING_RELEASE',
      items,
      chemicalIndicatorResult: payload.chemicalIndicatorResult,
      biologicalIndicatorResult: payload.biologicalIndicatorResult,
      note: payload.note,
      createdByUserId: currentUser.id,
      createdByName: currentUser.name,
      createdAt: now,
      ...(running ? {} : {completedAt: now}),
    };
    setProcessLoads(list => [record, ...list]);
    if (running) {
      refs.forEach(({ref, asset}) =>
        addMovement({
          asset: `${asset.barcode} · ${asset.name}`,
          assetKind: ref.kind,
          from: 'Φόρτωση',
          to: 'Στον κλίβανο',
          status: `Φορτίο ${loadId} · ${payload.equipment} · κύκλος ${payload.cycleNumber} · σε εξέλιξη`,
          by: currentUser.name,
          // Taken out of the running load if it was loaded by mistake (its state does not change).
          undo: takeSnapshot('LOADING', ref.kind, ref.id, sets, tools, {after: 'IN_STERILIZATION', loadId}),
        }),
      );
      notify(
        tr('Το φορτίο {0} μπήκε στον κλίβανο {1}.', `«${tr('κύκλος {0}', payload.cycleNumber)}»`, payload.equipment),
      );
      return record;
    }
    recordCycleResult(record, refs, deviceFailed ? 'FAILED' : 'PASSED', now);
    notify(
      deviceFailed
        ? tr('Το φορτίο {0} απέτυχε και επέστρεψε σε επανεπεξεργασία.', `«${loadLabel(payload)}»`)
        : tr('Το φορτίο {0} ολοκληρώθηκε και αναμένει αποδέσμευση.', `«${loadLabel(payload)}»`),
      deviceFailed,
    );
    return record;
  };
  type LoadRef = {ref: {kind: AssetKind; id: string}; asset: NonNullable<ReturnType<typeof assetName>>};
  /** The end of a sterilizer cycle: one cycle record per item; a passed cycle goes on to release. */
  const recordCycleResult = (load: ProcessLoadRecord, refs: LoadRef[], result: 'PASSED' | 'FAILED', now: string) => {
    refs.forEach(({ref, asset}, index) => {
      const toolIds = ref.kind === 'SET' ? tools.filter(t => t.setId === ref.id).map(t => t.id) : [ref.id];
      const cycle: SterilizationCycleRecord = {
        id: `sc${uniqueStamp()}-${index}`,
        workflowVersion: sterilizationWorkflow.version,
        loadId: load.id,
        assetId: ref.id,
        assetKind: ref.kind,
        barcode: asset.barcode,
        assetName: asset.name,
        department: asset.department || 'Τμήμα',
        sterilizer: load.equipment,
        cycleNumber: load.cycleNumber,
        program: load.program,
        indicatorResult: load.chemicalIndicatorResult || 'NOT_RECORDED',
        result,
        note: load.note,
        completedByUserId: currentUser.id,
        completedByName: currentUser.name,
        completedByDepartment: currentUser.department,
        completedAt: now,
        toolIds,
      };
      setSterilizationCycles(list => [cycle, ...list]);
      if (result === 'PASSED') {
        setTools(list =>
          list.map(tool =>
            toolIds.includes(tool.id) ? {...tool, sterilizations: (tool.sterilizations || 0) + 1} : tool,
          ),
        );
        // A sterilizer load always goes on to load release (indicators and approval).
        updateState(ref.kind, ref.id, 'AWAITING_RELEASE');
      } else updateState(ref.kind, ref.id, reprocessState());
      addMovement({
        asset: `${asset.barcode} · ${asset.name}`,
        assetKind: ref.kind,
        from: 'Στον κλίβανο',
        to: result === 'PASSED' ? 'Αποδέσμευση' : 'Επανεπεξεργασία',
        status: `Φορτίο ${load.id} · ${load.equipment} · ${load.cycleNumber} · ${result === 'PASSED' ? 'επιτυχές' : 'ΑΠΟΤΥΧΙΑ'}`,
        by: currentUser.name,
      });
    });
  };
  /** Starts a simulated cycle in a load that is in the sterilizer (Demo): its readings follow the clock. */
  const startCycleSimulation = (loadId: string, scenario: SimScenario) => {
    const load = processLoads.find(item => item.id === loadId && item.kind === 'STERILIZATION');
    if (!load || load.status !== 'OPEN' || load.simulation) return;
    const run: SimRun = {scenario, startedAt: Date.now(), speed: DEFAULT_SPEED};
    setProcessLoads(list => list.map(item => (item.id === loadId ? {...item, simulation: run} : item)));
    notify(tr('Ξεκίνησε η προσομοίωση του κύκλου {0}.', named(loadId)));
  };
  /** "End of cycle" for a load in the sterilizer: it goes to release, or back to reprocessing if it failed. */
  const finishProcessLoad = (loadId: string, result: 'PASSED' | 'FAILED', note?: string) => {
    const load = processLoads.find(item => item.id === loadId && item.kind === 'STERILIZATION');
    if (!load || load.status !== 'OPEN') return;
    // A simulated cycle that is still running cannot be ended as passed (stopping it is a failure).
    const run = load.simulation;
    const plan = planFor(load.program);
    if (run && result === 'PASSED' && !isFinished(run, plan, Date.now())) {
      notify(tr('Ο κύκλος του φορτίου {0} τρέχει ακόμα.', named(loadId)), true);
      return;
    }
    const refs = load.items
      .map(item => ({ref: {kind: item.assetKind, id: item.assetId}, asset: assetName(item.assetKind, item.assetId)}))
      .filter((entry): entry is LoadRef => !!entry.asset && entry.asset.state === 'IN_STERILIZATION');
    const now = formatStoreDateTime();
    const finished: ProcessLoadRecord = {
      ...load,
      status: result === 'PASSED' ? 'AWAITING_RELEASE' : 'FAILED',
      note: [load.note, note?.trim()].filter(Boolean).join(' · ') || undefined,
      completedAt: now,
      ...(run
        ? {
            cycleData: buildCycleData(
              load.program,
              run.scenario,
              formatDateTime(run.startedAt),
              now,
              elapsedMinutes(run, Date.now()),
            ),
          }
        : {}),
    };
    recordCycleResult(finished, refs, result, now);
    setProcessLoads(list => list.map(item => (item.id === loadId ? finished : item)));
    const organizationId = p.cloud?.organizationId;
    if (run && finished.cycleData && organizationId && withDevices) {
      const data = finished.cycleData;
      // The cycle's own length: the clock keeps running after it ends, so «Τέλος κύκλου» pressed later (even the
      // next day) must not make the cycle longer.
      const minutes = ranMinutes(run, plan, Date.now());
      void sendSimulatedCycle(organizationId, load.equipment, {
        cycleNumber: load.cycleNumber,
        program: load.program,
        startedAt: new Date(run.startedAt).toISOString(),
        endedAt: new Date(run.startedAt + (minutes * 60_000) / (run.speed || 1)).toISOString(),
        result: data.result,
        maxTemperature: data.maxTemperature,
        maxPressure: data.maxPressure,
        durationMinutes: Math.round(minutes),
      })
        .then(sent =>
          notify(
            sent.stored
              ? tr('Ο κύκλος στάλθηκε στη σελίδα Συσκευές ως «{0}».', simulatedDeviceName(load.equipment))
              : tr('Ο κύκλος υπήρχε ήδη στη σελίδα Συσκευές.'),
          ),
        )
        .catch(() =>
          notify(
            tr('Ο κύκλος δεν στάλθηκε στη σελίδα Συσκευές: μόνο ο διαχειριστής του νοσοκομείου μπορεί να το κάνει.'),
            true,
          ),
        );
    }
    notify(
      result === 'PASSED'
        ? tr('Ο κύκλος του φορτίου {0} τελείωσε: αναμένει αποδέσμευση.', named(loadId))
        : tr('Ο κύκλος του φορτίου {0} απέτυχε: όλο το φορτίο επιστρέφει σε επανεπεξεργασία.', named(loadId)),
      result !== 'PASSED',
    );
    return finished;
  };
  const completeWorkflowCheckpoint = (kind: AssetKind, id: string, payload: WorkflowCheckpointPayload) => {
    const a = assetName(kind, id);
    if (!a) return;
    const stage = sterilizationWorkflow.stages.find(s => s.id === payload.stageId);
    if (!stage) return;
    // Washing goes through a washer load; on its own only where the hospital allows it (Studio).
    if (payload.stageId === 'WASHING' && !sterilizationWorkflow.washingPolicy?.allowWithoutWasher) {
      notify(tr('{0}: ο καθαρισμός καταγράφεται με φόρτωση πλυντηρίου.', a.barcode), true);
      return;
    }
    const requiredCount = stage.checksEl.length;
    if (payload.checks.length < requiredCount || payload.checks.slice(0, requiredCount).some(value => !value)) return;
    const record: WorkflowCheckpointRecord = {
      id: `wc${uniqueStamp()}`,
      workflowVersion: sterilizationWorkflow.version,
      assetId: id,
      assetKind: kind,
      barcode: a.barcode,
      assetName: a.name,
      department: a.department || 'Τμήμα',
      stageId: payload.stageId,
      checks: payload.checks,
      note: payload.note,
      ...(payload.stageId === 'PACKAGING' && payload.shelfLifeMonths ? {shelfLifeMonths: payload.shelfLifeMonths} : {}),
      completedByUserId: currentUser.id,
      completedByName: currentUser.name,
      completedByDepartment: currentUser.department,
      completedAt: formatStoreDateTime(),
    };
    const nextState = nextStateAfter(payload.stageId);
    // As it is before, so that a stage completed by mistake can be undone.
    const undo = takeSnapshot('STAGE', kind, id, sets, tools, {
      after: nextState as AssetState,
      recordId: record.id,
      stage: stage.labelEl,
    });
    setWorkflowCheckpoints(x => [record, ...x]);
    if (payload.stageId === 'PACKAGING') chooseShelfLife(kind, id, payload.shelfLifeMonths);
    updateState(kind, id, nextState);
    addMovement({
      asset: `${a.barcode} · ${a.name}`,
      assetKind: kind,
      from: stage.labelEl,
      to: sterilizationWorkflow.stages.find(s => workflowStageState[s.id] === nextState)?.labelEl || 'Επόμενο στάδιο',
      status: `Ολοκλήρωση ελέγχου · ${stage.labelEl}`,
      by: currentUser.name,
      undo,
    });
    notify(tr('{0}: ολοκληρώθηκε το στάδιο «{1}».', a.barcode, stage.labelEl));
    return record;
  };
  const completeDeliveryToDepartment = (kind: AssetKind, id: string, payload: DeliveryPayload) => {
    const a = assetName(kind, id);
    if (!a || a.state !== 'READY_FOR_PICKUP' || !assertCirculationAllowed(kind, id)) return;
    const deliverer = payload.deliveredBy || {
      userId: currentUser.id,
      name: currentUser.name,
      department: currentUser.department,
    };
    const record: DeliveryRecord = {
      id: `d${uniqueStamp()}-${Math.random().toString(36).slice(2, 6)}`,
      workflowVersion: sterilizationWorkflow.version,
      batchId: payload.batchId,
      assetId: id,
      assetKind: kind,
      barcode: a.barcode,
      assetName: a.name,
      department: a.department || 'Τμήμα',
      deliveredByUserId: deliverer.userId,
      deliveredByName: deliverer.name,
      deliveredByDepartment: deliverer.department,
      handoverSignatureId: payload.handoverSignatureId,
      // The Demo's sample people sign in the app (no server signature): their signature counts as confirmed.
      // The other party: the receiver, or the deliverer when the department records the pickup itself.
      counterpartyVerified: demoSigned(
        deliverer.userId !== currentUser.id ? deliverer.userId : payload.receivedByUserId,
        payload.handoverSignatureId,
      ),
      receivedByUserId: payload.receivedByUserId,
      receivedByName: payload.receivedByName,
      receivedByDepartment: payload.receivedByDepartment,
      at: formatStoreDateTime(),
      note: payload.note,
    };
    // As it is before the delivery, so that a delivery made by mistake can be undone.
    const undo = takeSnapshot('DELIVERY', kind, id, sets, tools, {after: 'IN_DEPARTMENT', recordId: record.id});
    setDeliveries(x => [record, ...x]);
    updateState(kind, id, 'IN_DEPARTMENT');
    addMovement({
      asset: `${a.barcode} · ${a.name}`,
      assetKind: kind,
      from: 'Κεντρική Αποστείρωση',
      to: a.department || 'Τμήμα',
      status: `Παράδοση / παραλαβή ολοκληρώθηκε · παρέδωσε ${deliverer.name} · παρέλαβε ${payload.receivedByName}`,
      by: currentUser.name,
      undo,
    });
    notify(tr('Η παράδοση του {0} στο {1} ολοκληρώθηκε.', a.barcode, a.department || 'τμήμα'));
    return record;
  };
  // A simulated cycle ends by itself, as a connected sterilizer's does: a passed one goes on to release, one
  // that failed (pressure, an alarm) sends the load back to reprocessing. It runs wherever the person is in the
  // app, so the cycle is not left waiting for someone to open the right tab. Stopping it by hand stays possible.
  const finishRef = useRef(finishProcessLoad);
  const loadsRef = useRef(processLoads);
  useEffect(() => {
    finishRef.current = finishProcessLoad;
    loadsRef.current = processLoads;
  });
  const handled = useRef(new Set<string>());
  const simulating = processLoads.some(l => l.kind === 'STERILIZATION' && l.status === 'OPEN' && !!l.simulation);
  useEffect(() => {
    if (!simulating) return;
    const timer = window.setInterval(() => {
      for (const load of loadsRef.current) {
        const run = load.simulation;
        if (load.kind !== 'STERILIZATION' || load.status !== 'OPEN' || !run || handled.current.has(load.id)) continue;
        const plan = planFor(load.program);
        if (!isFinished(run, plan, Date.now())) continue;
        handled.current.add(load.id);
        finishRef.current(load.id, evaluate(plan, curve(plan, run.scenario)).result === 'PASS' ? 'PASSED' : 'FAILED');
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [simulating]);
  return {
    finishProcessLoad,
    startCycleSimulation,
    // All its records reach the server together, or none of them (S5).
    completeDeliveryToDepartment: savedTogether(completeDeliveryToDepartment),
    completeWorkflowCheckpoint,
    createProcessLoad,
  };
}
