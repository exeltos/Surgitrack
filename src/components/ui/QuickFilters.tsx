import {tr} from '../../i18n';

export type QuickFilter = {
  key: string;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  /** Colours the count: warn (amber), bad (red), good (green). */
  tone?: 'warn' | 'bad' | 'good';
};

/** A short row of one-click filters with their counts, next to a list's search (in place of figure cards). */
export default function QuickFilters({items, label}: {items: QuickFilter[]; label?: string}) {
  return (
    <div className="quick-filters" role="group" aria-label={label || tr('Γρήγορα φίλτρα')}>
      {items.map(item => (
        <button
          key={item.key}
          type="button"
          className={item.active ? 'active' : ''}
          aria-pressed={item.active}
          onClick={item.onClick}
        >
          {item.label} <b className={item.tone || ''}>{item.count}</b>
        </button>
      ))}
    </div>
  );
}
