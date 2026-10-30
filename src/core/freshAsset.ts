import type {Movement} from '../types/domain';

const barcodeOf = (m: Movement) => m.asset.split(' · ')[0].trim().toUpperCase();

/** The barcodes that have at least one movement (sent, received, delivered…) in the history. */
export const barcodesWithHistory = (movements: readonly Movement[]) => new Set(movements.map(barcodeOf));

/**
 * A Set or instrument with a use limit that has no use counted and no movement at all in the history: new, or
 * at least never used since it was registered. One with past movements is not (its limit may have been given
 * later, or its uses were not counted when it was sent).
 */
export const isFresh = (asset: {barcode: string; uses?: number}, history: ReadonlySet<string>) =>
  !(asset.uses || 0) && !history.has(asset.barcode.toUpperCase());
