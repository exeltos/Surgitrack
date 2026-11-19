import type {LibraryItem} from './libraries';
import {movementStamp} from './movementTime';

// Greek capitals that look like Latin ones: «A3» typed on a Latin keyboard is the same cycle as «Α3» (Greek).
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

/** A cycle number as stored and shown: capitals, no accents, no spaces («α 3» → «Α3»); Greek stays Greek. */
export function normalizeCycleNumber(value: string | undefined | null) {
  return String(value || '')
    .trim()
    .toLocaleUpperCase('el')
    .replace(/[ΆΈΉΊΌΎΏ]/g, c => ({Ά: 'Α', Έ: 'Ε', Ή: 'Η', Ί: 'Ι', Ό: 'Ο', Ύ: 'Υ', Ώ: 'Ω'})[c] || c)
    .replace(/\s+/g, '');
}

/** For comparing only: «a3», «A3» and «Α3» (Greek Α) are the same cycle. */
export function foldCycleNumber(value: string | undefined | null) {
  return normalizeCycleNumber(value).replace(/[ΑΒΕΖΗΙΚΜΝΟΡΤΥΧ]/g, c => GREEK_LOOKALIKES[c]);
}

const letterAt = (index: number) => (index >= 0 && index < 26 ? String.fromCharCode(65 + index) : '');

/** The letter a sterilizer's name ends with, as written («ΚΛΙΒΑΝΟΣ Γ» → Γ), or by its number («Κλίβανος 02» → B). */
function letterOfName(name: string) {
  const last = name.trim().split(/\s+/).pop() || '';
  if (/^\d{1,2}$/.test(last) && Number(last) > 0) return letterAt(Number(last) - 1);
  if (last.length !== 1) return '';
  const upper = normalizeCycleNumber(last);
  return /^[A-ZΑ-Ω]$/.test(upper) ? upper : '';
}

/**
 * A sterilizer's cycle letter: its own (Settings), else the letter its name ends with, as written (ΚΛΙΒΑΝΟΣ Α → Α,
 * Γ → Γ), or its number (Κλίβανος 2 → B), else A, B, C… in the order the sterilizers are listed.
 */
export function cyclePrefixOf(sterilizer: LibraryItem | undefined, sterilizers: readonly LibraryItem[]) {
  if (!sterilizer) return '';
  const own = normalizeCycleNumber(sterilizer.cyclePrefix);
  if (own) return own;
  const named = letterOfName(sterilizer.el);
  if (named) return named;
  const index = sterilizers.findIndex(s => s.id === sterilizer.id);
  return index < 0 ? '' : letterAt(index) || `S${index + 1}`;
}

/** The number of a cycle written with this letter («Α3», «a3» → 3), or undefined when it is written otherwise. */
export function cycleDigits(cycleNumber: string, prefix: string) {
  const value = foldCycleNumber(cycleNumber);
  const letter = foldCycleNumber(prefix);
  if (!letter || !value.startsWith(letter)) return undefined;
  const digits = value.slice(letter.length);
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
