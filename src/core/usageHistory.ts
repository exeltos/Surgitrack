import {movementStamp} from './movementTime';
import type {Movement, Tool} from '../types/domain';

/**
 * What an instrument's uses were on a past day, from the movements the app keeps: every correction of the uses is
 * recorded as "Διόρθωση χρήσεων · 3 → 4" with its time, and the creation of an instrument as "Δημιουργία …". The uses on
 * a day are the "after" of the last correction up to the end of that day; if every correction came later, the "before"
 * of the first one; an instrument never corrected has the uses it has now. Only the corrections are known: a use
 * changed without a movement is not in the history.
 */
export interface UsesOnDay {
  /** The day (YYYY-MM-DD). */
  day: string;
  byId: Map<string, {uses: number; existed: boolean}>;
}

const CORRECTION = /^(?:Διόρθωση χρήσεων|Uses corrected)\s*·\s*(\d+)\s*→\s*(\d+)/;
const barcodeOf = (label: string) => label.split(' · ')[0].trim().toUpperCase();

/** The end of a day (YYYY-MM-DD) as a time, local. */
export const endOfDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
};

export const usesOnDay = (tools: Tool[], movements: Movement[], day: string, now = Date.now()): UsesOnDay => {
  const cutoff = endOfDay(day);
  const corrections = new Map<string, Array<{stamp: number; from: number; to: number}>>();
  const created = new Map<string, number>();
  // The movements are kept newest first: walking them oldest first keeps corrections of the same minute in order.
  for (const m of [...movements].reverse()) {
    if (m.assetKind !== 'TOOL' || m.undoes) continue;
    const barcode = barcodeOf(m.asset);
    const stamp = movementStamp(m.at);
    if (!stamp) continue;
    const found = CORRECTION.exec(m.status);
    if (found) {
      const list = corrections.get(barcode) || [];
      list.push({stamp, from: Number(found[1]), to: Number(found[2])});
      corrections.set(barcode, list);
    } else if (/^(Δημιουργία|Created)/.test(m.status)) {
      created.set(barcode, Math.min(created.get(barcode) ?? Infinity, stamp));
    }
  }
  const byId = new Map<string, {uses: number; existed: boolean}>();
  for (const t of tools) {
    // The history under its earlier barcodes (edited or reissued) is its own too.
    const barcodes = [t.barcode, ...(t.legacyBarcodes || [])].map(b => b.toUpperCase());
    const list = barcodes.flatMap(b => corrections.get(b) || []).sort((a, b) => a.stamp - b.stamp);
    const madeAt = Math.min(...barcodes.map(b => created.get(b) ?? Infinity));
    const upTo = list.filter(c => c.stamp <= cutoff);
    const uses =
      cutoff >= now ? t.uses || 0 : upTo.length ? upTo[upTo.length - 1].to : list.length ? list[0].from : t.uses || 0;
    byId.set(t.id, {uses, existed: (madeAt === Infinity ? 0 : madeAt) <= cutoff});
  }
  return {day, byId};
};

/** 2026-11-01 → 1/11/2026 */
export const dayLabel = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return `${d}/${m}/${y}`;
};
