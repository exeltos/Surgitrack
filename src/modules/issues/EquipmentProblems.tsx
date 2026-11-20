import {useMemo} from 'react';
import {Link} from 'react-router-dom';
import {useSurgi} from '../../store/SurgiStore';
import {useLibraries} from '../../core/LibraryStore';
import {REASON_LABEL, replacementItems, type ReplacementReason} from '../../core/replacements';
import {matchesUsage} from '../../core/usageFilter';
import {presetPath} from '../../core/listMemory';
import {tr} from '../../i18n';

const REASONS: ReplacementReason[] = ['DAMAGED', 'SERVICE', 'LOST', 'RETIRED'];

/**
 * The instruments out of order at a glance, beside the records of «Εκκρεμότητες»: damaged or worn, at Service, lost, out of use
 * (to replace) and near the end of their uses. Each opens its list: the first four the instruments to replace by
 * that reason, the last the instruments with few uses left.
 */
export default function EquipmentProblems({
  reason,
  onReason,
}: {
  /** The reason the instruments to replace are filtered by, when they are shown. */
  reason?: string;
  onReason: (reason: ReplacementReason) => void;
}) {
  const {tools, retiredTools, sets, issues, movements, purchaseOrders} = useSurgi();
  const {systemSettings} = useLibraries();
  const counts = useMemo(() => {
    const needed = replacementItems({tools, retiredTools, sets, issues, movements, purchaseOrders}).filter(
      item => item.status === 'NEEDED',
    );
    return Object.fromEntries(REASONS.map(r => [r, needed.filter(item => item.reason === r).length]));
  }, [tools, retiredTools, sets, issues, movements, purchaseOrders]);
  const nearLimit = tools.filter(t => matchesUsage('LOW', [t], systemSettings.usageWarningThreshold)).length;
  return (
    <aside className="problem-aside" aria-labelledby="problem-aside-title">
      <h2 id="problem-aside-title">{tr('Εξοπλισμός με πρόβλημα')}</h2>
      <ul className="problem-kpis" aria-label={tr('Εξοπλισμός με πρόβλημα')}>
        {REASONS.map(r => (
          <li key={r}>
            <button
              type="button"
              className={`problem-kpi ${r.toLowerCase()}${reason === r ? ' active' : ''}`}
              aria-pressed={reason === r}
              onClick={() => onReason(r)}
            >
              <span>{tr(REASON_LABEL[r])}</span>
              <b>{counts[r]}</b>
            </button>
          </li>
        ))}
        <li>
          <Link className="problem-kpi low" to={presetPath('/tools', {usage: 'LOW'})}>
            <span>{tr('Κοντά στο όριο χρήσεων')}</span>
            <b>{nearLimit}</b>
          </Link>
        </li>
      </ul>
    </aside>
  );
}
