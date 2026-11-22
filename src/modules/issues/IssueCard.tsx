import {CheckCircle2, ExternalLink, MoreHorizontal, Pencil, ShoppingCart, Trash2} from 'lucide-react';
import {Link} from 'react-router-dom';
import ActionMenu from '../../components/ui/ActionMenu';
import {tr, trData} from '../../i18n';
import type {Issue} from '../../types/domain';
import InfoList from '../traceability/InfoList';

/**
 * One report, beside the list: what it is about, its kind, department, when and by whom, the note and the photos, and
 * what can be done — resolve it, open the item's card, order a replacement; the admin also corrects or deletes it.
 */
export default function IssueCard({
  issue,
  kind,
  to,
  age,
  old,
  tone,
  onResolve,
  onOrder,
  onEdit,
  onDelete,
}: {
  issue: Issue;
  /** «Σετ» or «Εργαλείο», when the item is known. */
  kind: string;
  /** The item's card. */
  to?: string;
  /** How long an open report has waited. */
  age: string;
  old: boolean;
  tone: string;
  onResolve?: () => void;
  onOrder?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const [barcode, ...rest] = issue.asset.split(' · ');
  const name = rest.join(' · ') || issue.asset;
  const more = [
    ...(onEdit ? [{key: 'edit', icon: <Pencil size={15} />, label: tr('Διόρθωση σημείωσης'), onSelect: onEdit}] : []),
    ...(onDelete
      ? [
          {
            key: 'delete',
            icon: <Trash2 size={15} />,
            label: tr('Διαγραφή αναφοράς'),
            danger: true,
            onSelect: onDelete,
          },
        ]
      : []),
  ];
  return (
    <article className="issue-card">
      <div className="trace-item-head">
        <div>
          <small>
            <span className="mono">{barcode}</span>
            {kind && ` · ${kind}`} · {tr('Πρόβλημα')}
          </small>
          <h2>{name}</h2>
        </div>
      </div>
      <InfoList
        label={tr('Πρόβλημα')}
        rows={[
          {
            label: tr('Τύπος'),
            value: <i className={`trace-tone issue-tone-${tone}`}>{trData(issue.type) || tr('Πρόβλημα')}</i>,
          },
          {label: tr('Τμήμα'), value: <b>{trData(issue.department) || '—'}</b>},
          {
            label: tr('Δηλώθηκε'),
            value: (
              <>
                <b>{issue.created}</b>
                {issue.reportedBy && <small>{trData(issue.reportedBy)}</small>}
              </>
            ),
          },
          {
            label: tr('Κατάσταση'),
            value:
              issue.status === 'OPEN' ? (
                <>
                  <b>{tr('Ανοικτή')}</b>
                  <small className={old ? 'issue-card-old' : undefined}>{age}</small>
                </>
              ) : (
                <i className="trace-tone ok">{tr('Επιλυμένη')}</i>
              ),
          },
        ]}
      />
      {issue.note && (
        <div className="issue-card-note">
          <span>{tr('Σημείωση')}</span>
          <p>{issue.note}</p>
          {issue.editedBy && (
            <small>{tr('Διορθώθηκε από {0} στις {1}', trData(issue.editedBy), issue.editedAt || '')}</small>
          )}
        </div>
      )}
      {issue.photos?.length ? (
        <div className="issue-card-photos">
          {issue.photos.map(photo => (
            <a key={photo.id} href={photo.dataUrl} target="_blank" rel="noreferrer" title={photo.name}>
              <img src={photo.dataUrl} alt={photo.name} />
            </a>
          ))}
        </div>
      ) : null}
      <div className="issue-card-actions">
        {onResolve && (
          <button type="button" className="app-button app-button-primary app-button-md" onClick={onResolve}>
            <CheckCircle2 size={16} /> {tr('Επίλυση')}
          </button>
        )}
        {to && (
          <Link className="app-button" to={to}>
            <ExternalLink size={16} /> {kind === tr('Σετ') ? tr('Καρτέλα Σετ') : tr('Καρτέλα εργαλείου')}
          </Link>
        )}
        {onOrder && (
          <button type="button" className="app-button" onClick={onOrder}>
            <ShoppingCart size={16} /> {tr('Παραγγελία αγοράς')}
          </button>
        )}
        {more.length > 0 && (
          <ActionMenu
            compact
            align="right"
            icon={<MoreHorizontal size={16} />}
            label={tr('Περισσότερα')}
            items={more}
          />
        )}
      </div>
    </article>
  );
}
