/**
 * The sample hospital is written as it stood on one day (DEMO_ANCHOR): its history runs up to the
 * day before. Whenever it is loaded, every date in it moves forward by the days since then, so a
 * Demo always looks current: last week's movements, Sets expiring this month, open issues.
 */
export const DEMO_ANCHOR = new Date(2026, 8, 30, 12, 0, 0);

const DAY = 864e5;
const pad = (n: number) => String(n).padStart(2, '0');
/** Noon local time of a date, so whole-day steps never cross a clock change badly. */
const noon = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);

/** Whole days from the anchor to `now` (0 on the anchor day; negative before it). */
export const demoShiftDays = (now = new Date()) =>
  Math.round((noon(now).getTime() - noon(DEMO_ANCHOR).getTime()) / DAY);

const DISPLAY = /^(\d{2})\/(\d{2})\/(\d{4})( \d{2}:\d{2})?$/;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

const shiftDay = (y: number, m: number, d: number, days: number) => {
  const day = new Date(y, m - 1, d, 12);
  day.setDate(day.getDate() + days);
  return day;
};

/** One value moved by `days`: "dd/mm/yyyy", "dd/mm/yyyy hh:mm" and "yyyy-mm-dd" (times kept). */
export const shiftDateText = (value: string, days: number) => {
  const display = DISPLAY.exec(value);
  if (display) {
    const day = shiftDay(Number(display[3]), Number(display[2]), Number(display[1]), days);
    return `${pad(day.getDate())}/${pad(day.getMonth() + 1)}/${day.getFullYear()}${display[4] || ''}`;
  }
  const iso = ISO_DAY.exec(value);
  if (iso) {
    const day = shiftDay(Number(iso[1]), Number(iso[2]), Number(iso[3]), days);
    return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
  }
  return value;
};

/** A copy of the sample data with every date moved by `days` (the data itself is not changed). */
export const shiftDemoDates = <T>(data: T, days: number): T => {
  if (!days) return data;
  const walk = (value: unknown): unknown => {
    if (typeof value === 'string') return shiftDateText(value, days);
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === 'object')
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, walk(item)]));
    return value;
  };
  return walk(data) as T;
};
