import {Search, SlidersHorizontal, X} from 'lucide-react';

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

export default function AssetFilterBar({
  query,
  onQueryChange,
  placeholder = 'Αναζήτηση με ονομασία, κωδικό ή barcode...',
  filters = [],
  compact = false,
  className = '',
  onSubmitQuery,
}: Props) {
  const active = query.trim() !== '' || filters.some(filter => filter.value !== '');
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
          placeholder={placeholder}
        />
      </div>
      {filters.length > 0 && (
        <div className="asset-filter-selects">
          <SlidersHorizontal size={15} className="asset-filter-icon" />
          {filters.map(filter => (
            <select
              key={filter.key}
              value={filter.value}
              onChange={e => filter.onChange(e.target.value)}
              aria-label={filter.placeholder}
            >
              <option value="">{filter.placeholder}</option>
              {filter.options.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ))}
        </div>
      )}
      {active && (
        <button
          type="button"
          className="asset-filter-clear"
          onClick={clear}
          title="Καθαρισμός φίλτρων"
          aria-label="Καθαρισμός φίλτρων"
        >
          <X size={15} />
          <span>Καθαρισμός</span>
        </button>
      )}
    </div>
  );
}
