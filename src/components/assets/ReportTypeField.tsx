import {Settings2} from 'lucide-react';
import {tr} from '../../i18n';

/**
 * The type of a problem report. A loss is chosen here by everyone: for whoever may manage the item the
 * page declares it lost (after asking); a department reports it for Sterilization to confirm. Sending to
 * Service changes the item's state, so it is declared in «Διαχείριση».
 */
export default function ReportTypeField({
  kind,
  value,
  onChange,
  canManage,
  onManage,
}: {
  kind: 'TOOL' | 'SET';
  value: string;
  onChange: (value: string) => void;
  canManage: boolean;
  onManage?: () => void;
}) {
  const types = ['Βλάβη', 'Φθορά', ...(kind === 'SET' ? ['Έλλειψη'] : []), 'Απώλεια', 'Άλλο'];
  return (
    <label>
      {tr('Τύπος αναφοράς')}
      <select value={types.includes(value) ? value : types[0]} onChange={e => onChange(e.target.value)}>
        {types.map(type => (
          <option key={type} value={type}>
            {tr(type)}
          </option>
        ))}
      </select>
      {canManage && onManage && (
        <small className="report-type-hint">
          {tr('Η αποστολή σε Service αλλάζει την κατάσταση: δηλώνεται από τη')}{' '}
          <button type="button" onClick={onManage}>
            <Settings2 size={13} />
            {tr('Διαχείριση')}
          </button>
        </small>
      )}
    </label>
  );
}
