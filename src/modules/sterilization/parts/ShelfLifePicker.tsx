import {CalendarClock} from 'lucide-react';
import {tr} from '../../../i18n';
import {SHELF_LIFE_OPTIONS, formatExpiry, sterileUntil} from '../../../core/sterileExpiry';

/** The sterile shelf life chosen at Packaging & Labelling: 2, 3 or 6 months from the release. */
export default function ShelfLifePicker({value, onChange}: {value: number; onChange: (months: number) => void}) {
  return (
    <section className="shelf-life-picker" aria-label={tr('Διάρκεια αποστείρωσης')}>
      <div className="shelf-life-title">
        <CalendarClock size={17} />
        <div>
          <strong>{tr('Διάρκεια αποστείρωσης')}</strong>
          <span>
            {tr('Μετρά από την αποδέσμευση· σήμερα θα έληγε στις {0}.', formatExpiry(sterileUntil(new Date(), value)))}
          </span>
        </div>
      </div>
      <div className="shelf-life-options" role="radiogroup" aria-label={tr('Διάρκεια αποστείρωσης')}>
        {SHELF_LIFE_OPTIONS.map(months => (
          <button
            key={months}
            type="button"
            role="radio"
            aria-checked={value === months}
            className={value === months ? 'on' : ''}
            onClick={() => onChange(months)}
          >
            {tr('{0} μήνες', months)}
          </button>
        ))}
      </div>
    </section>
  );
}
