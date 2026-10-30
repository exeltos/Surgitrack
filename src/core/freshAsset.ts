import type {Movement} from '../types/domain';

const barcodeOf = (m: Movement) => m.asset.split(' · ')[0].trim().toUpperCase();

/**
 * Movements that record the asset's registration or upkeep, not its use: creating it, a new barcode, editing its
 * details, moving it into or out of a Set, replacing it, a signed count, the name check. They do not make an
 * asset used. (A uses correction does: uses were once counted.)
 */
const ADMINISTRATIVE = [
  'Δημιουργία',
  'Νέο barcode',
  'Επεξεργασία',
  'Μεταφορά εργαλείου',
  'Αφαίρεση',
  'Προσθήκη εργαλείου στη σύνθεση',
  'Αντικατάσταση',
  'Έλεγχος ονομασιών',
  'Καταμέτρηση',
  'Οριστική διαγραφή',
];
export const isAdministrative = (m: Movement) => ADMINISTRATIVE.some(prefix => m.status.startsWith(prefix));

/** The barcodes that have at least one movement of use (sent, received, delivered, stages…) in the history. */
export const barcodesWithHistory = (movements: readonly Movement[]) =>
  new Set(movements.filter(m => !isAdministrative(m)).map(barcodeOf));

type Codes = {barcode: string; legacyBarcodes?: string[]};
const hasAny = (history: ReadonlySet<string>, asset: Codes) =>
  [asset.barcode, ...(asset.legacyBarcodes || [])].some(code => history.has(code.toUpperCase()));

/**
 * A Set or instrument with a use limit that has no use counted and no movement of use in the history: new, or at
 * least never used since it was registered. One that was sent before is not (its limit may have been given later,
 * or its uses were not counted when it was sent). A member instrument travels inside its Set: the Set's movements
 * are its history too (`carrier`).
 */
export const isFresh = (asset: Codes & {uses?: number}, history: ReadonlySet<string>, carrier?: Codes) =>
  !(asset.uses || 0) && !hasAny(history, asset) && !(carrier && hasAny(history, carrier));

/** The same for one asset's own page, from the movement list. */
export const isFreshOnPage = (asset: Codes & {uses?: number}, movements: readonly Movement[], carrier?: Codes) =>
  isFresh(asset, barcodesWithHistory(movements), carrier);
