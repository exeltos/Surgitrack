import {useState} from 'react';
import {useFloatingPanel} from '../ui/useFloatingPanel';
import {SlidersHorizontal} from 'lucide-react';
import {useAppPreferences} from '../../core/AppPreferences';
import {tr, trData} from '../../i18n';

type Option = {value: string; label: string};
export type SelectFilter = {
  key: string;
  value: string;
  placeholder: string;
  options: Option[];
  onChange: (value: string) => void;
  /** A date filter shows a date field labelled with the placeholder instead of a list. */
  type?: 'select' | 'date';
  /** The list's title over it («Τμήμα»); the usual filters have theirs by key. */
  label?: string;
};

/** The title over each usual list, so a choice made («Γενική Χειρουργική») still says which filter it is. */
const TITLE_OF: Record<string, string> = {
  department: 'Τμήμα',
  specialty: 'Ειδικότητα',
  manufacturer: 'Εταιρεία',
  state: 'Κατάσταση',
  status: 'Κατάσταση',
  limit: 'Όριο χρήσεων',
  usage: 'Τύπος χρήσης',
  kind: 'Σετ / εργαλεία',
  completeness: 'Πληρότητα',
  expiry: 'Λήξη',
  attention: 'Προτεραιότητα',
  from: 'Από',
  to: 'Προς',
  reason: 'Αιτία',
  stock: 'Απόθεμα',
  type: 'Τύπος',
  group: 'Ομαδοποίηση',
  signature: 'Υπογραφή',
};
const titleOf = (filter: SelectFilter) => filter.label ?? (TITLE_OF[filter.key] ? tr(TITLE_OF[filter.key]) : '');

/** One "Filters" button that opens every filter choice, with a count of the active ones. */
export default function FilterMenu({filters, align = 'right'}: {filters: SelectFilter[]; align?: 'left' | 'right'}) {
  const {lang} = useAppPreferences();
  const L = (el: string, en: string) => (lang === 'el' ? el : en);
  const [open, setOpen] = useState(false);
  const activeFilters = filters.filter(filter => filter.value !== '').length;
  // The panel floats over the page at the button, so the card or list around it cannot cut it off.
  const {wrap, panel, place} = useFloatingPanel(open, () => setOpen(false), align);

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
        <div
          ref={panel}
          className="asset-filter-panel"
          role="dialog"
          aria-label={L('Φίλτρα', 'Filters')}
          style={place || {visibility: 'hidden'}}
        >
          {filters.map(filter =>
            filter.type === 'date' ? (
              <label key={filter.key} className={`asset-filter-date ${filter.value ? 'selected' : ''}`}>
                <span>{filter.placeholder}</span>
                <input type="date" value={filter.value} onChange={e => filter.onChange(e.target.value)} />
              </label>
            ) : (
              <label key={filter.key} className="asset-filter-field">
                {titleOf(filter) && <span>{titleOf(filter)}</span>}
                <select
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
              </label>
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
