import {
  latestUndoable,
  membersUnchanged,
  restoreFields,
  undoPermission,
  type UndoRefusal,
  type UndoSnapshot,
} from '../../core/movementUndo';
import {legacySnapshot} from '../../core/legacyUndo';
import type {AssetKind, Movement} from '../../types/domain';
import {tr} from '../../i18n';
import type {useSurgiSession} from './useSurgiSession';
import type {useSurgiRecords} from './useSurgiRecords';
import type {useSurgiHelpers} from './useSurgiHelpers';

/** The movement to undo and what it changed (kept, or worked out for an older one), and whether this person may. */
export type UndoInfo = {movement: Movement; snapshot: UndoSnapshot} & ({ok: true} | {ok: false; reason: UndoRefusal});

/** Undoing a dispatch, receipt, stage or delivery made by mistake (see core/movementUndo). */
export function useUndoActions(
  p: ReturnType<typeof useSurgiSession> & ReturnType<typeof useSurgiRecords> & ReturnType<typeof useSurgiHelpers>,
) {
  const {
    addMovement,
    can,
    currentUser,
    deliveries,
    movements,
    notify,
    preparations,
    processLoads,
    receipts,
    role,
    setIssues,
    setProcessLoads,
    setRecallCases,
    setSets,
    setTools,
    sets,
    sterilizationReleases,
    sterilizationWorkflow,
    tools,
    workflowCheckpoints,
  } = p;
  const actor = () => ({
    role,
    manager: can('asset.usage.configure'),
    userId: currentUser.id,
    name: currentUser.name,
    department: currentUser.department,
  });
  const assetOf = (kind: AssetKind, id: string) =>
    kind === 'SET' ? sets.find(s => s.id === id) : tools.find(t => t.id === id);

  /** The movement this Set or instrument could have undone, and whether this person may. */
  const undoInfo = (kind: AssetKind, id: string): UndoInfo | undefined => {
    const asset = assetOf(kind, id);
    if (!asset) return undefined;
    const movement = latestUndoable(movements, asset.barcode);
    if (!movement) return undefined;
    const who = actor();
    // An older movement kept nothing: the admin and the supervisor (and a department, its own dispatch) undo
    // it as far as it can be worked out.
    const snapshot =
      movement.undo ??
      (who.manager || who.role === 'DEPARTMENT'
        ? legacySnapshot(movement, kind, id, {
            sets,
            tools,
            stages: sterilizationWorkflow.stages,
            receipts,
            deliveries,
            preparations,
            checkpoints: workflowCheckpoints,
            releases: sterilizationReleases,
          })
        : undefined);
    if (!snapshot) return undefined;
    const allowed = undoPermission(movement, asset, who, new Date(), snapshot);
    // A Set whose instruments changed since (one replaced, moved or sent to Service) is not put back.
    if (allowed.ok && !membersUnchanged(snapshot, tools)) return {movement, snapshot, ok: false, reason: 'MOVED_ON'};
    // Loaded by mistake: only out of a load whose cycle is still running, and not its only item.
    if (allowed.ok && snapshot.action === 'LOADING') {
      const load = processLoads.find(l => l.id === snapshot.loadId);
      if (!load || load.status !== 'OPEN' || !load.items.some(i => i.assetKind === kind && i.assetId === id))
        return {movement, snapshot, ok: false, reason: 'MOVED_ON'};
      if (load.items.length === 1) return {movement, snapshot, ok: false, reason: 'LAST_IN_LOAD'};
    }
    return {movement, snapshot, ...allowed};
  };

  /** Puts the Set or instrument back as it was before its latest movement, and records why. */
  const undoMovement = (kind: AssetKind, id: string, reason: string) => {
    const info = undoInfo(kind, id);
    const snapshot = info?.snapshot;
    if (!info || !info.ok || !snapshot || !reason.trim()) return false;
    const before = (k: AssetKind) => new Map(snapshot.assets.filter(a => a.kind === k).map(a => [a.id, a.before]));
    const setsBefore = before('SET');
    const toolsBefore = before('TOOL');
    setSets(list => list.map(s => (setsBefore.has(s.id) ? restoreFields(s, setsBefore.get(s.id)!) : s)));
    setTools(list => list.map(t => (toolsBefore.has(t.id) ? restoreFields(t, toolsBefore.get(t.id)!) : t)));
    // A problem the receipt reported is closed with the receipt.
    if (snapshot.issueIds?.length) {
      const opened = new Set(snapshot.issueIds);
      setIssues(list =>
        list.map(i =>
          opened.has(i.id) && i.status === 'OPEN'
            ? {...i, status: 'RESOLVED', note: `${i.note} · Αναιρέθηκε η κίνηση: ${reason.trim()}`}
            : i,
        ),
      );
    }
    // Taken out of the running sterilizer load it was put in by mistake.
    if (snapshot.action === 'LOADING' && snapshot.loadId) {
      setProcessLoads(list =>
        list.map(l =>
          l.id === snapshot.loadId
            ? {...l, items: l.items.filter(i => !(i.assetKind === kind && i.assetId === id))}
            : l,
        ),
      );
    }
    // A recalled item the receipt counted as returned is awaited again.
    if (snapshot.recall?.length) {
      const recalled = new Map(snapshot.recall.map(r => [r.caseId, r]));
      setRecallCases(cases =>
        cases.map(c =>
          recalled.has(c.id)
            ? {
                ...c,
                items: c.items.map(item =>
                  item.assetKind === snapshot.kind && item.assetId === snapshot.id
                    ? {...item, status: recalled.get(c.id)!.status, returnedAt: recalled.get(c.id)!.returnedAt}
                    : item,
                ),
              }
            : c,
        ),
      );
    }
    const m = info.movement;
    addMovement({
      asset: m.asset,
      assetKind: m.assetKind,
      from: m.to,
      to: m.from,
      status: `Αναίρεση: ${m.status}`,
      by: currentUser.name,
      note: reason.trim(),
      undoes: m.id,
      ...(snapshot.legacy && snapshot.recordId ? {cancels: snapshot.recordId} : {}),
    });
    notify(tr('Αναιρέθηκε η κίνηση του {0}.', m.asset.split(' · ')[0]));
    return true;
  };

  return {undoInfo, undoMovement};
}
