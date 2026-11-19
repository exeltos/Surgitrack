import type {LibraryItem} from './libraries';
import {movementStamp} from './movementTime';

// Greek capitals that look like Latin ones: «Α3» typed on a Greek keyboard is the same cycle as «A3».
const GREEK_LOOKALIKES: Record<string, string> = {
  Α: 'A',
  Β: 'B',
  Ε: 'E',
  Ζ: 'Z',
  Η: 'H',
  Ι: 'I',
  Κ: 'K',
  Μ: 'M',
  Ν: 'N',
  Ο: 'O',
  Ρ: 'P',
  Τ: 'T',
  Υ: 'Y',
  Χ: 'X',
};

/** One way of writing a cycle number: «a3», «A3» and «Α3» (Greek Α) all read «A3»; no spaces. */
export function normalizeCycleNumber(value: string | undefined | null) {
  return String(value || '')
    .trim()
    .toLocaleUpperCase('el')
    .replace(/[ΆΈΉΊΌΎ]/g, c => ({Ά: 'Α', Έ: 'Ε', Ή: 'Η', Ί: 'Ι', Ό: 'Ο', Ύ: 'Υ'})[c] || c)
    .replace(/[ΑΒΕΖΗΙΚΜΝΟΡΤΥΧ]/g, c => GREEK_LOOKALIKES[c])
    .replace(/\s+/g, '');
}

/** A sterilizer's cycle letter: its own (Settings), else A, B, C… in the order the sterilizers are listed. */
export function cyclePrefixOf(sterilizer: LibraryItem | undefined, sterilizers: readonly LibraryItem[]) {
  if (!sterilizer) return '';
  const own = normalizeCycleNumber(sterilizer.cyclePrefix);
  if (own) return own;
  const index = sterilizers.findIndex(s => s.id === sterilizer.id);
  return index < 0 ? '' : index < 26 ? String.fromCharCode(65 + index) : `S${index + 1}`;
}

/** The number of a cycle written with this letter («A3» → 3), or undefined when it is written otherwise. */
export function cycleDigits(cycleNumber: string, prefix: string) {
  const value = normalizeCycleNumber(cycleNumber);
  if (!prefix || !value.startsWith(prefix)) return undefined;
  const digits = value.slice(prefix.length);
  return /^\d+$/.test(digits) ? Number(digits) : undefined;
}

const MAX_OF_DAY = 999;

/**
 * Today's cycle numbers of a sterilizer, with its letter: the ones used already and the next one (one after the
 * highest, 1 at the start of the day).
 */
export function todaysCycles(
  loads: ReadonlyArray<{equipment: string; cycleNumber: string; createdAt: string; kind?: string}>,
  equipment: string,
  prefix: string,
  now = new Date(),
) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const used = new Set<number>();
  for (const load of loads) {
    if (load.kind && load.kind !== 'STERILIZATION') continue;
    if (load.equipment !== equipment || movementStamp(load.createdAt) < start.getTime()) continue;
    const n = cycleDigits(load.cycleNumber, prefix);
    // A number of the day (A1…A999); a longer one is a device's own identifier, not one of the day's.
    if (n !== undefined && n <= MAX_OF_DAY) used.add(n);
  }
  return {used, next: used.size ? Math.max(...used) + 1 : 1};
}
