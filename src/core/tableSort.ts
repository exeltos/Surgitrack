import {parseDisplayDate} from './displayDate';

/** Sorting a list by one of its columns: one click ascending, a second descending, a third back to the list's own order. */
export type SortDir = 'asc' | 'desc';
export type Sort<K extends string = string> = {key: K; dir: SortDir} | null;

export const nextSort = <K extends string>(current: Sort<K>, key: K): Sort<K> =>
  !current || current.key !== key ? {key, dir: 'asc'} : current.dir === 'asc' ? {key, dir: 'desc'} : null;

/**
 * A value as shown in a report cell, ready to sort: a date written «ηη/μμ/εεεε ώρα:λεπτά» by its time (not its text,
 * which would put 10/01 before 09/12), a number by its size, anything else as text.
 */
export function displaySortValue(value: unknown): SortValue {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return value == null ? undefined : String(value);
  const text = value.trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}(\s+\d{1,2}:\d{2})?$/.test(text)) return parseDisplayDate(text)?.getTime() ?? text;
  return text === '—' ? undefined : text;
}

/** The `aria-sort` of a column header. */
export const ariaSortOf = (sort: Sort, key: string): 'ascending' | 'descending' | 'none' =>
  sort?.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';

export type SortValue = string | number | boolean | Date | null | undefined;

const collator = new Intl.Collator(['el', 'en'], {numeric: true, sensitivity: 'base'});
const empty = (value: SortValue) => value === undefined || value === null || value === '' || Number.isNaN(value);
const comparable = (value: SortValue) =>
  value instanceof Date ? value.getTime() : typeof value === 'boolean' ? Number(value) : value;

/** Two values: numbers and dates by size, text the way a person would (Greek and Latin letters, «2» before «10»). */
export function compareValues(a: SortValue, b: SortValue): number {
  const x = comparable(a);
  const y = comparable(b);
  if (typeof x === 'number' && typeof y === 'number') return x - y;
  return collator.compare(String(x), String(y));
}

/**
 * The rows ordered by the chosen column (`accessors` give each column's value for a row). Rows with nothing in the
 * column stay last in either direction; equal rows keep their order. No sort: the rows as they are.
 */
export function sortRows<T, K extends string>(
  rows: readonly T[],
  sort: Sort<K>,
  accessors: Partial<Record<K, (row: T) => SortValue>>,
): T[] {
  const get = sort ? accessors[sort.key] : undefined;
  if (!sort || !get) return [...rows];
  const sign = sort.dir === 'asc' ? 1 : -1;
  return rows
    .map((row, index) => ({row, index, value: get(row)}))
    .sort((a, b) => {
      const ae = empty(a.value);
      const be = empty(b.value);
      if (ae || be) return ae && be ? a.index - b.index : ae ? 1 : -1;
      return sign * compareValues(a.value, b.value) || a.index - b.index;
    })
    .map(entry => entry.row);
}
