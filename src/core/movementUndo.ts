import type {AssetKind, AssetState, Movement, RecallItemStatus, SetAsset, Tool} from '../types/domain';
import {movementStamp} from './movementTime';

/**
 * Undoing a wrong movement: a Set sent to Sterilization, received, delivered, or moved through a stage of
 * Sterilization (washing, preparation, packaging and the other checks, loading into a running sterilizer) by
 * mistake. A sterilizer cycle and a release are not undone: a load is recalled instead.
 *
 * The movement keeps what it changed as it was before ("undo"): the Set's or instrument's state, uses and
 * sterile dates, and its instruments' (a use counted, one taken out of use at its limit). Undoing puts that
 * back and records a new movement that names the one it undoes; nothing is deleted from the history.
 */

export type UndoAction =
  | 'DISPATCH'
  | 'RECEIPT'
  | 'DELIVERY'
  /** A stage of Sterilization completed (a washer load, preparation, packaging or another check). */
  | 'STAGE'
  /** Loaded into a sterilizer whose cycle is still running. */
  | 'LOADING';

/** The fields an undoable movement may change, kept as they were before it (null: was empty). */
const UNDO_FIELDS = [
  'state',
  'uses',
  'actual',
  'sterileUntil',
  'sterilizedOn',
  'sterilizedTime',
  'retiredAt',
  'retiredReason',
  'setId',
  'mode',
  'department',
  'shelfLifeMonths',
] as const;

type Fields = Partial<Record<(typeof UNDO_FIELDS)[number], unknown>>;

export type UndoSnapshot = {
  action: UndoAction;
  kind: AssetKind;
  id: string;
  /** Its state right after the movement: once it has moved on, the movement is no longer undone. */
  after: AssetState;
  /** A use was counted (only who may correct uses can take it back). */
  usesCounted: boolean;
  /** Problem reports the movement opened (closed when it is undone). */
  issueIds?: string[];
  /** The record it wrote (receipt, delivery, preparation, stage check): left out of reports once undone. */
  recordId?: string;
  /** The stage it completed, as the screens name it. */
  stage?: string;
  /** The running sterilizer load it was put in. */
  loadId?: string;
  /** Worked out for an older movement that kept nothing (core/legacyUndo): its uses stay as they are. */
  legacy?: boolean;
  /** Recall items the receipt marked as returned, as they were (put back when it is undone). */
  recall?: Array<{caseId: string; status: RecallItemStatus; returnedAt?: string}>;
  assets: Array<{kind: AssetKind; id: string; before: Fields}>;
};

const pick = (record: object): Fields => {
  const source = record as Record<string, unknown>;
  const fields: Fields = {};
  for (const field of UNDO_FIELDS) fields[field] = source[field] ?? null;
  return fields;
};

/** The Set (with its instruments) or the instrument as it is before a movement. */
export function takeSnapshot(
  action: UndoAction,
  kind: AssetKind,
  id: string,
  sets: readonly SetAsset[],
  tools: readonly Tool[],
  extra: {
    after: AssetState;
    usesCounted?: boolean;
    issueIds?: string[];
    recordId?: string;
    recall?: UndoSnapshot['recall'];
    stage?: string;
    loadId?: string;
  },
): UndoSnapshot {
  const assets: UndoSnapshot['assets'] = [];
  if (kind === 'SET') {
    const set = sets.find(s => s.id === id);
    if (set) assets.push({kind: 'SET', id, before: pick(set)});
    for (const tool of tools) if (tool.setId === id) assets.push({kind: 'TOOL', id: tool.id, before: pick(tool)});
  } else {
    const tool = tools.find(t => t.id === id);
    if (tool) assets.push({kind: 'TOOL', id, before: pick(tool)});
  }
  return {
    action,
    kind,
    id,
    after: extra.after,
    usesCounted: !!extra.usesCounted,
    ...(extra.issueIds?.length ? {issueIds: extra.issueIds} : {}),
    ...(extra.recordId ? {recordId: extra.recordId} : {}),
    ...(extra.recall?.length ? {recall: extra.recall} : {}),
    ...(extra.stage ? {stage: extra.stage} : {}),
    ...(extra.loadId ? {loadId: extra.loadId} : {}),
    assets,
  };
}

/** A record with the snapshot's fields put back (an empty one is removed). */
export function restoreFields<T extends object>(record: T, before: Fields): T {
  const next = {...record} as Record<string, unknown>;
  for (const [field, value] of Object.entries(before)) {
    if (value === null || value === undefined) delete next[field];
    else next[field] = value;
  }
  return next as T;
}

const barcodeOf = (label: string) => label.split(' · ')[0].trim().toUpperCase();

/** The movements undone: the ones an undo entry names, and what they caused (marked «Αναιρέθηκε»). */
export function undoneIds(movements: readonly Movement[]): Set<string> {
  const undone = new Set(movements.map(m => m.undoes).filter((id): id is string => !!id));
  for (const m of movements) if (m.causedBy && undone.has(m.causedBy)) undone.add(m.id);
  return undone;
}

