import {useEffect, useRef, useState} from 'react';
import {SlidersHorizontal} from 'lucide-react';
import {useAppPreferences} from '../../core/AppPreferences';
import {trData} from '../../i18n';

type Option = {value: string; label: string};
export type SelectFilter = {
  key: string;
  value: string;
  placeholder: string;
  options: Option[];
  onChange: (value: string) => void;
  /** A date filter shows a date field labelled with the placeholder instead of a list. */
  type?: 'select' | 'date';
};

/** One "Filters" button that opens every filter choice, with a count of the active ones. */
export default function FilterMenu({filters}: {filters: SelectFilter[]}) {
  const {lang} = useAppPreferences();
  const L = (el: string, en: string) => (lang === 'el' ? el : en);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const activeFilters = filters.filter(filter => filter.value !== '').length;

  // Close the filter panel on an outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!filters.length) return null;
  return (
    <div className="asset-filter-menu" ref={wrap}>
      <button
        type="button"
        className={`asset-filter-toggle ${activeFilters ? 'has-active' : ''} ${open ? 'open' : ''}`}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        <SlidersHorizontal size={15} />
        <span>{L('Φίλτρα', 'Filters')}</span>
        {activeFilters > 0 && <em>{activeFilters}</em>}
      </button>
      {open && (
        <div className="asset-filter-panel" role="dialog" aria-label={L('Φίλτρα', 'Filters')}>
          {filters.map(filter =>
            filter.type === 'date' ? (
              <label key={filter.key} className={`asset-filter-date ${filter.value ? 'selected' : ''}`}>
                <span>{filter.placeholder}</span>
                <input type="date" value={filter.value} onChange={e => filter.onChange(e.target.value)} />
              </label>
            ) : (
              <select
                key={filter.key}
                value={filter.value}
                onChange={e => filter.onChange(e.target.value)}
                aria-label={filter.placeholder}
                className={filter.value ? 'selected' : ''}
              >
                <option value="">{filter.placeholder}</option>
                {filter.options.map(option => (
                  <option key={option.value} value={option.value}>
                    {trData(option.label)}
                  </option>
                ))}
              </select>
            ),
          )}
          <footer>
            <button
              type="button"
              disabled={!activeFilters}
              onClick={() => filters.forEach(filter => filter.onChange(''))}
            >
              {L('Καθαρισμός φίλτρων', 'Clear filters')}
            </button>
            <button type="button" className="primary" onClick={() => setOpen(false)}>
              {L('Εντάξει', 'Done')}
            </button>
          </footer>
        </div>
      )}
    </div>
  );
}
