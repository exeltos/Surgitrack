import {CheckCheck, X} from 'lucide-react';
import {tr, trData} from '../../../i18n';

/**
 * Mass receipt / delivery: pick the department instead of scanning first (the list then shows only its items),
 * and select all of its items at once. Once something is selected the batch belongs to that department.
 */
export default function BatchDepartmentPicker({
  departments,
  value,
  locked,
  allSelected,
  onPick,
  onSelectAll,
  onClear,
}: {
  /** Departments with something waiting, and how many. */
  departments: Array<{name: string; count: number}>;
  value: string;
  /** The batch already holds items of `value`. */
  locked: boolean;
  allSelected: boolean;
  onPick: (department: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  const count = departments.find(item => item.name === value)?.count || 0;
  return (
    <div className="batch-department">
      <label>
        <span>{tr('Τμήμα')}</span>
        <select value={value} disabled={locked} onChange={e => onPick(e.target.value)}>
          <option value="">{tr('Όλα τα τμήματα')}</option>
          {departments.map(item => (
            <option key={item.name} value={item.name}>
              {trData(item.name)} ({item.count})
            </option>
          ))}
        </select>
      </label>
      {value &&
        (allSelected ? (
          <button type="button" className="clear" onClick={onClear}>
            <X size={14} /> {tr('Αποεπιλογή')}
          </button>
        ) : (
          <button type="button" onClick={onSelectAll}>
            <CheckCheck size={14} /> {tr('Επιλογή όλων ({0})', count)}
          </button>
        ))}
    </div>
  );
}