/**
 * The movement that could be undone for this Set or instrument: its latest one, leaving out undo entries,
 * movements already undone and the ones recorded as another's consequence. Whether it can be (it kept what
 * it changed, or it is an older one core/legacyUndo works out) is the caller's to decide.
 */
export function latestUndoable(movements: readonly Movement[], barcode: string): Movement | undefined {
  const undone = undoneIds(movements);
  const own = movements
    .map((m, index) => ({m, index, stamp: movementStamp(m.at)}))
    .filter(({m}) => barcodeOf(m.asset) === barcode.toUpperCase() && !m.undoes && !m.causedBy && !undone.has(m.id))
    .sort((a, b) => b.stamp - a.stamp || a.index - b.index);
  return own[0]?.m;
}

export type UndoActor = {
  role: string;
  /** May correct uses (hospital admin, Sterilization supervisor, platform owner). */
  manager: boolean;
  userId: string;
  name: string;
  department: string;
};

/**
 * Whether the Set's instruments are still the ones the movement left: none added or taken out since (an
 * instrument replaced, moved or sent to Service), each where the movement put it. Otherwise putting the
 * snapshot back would undo those changes too.
 */
export function membersUnchanged(snapshot: UndoSnapshot, tools: readonly Tool[]): boolean {
  if (snapshot.kind !== 'SET') return true;
  const kept = new Map(snapshot.assets.filter(a => a.kind === 'TOOL').map(a => [a.id, a.before]));
  // An instrument that joined the Set since.
  if (tools.some(t => t.setId === snapshot.id && !kept.has(t.id))) return false;
  for (const [id, before] of kept) {
    const tool = tools.find(t => t.id === id);
    if (!tool) return false;
    if (tool.setId === snapshot.id) {
      if (tool.mode !== before.mode || tool.state !== snapshot.after) return false;
    } else if (!(snapshot.usesCounted && tool.state === 'RETIRED')) {
      // Out of the Set: only the dispatch's own taking out of use at the limit.
      return false;
    }
  }
  return true;
}

/** The records (receipts, deliveries, preparations, stage checks) whose movement was undone: kept, not counted. */
export function cancelledRecordIds(movements: readonly Movement[]): Set<string> {
  const undone = new Set(movements.map(m => m.undoes).filter(Boolean));
  const ids = new Set<string>();
  for (const m of movements) {
    if (m.undo?.recordId && undone.has(m.id)) ids.add(m.undo.recordId);
    // An undo entry names the record itself when the movement kept nothing (an older one).
    if (m.undoes && m.cancels) ids.add(m.cancels);
  }
  return ids;
}

/** Why an undo is refused (the screen words it). */
export type UndoRefusal =
  | 'NOT_UNDOABLE'
  | 'MOVED_ON'
  | 'NOT_OWN'
  | 'NOT_TODAY'
  | 'USE_COUNTED'
  | 'NO_RIGHT'
  /** The only item of its running load: the cycle is ended as failed instead. */
  | 'LAST_IN_LOAD';

const sameDay = (at: string, today: Date) => {
  const stamp = movementStamp(at);
  if (!stamp) return false;
  return new Date(stamp).toDateString() === today.toDateString();
};

/**
 * Whether this person may undo the movement, and why not. The admin and the supervisor undo any of them;
 * a Sterilization user their own receipts, stages and deliveries of the same day; a department its own
 * dispatch while Sterilization has not received it, when no use was counted.
 */
export function undoPermission(
  movement: Movement,
  asset: {state: string; department?: string} | undefined,
  actor: UndoActor,
  today: Date = new Date(),
  undo: UndoSnapshot | undefined = movement.undo,
): {ok: true} | {ok: false; reason: UndoRefusal} {
  if (!undo || !asset) return {ok: false, reason: 'NOT_UNDOABLE'};
  if (asset.state !== undo.after) return {ok: false, reason: 'MOVED_ON'};
  if (actor.manager) return {ok: true};
  // An older movement, worked out rather than kept, only by the admin or the supervisor.
  if (undo.legacy) return {ok: false, reason: 'NO_RIGHT'};
  if (actor.role === 'STERILIZATION') {
    if (undo.action === 'DISPATCH') return {ok: false, reason: 'NOT_OWN'};
    const own = movement.accountId
      ? movement.accountId === actor.userId
      : movement.by.split(' · ')[0].trim() === actor.name;
    if (!own) return {ok: false, reason: 'NOT_OWN'};
    if (!sameDay(movement.at, today)) return {ok: false, reason: 'NOT_TODAY'};
    return {ok: true};
  }
  if (actor.role === 'DEPARTMENT') {
    if (undo.action !== 'DISPATCH' || !actor.department || asset.department !== actor.department)
      return {ok: false, reason: 'NOT_OWN'};
    if (undo.usesCounted) return {ok: false, reason: 'USE_COUNTED'};
    return {ok: true};
  }
  return {ok: false, reason: 'NO_RIGHT'};
}
