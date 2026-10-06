import type {BinEntry, SetAsset, Tool} from '../types/domain';

/** How long a deleted Set or instrument stays in the bin. */
export const BIN_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;

const stamp = () => `bin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function binEntryForSet(
  set: SetAsset,
  members: readonly Tool[],
  toolsDeleted: boolean,
  by: string,
  now = new Date(),
): BinEntry {
  return {
    id: stamp(),
    kind: 'SET',
    label: `${set.barcode} · ${set.name}`,
    detail: toolsDeleted
      ? `${members.length} εργαλεία διαγράφηκαν μαζί`
      : `${members.length} εργαλεία μεταφέρθηκαν στο Απόθεμα`,
    payload: {set, tools: [...members], toolsDeleted},
    deletedAt: now.toISOString(),
    deletedByName: by,
  };
}

export function binEntryForTool(tool: Tool, parentSet: SetAsset | undefined, by: string, now = new Date()): BinEntry {
  return {
    id: stamp(),
    kind: 'TOOL',
    label: `${tool.barcode} · ${tool.name}`,
    detail: parentSet ? `Από το Σετ ${parentSet.barcode}` : undefined,
    payload: {tools: [tool], toolsDeleted: true, parentSetId: parentSet?.id},
    deletedAt: now.toISOString(),
    deletedByName: by,
  };
}

export const expiresAt = (entry: BinEntry) => new Date(new Date(entry.deletedAt).getTime() + BIN_DAYS * DAY);
export const isExpired = (entry: BinEntry, now = new Date()) => expiresAt(entry).getTime() <= now.getTime();
export const daysLeft = (entry: BinEntry, now = new Date()) =>
  Math.max(0, Math.ceil((expiresAt(entry).getTime() - now.getTime()) / DAY));

export type RestorePlan =
  | {ok: false; reason: 'SET_EXISTS' | 'TOOL_EXISTS'; barcode: string}
  | {
      ok: true;
      /** The Set to put back (with its instrument count), if the entry is a Set. */
      set?: SetAsset;
      /** Instruments to add: deleted ones coming back. */
      add: Tool[];
      /** Instruments that still exist and return to the Set they were taken from (by id). */
      revert: Tool[];
      /** Instruments that could not come back (their barcode is used, or they work elsewhere now). */
      skipped: string[];
      /** An instrument rejoining a Set that still exists adds one to its count. */
      setCountDelta?: {setId: string; delta: number};
    };

const sameBarcode = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase();

/**
 * What undoing a deletion does given what exists now: a Set returns with its instruments (deleted ones
 * are added back; ones moved to Stock return if they are still idle there); one instrument returns to
 * its Set if that still exists, otherwise to Stock. Nothing overwrites a Set or instrument that exists.
 */
export function planRestore(
  entry: BinEntry,
  current: {sets: readonly SetAsset[]; tools: readonly Tool[]},
): RestorePlan {
  const {payload} = entry;
  const taken = (tool: Tool) =>
    current.tools.some(t => t.id === tool.id || sameBarcode(t.barcode, tool.barcode)) ||
    current.sets.some(s => sameBarcode(s.barcode, tool.barcode));

  if (entry.kind === 'TOOL') {
    const tool = payload.tools[0];
    if (!tool) return {ok: false, reason: 'TOOL_EXISTS', barcode: ''};
    if (taken(tool)) return {ok: false, reason: 'TOOL_EXISTS', barcode: tool.barcode};
    const parent = payload.parentSetId ? current.sets.find(s => s.id === payload.parentSetId) : undefined;
    const back: Tool = parent
      ? {...tool, mode: 'SET_MEMBER', setId: parent.id, department: parent.department, state: parent.state}
      : {...tool, mode: 'STOCK', setId: undefined, department: undefined, state: 'IN_STOCK'};
    return {
      ok: true,
      add: [back],
      revert: [],
      skipped: [],
      setCountDelta: parent ? {setId: parent.id, delta: 1} : undefined,
    };
  }

  const set = payload.set;
  if (!set) return {ok: false, reason: 'SET_EXISTS', barcode: ''};
  if (current.sets.some(s => s.id === set.id || sameBarcode(s.barcode, set.barcode)))
    return {ok: false, reason: 'SET_EXISTS', barcode: set.barcode};
  const add: Tool[] = [];
  const revert: Tool[] = [];
  const skipped: string[] = [];
  for (const member of payload.tools) {
    if (payload.toolsDeleted) {
      if (taken(member)) skipped.push(member.barcode);
      else add.push(member);
      continue;
    }
    const now = current.tools.find(t => t.id === member.id);
    // Moved to Stock with the Set's deletion: it returns only if it is still idle there.
    if (now && now.mode === 'STOCK' && now.state === 'IN_STOCK' && !now.setId) revert.push(member);
    else skipped.push(member.barcode);
  }
  return {ok: true, set: {...set, actual: add.length + revert.length}, add, revert, skipped};
}

export function binEntryForLibraryItem(
  key: string,
  item: Record<string, unknown> & {el?: string; en?: string},
  by: string,
  now = new Date(),
): BinEntry {
  return {
    id: stamp(),
    kind: 'LIBRARY',
    label: String(item.el || item.en || item.id),
    detail: key,
    payload: {tools: [], toolsDeleted: false, library: {key, item}},
    deletedAt: now.toISOString(),
    deletedByName: by,
  };
}

export function binEntryForColorTape(
  tape: Record<string, unknown> & {el?: string},
  by: string,
  now = new Date(),
): BinEntry {
  return {
    id: stamp(),
    kind: 'COLOR_TAPE',
    label: String(tape.el || tape.id),
    payload: {tools: [], toolsDeleted: false, colorTape: tape},
    deletedAt: now.toISOString(),
    deletedByName: by,
  };
}

export function binEntryForDevice(
  device: Record<string, unknown> & {name?: string},
  readings: Record<string, unknown>[],
  readingsTotal: number,
  by: string,
  now = new Date(),
): BinEntry {
  return {
    id: stamp(),
    kind: 'DEVICE',
    label: String(device.name || device.id),
    detail: `${readingsTotal} κύκλοι`,
    payload: {tools: [], toolsDeleted: false, device: {device, readings, readingsTotal}},
    deletedAt: now.toISOString(),
    deletedByName: by,
  };
}

/** Turns a draft from outside the store into an entry. */
export const entryFromDraft = (draft: Omit<BinEntry, 'id' | 'deletedByName'>, by: string): BinEntry => ({
  ...draft,
  id: stamp(),
  deletedByName: by,
});
