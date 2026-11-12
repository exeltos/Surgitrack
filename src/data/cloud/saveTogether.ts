import {
  isPermanentRefusal,
  MAX_GROUP_ROWS,
  saveRecordsTogether,
  type CloudCollection,
  type CloudRecord,
} from './appRecords';

// Told when a group reaches the server (useAppRecordSync counts it as the last time the server was reached).
let groupSaved = () => undefined as void;
export const onGroupSaved = (listener: () => void) => {
  groupSaved = listener;
};

/**
 * Records saved together (S5). An action whose records must reach the server all or none (a load's release,
 * a delivery) runs inside saveTogether: every collection it changes joins one group, and the group goes to the
 * database in one transaction (save_records_together). Meanwhile each collection's own flush leaves those
 * records alone. If the group cannot be saved that way (the database does not have the function yet, refuses
 * it, or cannot be reached), its records are handed back to each collection's flush, which saves them as it
 * always has, with its retries, merges and refusals.
 */
export type GroupMember = {
  organizationId: string;
  collection: CloudCollection;
  /** The collection's unsaved records now, held from its own flush. */
  take: () => CloudRecord[];
  /**
   * The group is over: saved (the records count as saved), refused for good (every record of the group goes
   * back to the server's version, and the user hears so), or not sent (the flush takes the records back).
   */
  settle: (outcome: GroupOutcome, items: CloudRecord[]) => void;
};
export type GroupOutcome = {kind: 'saved'} | {kind: 'refused'; code: string; message: string} | {kind: 'not-sent'};
type Group = {
  members: Map<string, GroupMember>;
  /** Each collection's records as they were before the action: only what it changed joins the group. */
  before: Map<string, Set<CloudRecord>>;
};
/** How long a group takes in the collections an action changed (their sync runs once the store has them). */
const GROUP_COLLECT_MS = 300;
let collecting: Group | undefined;
/** The group an action is gathering now, if any. */
export const currentGroup = () => collecting;
// Each synced collection's current records, by hospital and collection, for the picture before an action.
export const liveCollections = new Map<string, () => readonly CloudRecord[]>();
// Records in a group on its way to the database: not sent by their collection's flush meanwhile.
export const held = new WeakSet<CloudRecord>();

const sendGroup = async (group: Group) => {
  const members = [...group.members.values()];
  if (!members.length) return;
  const organizationId = members[0].organizationId;
  const taken = members.map(member => ({
    member,
    items: member.organizationId === organizationId ? member.take() : [],
  }));
  const total = taken.reduce((sum, {items}) => sum + items.length, 0);
  let outcome: GroupOutcome = {kind: 'not-sent'};
  // One record needs no group; a very large one is saved as before, collection by collection.
  if (total > 1 && total <= MAX_GROUP_ROWS) {
    try {
      const result = await saveRecordsTogether(
        organizationId,
        taken.filter(({items}) => items.length).map(({member, items}) => ({collection: member.collection, items})),
      );
      if (result === 'saved') {
        outcome = {kind: 'saved'};
        groupSaved();
      }
    } catch (error) {
      const refusal = error as {code?: string; message?: string};
      // Refused for good (permission, invalid data, a rule of the database): none of it is kept, here either.
      // Anything else (no connection, changed on another device) is saved as before, record by record.
      if (isPermanentRefusal(refusal))
        outcome = {kind: 'refused', code: refusal.code || '', message: refusal.message || ''};
      else console.warn('SurgiTrack: saving records together failed; each is saved on its own', error);
    }
  }
  taken.forEach(({member, items}) => member.settle(outcome, items));
};

/**
 * Runs an action whose records are saved together, all or none (see GroupMember). Outside a cloud
 * workspace (Demo) the action just runs.
 */
export function saveTogether<T>(action: () => T): T {
  if (collecting) return action();
  const group: Group = {
    members: new Map(),
    before: new Map([...liveCollections].map(([key, items]) => [key, new Set(items())])),
  };
  collecting = group;
  try {
    return action();
  } finally {
    window.setTimeout(() => {
      if (collecting === group) collecting = undefined;
      void sendGroup(group);
    }, GROUP_COLLECT_MS);
  }
}

/** The action, with its records saved together whenever it runs. */
export const savedTogether =
  <A extends unknown[], R>(action: (...args: A) => R) =>
  (...args: A): R =>
    saveTogether(() => action(...args));
