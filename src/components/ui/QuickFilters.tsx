import {tr} from '../../i18n';

export type QuickFilter = {
  /** Defaults to the label. */
  key?: string;
  label: string;
  /** A longer explanation, shown on hover. */
  hint?: string;
  count: number;
  active: boolean;
  onClick: () => void;
  /** Colours the count: warn (amber), bad (red), good (green). */
  tone?: 'warn' | 'bad' | 'good';
};

/**
 * Small figures above a list, each one a filter: the label and its count on one line, the active one dark. A row
 * about half the height of the old figure cards, so the list keeps its room and the search bar stays clean.
 */
export default function QuickFilters({items, label}: {items: QuickFilter[]; label?: string}) {
  return (
    <div className="quick-filters" role="group" aria-label={label || tr('Γρήγορα φίλτρα')}>
      {items.map(item => (
        <button
          key={item.key || item.label}
          title={item.hint}
          type="button"
          className={item.active ? 'active' : ''}
          aria-pressed={item.active}
          onClick={item.onClick}
        >
          <span>{item.label}</span> <b className={item.tone || ''}>{item.count}</b>
        </button>
      ))}
    </div>
  );
}
