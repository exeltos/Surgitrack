import {Search, X} from 'lucide-react';
import {useAppPreferences} from '../../core/AppPreferences';
import FilterMenu, {type SelectFilter} from './FilterMenu';

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
  const activeFilters = filters.filter(filter => filter.value !== '').length;
  const active = query.trim() !== '' || activeFilters > 0;
  const clear = () => {
    onQueryChange('');
    filters.forEach(filter => filter.onChange(''));
  };

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
      <FilterMenu filters={filters} />
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
