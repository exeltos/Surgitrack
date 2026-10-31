import {History, TriangleAlert} from 'lucide-react';
import {movementText} from '../../core/movementText';
import {tr, trData} from '../../i18n';
import type {Issue, Movement} from '../../types/domain';

const SHOWN = 3;

/**
 * The lower half of the Summary tab of a Set or instrument: the latest movement and the open reports, each with a
 * link to its own tab, so the summary answers «where is it and what is wrong» without opening them.
 */
export default function AssetSummaryExtras({
  lastMovement,
  undone,
  issues,
  onOpenHistory,
  onOpenIssues,
}: {
  lastMovement?: Movement;
  undone: ReadonlySet<string>;
  issues: Issue[];
  onOpenHistory: () => void;
  onOpenIssues: () => void;
}) {
  return (
    <div className="asset-summary-extras">
      <section>
        <header>
          <strong>{tr('Τελευταία κίνηση')}</strong>
          {lastMovement && (
            <button type="button" className="asset-summary-link" onClick={onOpenHistory}>
              {tr('Ιστορικό')}
            </button>
          )}
        </header>
        {lastMovement ? (
          <div className="asset-summary-row">
            <History size={16} />
            <div>
              <strong>
                {movementText(lastMovement.status)}{' '}
                {undone.has(lastMovement.id) && <span className="undone-badge">{tr('Αναιρέθηκε')}</span>}
              </strong>
              <small>
                {trData(lastMovement.from)} → {trData(lastMovement.to)}
              </small>
              <small>
                {lastMovement.at} · {trData(lastMovement.by)}
              </small>
            </div>
          </div>
        ) : (
          <p className="asset-summary-none">{tr('Δεν υπάρχει καταγεγραμμένη κίνηση.')}</p>
        )}
      </section>
      <section>
        <header>
          <strong>{tr('Ανοικτές εκκρεμότητες')}</strong>
          {issues.length > 0 && (
            <button type="button" className="asset-summary-link" onClick={onOpenIssues}>
              {issues.length > SHOWN ? tr('Δες όλες ({0})', issues.length) : tr('Άνοιγμα')}
            </button>
          )}
        </header>
        {issues.length ? (
          issues.slice(0, SHOWN).map(issue => (
            <div className="asset-summary-row" key={issue.id}>
              <TriangleAlert size={16} className="warn" />
              <div>
                <strong>{issue.asset}</strong>
                <small>
                  {trData(issue.type)}
                  {issue.note ? ` · ${issue.note}` : ''}
                </small>
              </div>
            </div>
          ))
        ) : (
          <p className="asset-summary-none">{tr('Δεν υπάρχουν ανοικτές εκκρεμότητες.')}</p>
        )}
      </section>
    </div>
  );
}
