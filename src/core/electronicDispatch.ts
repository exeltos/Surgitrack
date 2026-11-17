import type {Movement} from '../types/domain';
import {movementStamp} from './movementTime';

const DISPATCH = /^(ηλεκτρονική αποστολή|αποστολή προς αποστείρωση)/i;

/**
 * The department's latest electronic dispatch of a Set or instrument to Sterilization (who sent it and when), not
 * one undone later: what the receipt shows where the department hands over without a signature.
 */
export function electronicDispatch(movements: readonly Movement[], barcode: string) {
  const undone = new Set(movements.flatMap(m => (m.undoes ? [m.undoes] : [])));
  let latest: Movement | undefined;
  for (const m of movements) {
    if (m.undoes || undone.has(m.id) || !DISPATCH.test(m.status.trim())) continue;
    if (m.asset !== barcode && !m.asset.startsWith(`${barcode} ·`)) continue;
    if (!latest || (movementStamp(m.at) || 0) > (movementStamp(latest.at) || 0)) latest = m;
  }
  return latest ? {by: latest.by, at: latest.at, department: latest.from} : undefined;
}
