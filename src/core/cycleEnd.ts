import {parseDisplayDate} from './displayDate';
import {programTotalMinutes} from './sterilizerPrograms';
import type {ProcessLoadRecord} from '../types/domain';

/**
 * A sterilizer runs one cycle at a time: the next load goes in only once the one in it has ended. A cycle whose
 * program says how long it all lasts («· σύνολο 45 min») ends by itself at that time; any other is ended by hand
 * («Τέλος κύκλου» or «Αποτυχία κύκλου»). A simulated cycle keeps its own clock (cycleSimulator).
 */

/** The note of a cycle that ended by itself, at the end its program sets (kept in Greek, as records are). */
export const AUTO_END_NOTE = 'Αυτόματο τέλος κύκλου (διάρκεια προγράμματος)';

/**
 * When a load in the sterilizer ends by itself (epoch ms), or undefined when it is ended by hand. A load that went back
 * into the sterilizer («Επιστροφή στον κλίβανο»), however it had ended, is ended by hand from then on.
 */
export function autoEndAt(load: ProcessLoadRecord): number | undefined {
  if (load.kind !== 'STERILIZATION' || load.status !== 'OPEN' || load.simulation) return undefined;
  if (load.reopenedAt || load.note?.includes(AUTO_END_NOTE)) return undefined;
  const minutes = programTotalMinutes(load.program);
  if (!minutes) return undefined;
  if (load.startedAtMs) return load.startedAtMs + minutes * 60_000;
  // A load with only its minute: counted from the end of that minute, so the cycle is never cut short.
  const started = parseDisplayDate(load.createdAt);
  return started ? started.getTime() + 60_000 + minutes * 60_000 : undefined;
}

/** Whether a load in the sterilizer has reached the end its program sets. */
export const autoEnded = (load: ProcessLoadRecord, now = Date.now()) => {
  const end = autoEndAt(load);
  return end !== undefined && now >= end;
};

/** The cycle still running in a sterilizer (the one that must end before the next load goes in). */
export const openCycleOn = (loads: readonly ProcessLoadRecord[], equipment: string) =>
  loads.find(
    load => load.kind === 'STERILIZATION' && load.status === 'OPEN' && load.equipment.trim() === equipment.trim(),
  );
