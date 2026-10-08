/**
 * Reads a date as the app shows and stores it on records: "29/09/2026 07:10" or the browser's Greek
 * short form "8/10/26, 1:05 μ.μ.". Returns undefined when it is not one of these.
 */
export function parseDisplayDate(value: string | undefined): Date | undefined {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?:[,\s]+(\d{1,2}):(\d{2})\s*(π\.?μ\.?|μ\.?μ\.?)?)?/i.exec(
    value || '',
  );
  if (!m) return undefined;
  const [, day, month, rawYear, rawHour = '0', minute = '0', meridiem] = m;
  const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
  let hour = Number(rawHour);
  if (meridiem) {
    const pm = meridiem.replace(/\./g, '').toLowerCase() === 'μμ';
    hour = (hour % 12) + (pm ? 12 : 0);
  }
  const date = new Date(year, Number(month) - 1, Number(day), hour, Number(minute));
  return Number.isNaN(date.getTime()) || date.getDate() !== Number(day) ? undefined : date;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Whole days from the date to now (undefined when the date cannot be read). */
export const daysSince = (value: string | undefined, now = Date.now()) => {
  const date = parseDisplayDate(value);
  return date ? Math.floor((now - date.getTime()) / DAY_MS) : undefined;
};

const pad = (n: number) => String(n).padStart(2, '0');
const asDate = (value: Date | string | number) => (value instanceof Date ? value : new Date(value));

/** One date format everywhere: 08/10/2026 (day/month/year, two-digit day and month). */
export const formatDate = (value: Date | string | number = new Date()) => {
  const d = asDate(value);
  return Number.isNaN(d.getTime()) ? '' : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};
/** The time in 24 hours: 13:05 (or 13:05:09 with seconds). */
export const formatTime = (value: Date | string | number = new Date(), seconds = false) => {
  const d = asDate(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}${seconds ? `:${pad(d.getSeconds())}` : ''}`;
};
/** One date-and-time format everywhere: 08/10/2026 13:05. This is also how records store it. */
export const formatDateTime = (value: Date | string | number = new Date()) => {
  const d = asDate(value);
  return Number.isNaN(d.getTime()) ? '' : `${formatDate(d)} ${formatTime(d)}`;
};

// Forms that older versions stored: the browser's Greek short form and an unpadded date.
const OLD_DATE_TIME = /^\d{1,2}\/\d{1,2}\/\d{2}, \d{1,2}:\d{2}\s?(?:π\.μ\.|μ\.μ\.)$/;
const UNPADDED_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/** A date stored in an older form, written the one way (08/10/2026 13:05); any other text as it is. */
export function normalizeDateText(value: string) {
  if (OLD_DATE_TIME.test(value)) {
    const date = parseDisplayDate(value);
    return date ? formatDateTime(date) : value;
  }
  const m = UNPADDED_DATE.exec(value);
  if (m && (m[1].length === 1 || m[2].length === 1)) return `${pad(Number(m[1]))}/${pad(Number(m[2]))}/${m[3]}`;
  return value;
}

/**
 * The record with every date stored in an older form rewritten the one way, nested ones included.
 * Returns the same object when nothing changed, so unchanged records stay unchanged.
 */
export function normalizeDates<T>(value: T): T {
  if (typeof value === 'string') return normalizeDateText(value) as T;
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map(item => {
      const fixed = normalizeDates(item);
      if (fixed !== item) changed = true;
      return fixed;
    });
    return (changed ? next : value) as T;
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    let next: Record<string, unknown> | undefined;
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const fixed = normalizeDates(item);
      if (fixed !== item) (next ||= {...(value as Record<string, unknown>)})[key] = fixed;
    }
    return (next || value) as T;
  }
  return value;
}
