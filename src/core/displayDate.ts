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
