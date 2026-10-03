import {Settings2} from 'lucide-react';
import {tr} from '../../i18n';

/**
 * The type of a problem report. Loss and Service change the item's state, so whoever may manage
 * the item declares them in «Διαχείριση» (the report would only note them); a department, which
 * cannot, reports a loss here for Sterilization to confirm.
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
  const types = ['Βλάβη', 'Φθορά', ...(kind === 'SET' ? ['Έλλειψη'] : []), ...(canManage ? [] : ['Απώλεια']), 'Άλλο'];
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
          {tr('Απώλεια ή αποστολή σε Service αλλάζουν την κατάσταση: δηλώνονται από τη')}{' '}
          <button type="button" onClick={onManage}>
            <Settings2 size={13} />
            {tr('Διαχείριση')}
          </button>
        </small>
      )}
    </label>
  );
}
