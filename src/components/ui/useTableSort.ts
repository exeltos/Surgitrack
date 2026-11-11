import {useCallback, useMemo, useRef, useState} from 'react';
import {nextSort, sortRows, type Sort, type SortValue} from '../../core/tableSort';

/**
 * A list sorted by its column headers: `rows` ordered by the chosen column, `sort` for the headers
 * (SortHeader) and `toggle` for their clicks. `accessors` may be written inline.
 */
export function useTableSort<T, K extends string>(
  rows: readonly T[],
  accessors: Partial<Record<K, (row: T) => SortValue>>,
  initial: Sort<K> = null,
) {
  const [sort, setSort] = useState<Sort<K>>(initial);
  const accessorsRef = useRef(accessors);
  accessorsRef.current = accessors;
  const sorted = useMemo(() => sortRows(rows, sort, accessorsRef.current), [rows, sort]);
  const toggle = useCallback((key: K) => setSort(current => nextSort(current, key)), []);
  return {rows: sorted, sort, toggle};
}
