import type {Movement} from '../types/domain';
import {movementStamp} from './movementTime';

const DISPATCH = /^(ηλεκτρονική αποστολή|αποστολή προς αποστείρωση)/i;

export type Dispatch = {by: string; at: string; department: string};

/**
 * Each Set's or instrument's latest electronic dispatch to Sterilization (who sent it and when), by barcode, not
 * one undone later: what the receipt shows where the department hands over without a signature. One pass over
 * the history, so a list looks each row up instead of scanning it again.
 */
export function latestDispatches(movements: readonly Movement[]) {
  const undone = new Set<string>();
  for (const m of movements) if (m.undoes) undone.add(m.undoes);
  const latest = new Map<string, Movement>();
  for (const m of movements) {
    if (m.undoes || undone.has(m.id) || !DISPATCH.test(m.status.trim())) continue;
    const barcode = m.asset.split(' · ')[0];
    const seen = latest.get(barcode);
    // Newest first in the store: on the same minute the one seen first is the later.
    if (!seen || (movementStamp(m.at) || 0) > (movementStamp(seen.at) || 0)) latest.set(barcode, m);
  }
  const index = new Map<string, Dispatch>();
  for (const [barcode, m] of latest) index.set(barcode, {by: m.by, at: m.at, department: m.from});
  return index;
}

/** One item's latest electronic dispatch (see latestDispatches). */
export const electronicDispatch = (movements: readonly Movement[], barcode: string) =>
  latestDispatches(movements).get(barcode);
