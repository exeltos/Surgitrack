import {ArrowDown, ArrowUp, ChevronsUpDown} from 'lucide-react';
import {tr} from '../../i18n';
import {ariaSortOf, type Sort} from '../../core/tableSort';

/**
 * A column title with an up-down arrow: pressing it sorts the list ascending, then descending, then as it was.
 * Inside the header cell (`<th aria-sort={ariaSortOf(sort, key)}>`, or any header element).
 */
export default function SortHeader<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: K;
  sort: Sort<K>;
  onSort: (key: K) => void;
}) {
  const here = sort?.key === sortKey ? sort.dir : undefined;
  const hint =
    here === 'asc'
      ? tr('αύξουσα σειρά · πατήστε για φθίνουσα')
      : here === 'desc'
        ? tr('φθίνουσα σειρά · πατήστε για να φύγει η ταξινόμηση')
        : tr('πατήστε για αύξουσα σειρά');
  return (
    <button
      type="button"
      className={`sort-head${here ? ' active' : ''}`}
      title={hint}
      aria-label={`${label}, ${hint}`}
      onClick={() => onSort(sortKey)}
    >
      <span>{label}</span>
      {here === 'asc' ? (
        <ArrowUp size={13} aria-hidden="true" />
      ) : here === 'desc' ? (
        <ArrowDown size={13} aria-hidden="true" />
      ) : (
        <ChevronsUpDown size={13} aria-hidden="true" />
      )}
    </button>
  );
}

/** A table header cell that sorts its column (the cell carries `aria-sort`). */
export function SortTh<K extends string>(props: {
  label: string;
  sortKey: K;
  sort: Sort<K>;
  onSort: (key: K) => void;
  className?: string;
}) {
  const {className, ...header} = props;
  return (
    <th className={className} aria-sort={ariaSortOf(header.sort, header.sortKey)}>
      <SortHeader {...header} />
    </th>
  );
}
