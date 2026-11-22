import {ExternalLink, PackageCheck, ShoppingCart, Undo2} from 'lucide-react';
import {Link} from 'react-router-dom';
import {REASON_LABEL, type ReplacementItem} from '../../core/replacements';
import {tr, trData} from '../../i18n';
import InfoList from '../traceability/InfoList';

/**
 * One instrument to replace, beside the list: why, where it belongs, whether Stock has the same, where it stands, and
 * what can be done — replace it from Stock, order it, take it back from Service, open its card or its Set's.
 */
export default function ReplacementCard({
  item,
  status,
  editable,
  onReplace,
  onOrder,
  onReturn,
}: {
  item: ReplacementItem;
  status: string;
  editable: boolean;
  onReplace?: () => void;
  onOrder?: () => void;
  onReturn?: () => void;
}) {
  const {tool, set} = item;
  return (
    <article className="issue-card">
      <div className="trace-item-head">
        <div>
          <small>
            <span className="mono">{tool.barcode}</span> · {tr('Εργαλείο')}
            {tool.code ? ` · ${tool.code}` : ''}
            {tool.manufacturer ? ` · ${tool.manufacturer}` : ''}
          </small>
          <h2>{tool.name}</h2>
        </div>
      </div>
      <InfoList
        label={tr('Αντικατάσταση')}
        rows={[
          {
            label: tr('Αιτία'),
            value: (
              <>
                <b>{tr(REASON_LABEL[item.reason])}</b>
                {item.issueTypes.length > 0 && <small>{item.issueTypes.map(trData).join(' · ')}</small>}
              </>
            ),
          },
          {
            label: tr('Σετ / τμήμα'),
            value: (
              <>
                <b>{set ? set.name : '—'}</b>
                <small>
                  {set && <span className="mono">{set.barcode}</span>}
                  {set && item.department ? ' · ' : ''}
                  {trData(item.department || '')}
                </small>
              </>
            ),
          },
          {
            label: tr('Απόθεμα'),
            value: item.stock.length ? (
              <>
                <i className="trace-tone ok">{tr('Ναι · {0}', item.stock.length)}</i>
                <small className="mono">{item.stock.map(s => s.barcode).join(', ')}</small>
              </>
            ) : (
              <i className="trace-tone bad">{tr('Όχι')}</i>
            ),
          },
          {
            label: tr('Κατάσταση'),
            value: (
              <>
                <b>{status}</b>
                {item.since && <small>{tr('από {0}', item.since)}</small>}
              </>
            ),
          },
        ]}
      />
      <div className="issue-card-actions">
        {editable && onReplace && (
          <button type="button" className="app-button app-button-primary app-button-md" onClick={onReplace}>
            <PackageCheck size={16} /> {tr('Αντικατάσταση από Απόθεμα')}
          </button>
        )}
        {editable && onOrder && (
          <button type="button" className="app-button" onClick={onOrder}>
            <ShoppingCart size={16} /> {tr('Παραγγελία αγοράς')}
          </button>
        )}
        {editable && onReturn && (
          <button type="button" className="app-button" onClick={onReturn}>
            <Undo2 size={16} /> {tr('Επιστροφή από Service')}
          </button>
        )}
        <Link className="app-button" to={`/tools/${tool.id}`}>
          <ExternalLink size={16} /> {tr('Καρτέλα εργαλείου')}
        </Link>
        {set && (
          <Link className="app-button" to={`/sets/${set.id}`}>
            <ExternalLink size={16} /> {tr('Καρτέλα Σετ')}
          </Link>
        )}
      </div>
    </article>
  );
}
