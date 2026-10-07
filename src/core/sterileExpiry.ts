/**
 * Sterile shelf life: chosen at Packaging & Labelling (2, 3 or 6 months, the hospital default otherwise),
 * counted from the release date. A Set or instrument is "expiring" in its last month (the last 10 days for
 * a 2-month shelf life) and "expired" after the date. On expiry the app only warns and lists it.
 */
export const SHELF_LIFE_OPTIONS = [2, 3, 6] as const;
export type ShelfLifeMonths = (typeof SHELF_LIFE_OPTIONS)[number];
export const DEFAULT_SHELF_LIFE: ShelfLifeMonths = 6;

export const isShelfLife = (value: unknown): value is ShelfLifeMonths =>
  SHELF_LIFE_OPTIONS.includes(value as ShelfLifeMonths);

const pad = (n: number) => String(n).padStart(2, '0');
/** A local date as YYYY-MM-DD. */
export const isoDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** The day `months` after `from` (the 31st of a shorter month falls on its last day). */
export function sterileUntil(from: Date, months: number): string {
  const target = new Date(from.getFullYear(), from.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(from.getDate(), lastDay));
  return isoDate(target);
}

/** How many days before expiry the warning starts. */
export const warningDays = (months?: number) => (months === 2 ? 10 : 30);

export type ExpiryStatus = {state: 'OK' | 'EXPIRING' | 'EXPIRED'; daysLeft: number};

const dayNumber = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};

/** Where an expiry date stands today. */
export function expiryStatus(until: string, months?: number, today: Date = new Date()): ExpiryStatus {
  const daysLeft = dayNumber(until) - dayNumber(isoDate(today));
  if (daysLeft < 0) return {state: 'EXPIRED', daysLeft};
  return {state: daysLeft <= warningDays(months) ? 'EXPIRING' : 'OK', daysLeft};
}

/** A YYYY-MM-DD date as the user reads it (dd/mm/yyyy). */
export const formatExpiry = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
};

/** Asset states in which a sterile shelf life still counts: released and not yet used or sent back. */
export const STERILE_STATES = ['IN_STORAGE', 'READY_FOR_PICKUP', 'IN_DEPARTMENT'] as const;

export type ExpiryEntry = {
  kind: 'SET' | 'TOOL';
  id: string;
  barcode: string;
  name: string;
  department?: string;
  /** Where the Set or instrument is (asset state); `state` is the expiry state. */
  assetState: string;
  sterileUntil: string;
  shelfLifeMonths?: number;
} & ExpiryStatus;

type ExpiryAsset = {
  id: string;
  barcode: string;
  name: string;
  department?: string;
  state: string;
  sterileUntil?: string;
  shelfLifeMonths?: number;
};

/**
 * Sterile Sets and instruments with an expiry date, soonest first. A Set's instruments follow the Set, so
 * only instruments outside a Set are listed on their own.
 */
export function sterileExpiryList(
  sets: readonly ExpiryAsset[],
  tools: ReadonlyArray<ExpiryAsset & {setId?: string}>,
  today: Date = new Date(),
): ExpiryEntry[] {
  const sterile = (asset: ExpiryAsset) =>
    !!asset.sterileUntil && (STERILE_STATES as readonly string[]).includes(asset.state);
  const entry = (kind: 'SET' | 'TOOL', asset: ExpiryAsset): ExpiryEntry => ({
    kind,
    id: asset.id,
    barcode: asset.barcode,
    name: asset.name,
    department: asset.department,
    assetState: asset.state,
    sterileUntil: asset.sterileUntil as string,
    shelfLifeMonths: asset.shelfLifeMonths,
    ...expiryStatus(asset.sterileUntil as string, asset.shelfLifeMonths, today),
  });
  return [
    ...sets.filter(sterile).map(asset => entry('SET', asset)),
    ...tools.filter(tool => !tool.setId && sterile(tool)).map(asset => entry('TOOL', asset)),
  ].sort((a, b) => a.daysLeft - b.daysLeft);
}

/** The ones that need attention: expired or in their warning window. */
export const expiryAlerts = (list: readonly ExpiryEntry[]) => list.filter(item => item.state !== 'OK');
