import {useEffect, useRef, useState} from 'react';
import {Search, SlidersHorizontal, X} from 'lucide-react';
import {useAppPreferences} from '../../core/AppPreferences';

type Option = {value: string; label: string};
type SelectFilter = {
  key: string;
  value: string;
  placeholder: string;
  options: Option[];
  onChange: (value: string) => void;
};

type Props = {
  query: string;
  onQueryChange: (value: string) => void;
  placeholder?: string;
  filters?: SelectFilter[];
  compact?: boolean;
  className?: string;
  onSubmitQuery?: (value: string) => void;
};

/** Search box plus one "Filters" button that opens the filter choices, with a count of active ones. */
export default function AssetFilterBar({
  query,
  onQueryChange,
  placeholder,
  filters = [],
  compact = false,
  className = '',
  onSubmitQuery,
}: Props) {
  const {lang} = useAppPreferences();
  const L = (el: string, en: string) => (lang === 'el' ? el : en);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const activeFilters = filters.filter(filter => filter.value !== '').length;
  const active = query.trim() !== '' || activeFilters > 0;
  const clear = () => {
    onQueryChange('');
    filters.forEach(filter => filter.onChange(''));
  };

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

  return (
    <div className={`asset-filter-bar ${compact ? 'compact' : ''} ${className}`.trim()}>
      <div className="asset-filter-search">
        <Search size={17} />
        <input
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && onSubmitQuery) {
              e.preventDefault();
              onSubmitQuery(query);
            }
          }}
          placeholder={
            placeholder || L('Αναζήτηση με ονομασία, κωδικό ή barcode...', 'Search by name, code or barcode...')
          }
        />
      </div>
      {filters.length > 0 && (
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
              {filters.map(filter => (
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
                      {option.label}
                    </option>
                  ))}
                </select>
              ))}
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
      )}
      {active && (
        <button
          type="button"
          className="asset-filter-clear"
          onClick={clear}
          title={L('Καθαρισμός αναζήτησης και φίλτρων', 'Clear search and filters')}
          aria-label={L('Καθαρισμός αναζήτησης και φίλτρων', 'Clear search and filters')}
        >
          <X size={15} />
          <span>{L('Καθαρισμός', 'Clear')}</span>
        </button>
      )}
    </div>
  );
}
