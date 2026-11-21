import {parseDisplayDate} from '../../core/displayDate';
import type {
  Movement,
  ProcessLoadItem,
  ProcessLoadRecord,
  ProcessLoadStatus,
  SetAsset,
  SterilizationCycleRecord,
  Tool,
} from '../../types/domain';

/** The tone a result is shown in: ok (green), bad (red), wait (amber), or plain. */
export type Tone = 'ok' | 'bad' | 'wait' | '';

/** One sterilization cycle an item went through, from the load it was in (or an older per-item record). */
export type CycleEntry = {
  id: string;
  /** The load, when the cycle was recorded as one: opens it in «Φορτίο κλιβάνου». */
  loadId?: string;
  /** When it went into the sterilizer, and when it finished. */
  start: string;
  at: string;
  sterilizer: string;
  cycleNumber: string;
  program?: string;
  label: string;
  tone: Tone;
  /** The Set the instrument was in, when the cycle was its Set's. */
  via?: string;
  /** Who loaded it, and when the load was released. */
  by?: string;
  releasedAt?: string;
};

export const LOAD_STATUS: Record<ProcessLoadStatus, {label: string; tone: Tone}> = {
  OPEN: {label: 'Σε εξέλιξη', tone: 'wait'},
  PASSED: {label: 'Επιτυχία', tone: 'ok'},
  AWAITING_RELEASE: {label: 'Αναμονή αποδέσμευσης', tone: 'wait'},
  RELEASED: {label: 'Αποδεσμεύτηκε', tone: 'ok'},
  FAILED: {label: 'Αποτυχία', tone: 'bad'},
  REPROCESS: {label: 'Επανεπεξεργασία', tone: 'bad'},
  RECALLED: {label: 'Ανάκληση', tone: 'bad'},
};

export const time = (value: string | undefined) => parseDisplayDate(value)?.getTime() ?? 0;
export const barcodeOf = (m: Movement) => m.asset.split(' · ')[0].trim();
export const isSetAsset = (item: SetAsset | Tool): item is SetAsset => !('mode' in item);

/** The sterilization cycles an item went through, newest first: its own, or (an instrument in a Set) its Set's. */
export const cyclesOf = (
  item: SetAsset | Tool,
  sets: SetAsset[],
  processLoads: ProcessLoadRecord[],
  sterilizationCycles: SterilizationCycleRecord[],
): CycleEntry[] => {
  const inSet = !isSetAsset(item) && item.mode === 'SET_MEMBER' ? sets.find(x => x.id === item.setId) : undefined;
  const entries: CycleEntry[] = [];
  processLoads
    .filter(l => l.kind === 'STERILIZATION')
    .forEach(l => {
      const own = l.items.some(i => i.assetId === item.id || i.barcode === item.barcode);
      const viaSet = !own && !!inSet && l.items.some(i => i.assetId === inSet.id);
      if (!own && !viaSet) return;
      const status = LOAD_STATUS[l.status];
      entries.push({
        id: l.id,
        loadId: l.id,
        start: l.createdAt,
        at: l.completedAt || l.createdAt,
        sterilizer: l.equipment,
        cycleNumber: l.cycleNumber,
        program: l.program,
        label: status.label,
        tone: status.tone,
        via: viaSet ? inSet?.barcode : undefined,
        by: l.createdByName,
        releasedAt: l.releasedAt,
      });
    });
  sterilizationCycles
    .filter(c => c.assetId === item.id || c.barcode === item.barcode || c.toolIds?.includes(item.id))
    .forEach(c => {
      // Already there with its load; a record without one, by sterilizer and number on the same day (numbers come
      // back every day: A1, A2…).
      const day = (at?: string) => (at ? new Date(time(at)).toDateString() : '');
      if (
        entries.some(e =>
          c.loadId
            ? e.loadId === c.loadId
            : e.sterilizer === c.sterilizer && e.cycleNumber === c.cycleNumber && day(e.at) === day(c.completedAt),
        )
      )
        return;
      entries.push({
        id: c.id,
        // Its load, when the record has one: a later record of the same load (reopened and completed again) matches it.
        loadId: c.loadId,
        start: c.completedAt,
        at: c.completedAt,
        sterilizer: c.sterilizer,
        cycleNumber: c.cycleNumber,
        program: c.program,
        label: c.result === 'PASSED' ? 'Επιτυχία' : 'Αποτυχία',
        tone: c.result === 'PASSED' ? 'ok' : 'bad',
        via: c.barcode !== item.barcode ? c.barcode : undefined,
      });
    });
  return entries.sort((x, y) => time(y.at) - time(x.at));
};

/**
 * One round of an item: from its return to sterilization through the cycle and the delivery to its use on a patient.
 * A round closes after a use with a patient code, and a second cycle without a use between starts a new one.
 */
export type Round = {key: string; cycle?: CycleEntry; moves: Movement[]};

export const roundsOf = (moves: Movement[], cycles: CycleEntry[]): Round[] => {
  type Event = {at: number; move?: Movement; cycle?: CycleEntry};
  const events: Event[] = [
    ...moves.map(m => ({at: time(m.at), move: m})),
    ...cycles.map(c => ({at: time(c.at), cycle: c})),
  ].sort((a, b) => a.at - b.at);
  const rounds: Round[] = [];
  let current: Round | undefined;
  const close = () => {
    if (current) rounds.push(current);
    current = undefined;
  };
  events.forEach(e => {
    if (e.cycle) {
      if (current?.cycle) close();
      current ??= {key: e.cycle.id, moves: []};
      current.cycle = e.cycle;
      return;
    }
    const m = e.move!;
    // The same use recorded twice (used, then sent back with the code): it stays with the round it ended.
    const previous = rounds[rounds.length - 1];
    if (!current && m.patientCode && previous?.moves.some(x => x.patientCode === m.patientCode)) {
      previous.moves.push(m);
      return;
    }
    current ??= {key: m.id, moves: []};
    current.moves.push(m);
    if (m.patientCode) close();
  });
  close();
  return rounds.reverse();
};

/** The patient codes an item was used for in one round, in order. */
export const patientsIn = (moves: Movement[]) => [
  ...new Set(moves.map(m => m.patientCode).filter((code): code is string => !!code)),
];

/** YYYY-MM-DD → the days from today to it (negative once past). */
export const daysUntil = (isoDate: string | undefined, now = new Date()) => {
  if (!isoDate) return undefined;
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.UTC(y, m - 1, d) - today) / 86_400_000);
};

/**
 * The first patient an item of a load was used on after that load's cycle and before the item's next sterilization:
 * a use after that came from the next load, not this one. `uses` are the uses that stand (none undone).
 */
export const firstUseAfter = (
  load: ProcessLoadRecord,
  item: ProcessLoadItem,
  loads: ProcessLoadRecord[],
  uses: Movement[],
) => {
  const start = time(load.createdAt);
  const done = time(load.completedAt || load.createdAt);
  const next = Math.min(
    ...loads
      .filter(l => l.id !== load.id && time(l.createdAt) > start && l.items.some(i => i.assetId === item.assetId))
      .map(l => time(l.createdAt)),
  );
  return uses
    .filter(m => m.patientCode && barcodeOf(m) === item.barcode && time(m.at) >= done && time(m.at) < next)
    .sort((a, b) => time(a.at) - time(b.at))[0];
};
