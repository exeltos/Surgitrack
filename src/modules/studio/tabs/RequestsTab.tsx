import {useCallback, useEffect, useState} from 'react';
import {Building2, Check, Inbox, Mail, Phone, RefreshCw, RotateCcw, Trash2, UserRound} from 'lucide-react';
import AppButton from '../../../components/ui/AppButton';
import Spinner from '../../../components/ui/Spinner';
import {askConfirm} from '../../../components/ui/confirmService';
import {formatDateTime} from '../../../core/displayDate';
import {
  CONTACT_PAGE,
  countContactRequests,
  deleteContactRequest,
  loadContactRequests,
  setContactRequestHandled,
  type ContactRequest,
} from '../../../data/cloud/contactRequests';
import type {StudioPageState} from '../useStudioPage';

/**
 * «Ζητήστε παρουσίαση» from the public first page: who asked, from which hospital, how to reach them and what they
 * wrote, newest first. The same request was emailed to the company; here it is kept and marked handled.
 */
export default function RequestsTab({s}: {s: StudioPageState}) {
  const {L, platformAdmin, tab} = s;
  const [rows, setRows] = useState<ContactRequest[] | null>(null);
  const [counts, setCounts] = useState({open: 0, all: 0});
  const [more, setMore] = useState(false);
  const [failed, setFailed] = useState('');
  const [all, setAll] = useState(false);
  const active = tab === 'REQUESTS' && platformAdmin;
  const view = all ? 'ALL' : 'NEW';
  // The first page again (after a change too), with the counts; «Περισσότερα» adds the next page.
  const load = useCallback(async () => {
    setFailed('');
    try {
      const [page, total] = await Promise.all([loadContactRequests(view), countContactRequests()]);
      setRows(page);
      setCounts(total);
      setMore(page.length === CONTACT_PAGE);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : String((e as {message?: string})?.message || e));
      setRows([]);
    }
  }, [view]);
  const loadMore = async () => {
    const last = rows?.[rows.length - 1];
    if (!last) return;
    try {
      const page = await loadContactRequests(view, last.createdAt);
      setRows(current => [...(current || []), ...page]);
      setMore(page.length === CONTACT_PAGE);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : String(e));
    }
  };
  useEffect(() => {
    if (active) void load();
  }, [active, load]);
  if (!active) return null;

  const shown = rows || [];
  const mark = async (row: ContactRequest, handled: boolean) => {
    try {
      await setContactRequestHandled(row.id, handled);
      await load();
    } catch (e) {
      setFailed(e instanceof Error ? e.message : String(e));
    }
  };
  const remove = async (row: ContactRequest) => {
    const sure = await askConfirm({
      title: L('Διαγραφή αιτήματος', 'Delete request'),
      message: L(`Διαγράφεται οριστικά το αίτημα του/της ${row.name}.`, `${row.name}’s request is deleted for good.`),
      confirmLabel: L('Διαγραφή', 'Delete'),
      danger: true,
    });
    if (sure === false) return;
    try {
      await deleteContactRequest(row.id);
      await load();
    } catch (e) {
      setFailed(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section className="studio-requests">
      <header className="studio-requests-head">
        <div className="studio-requests-filter" role="group" aria-label={L('Ποια αιτήματα', 'Which requests')}>
          <button
            type="button"
            aria-pressed={!all}
            className={!all ? 'active' : ''}
            onClick={() => {
              setRows(null);
              setAll(false);
            }}
          >
            {L('Νέα', 'New')} <b>{counts.open}</b>
          </button>
          <button
            type="button"
            aria-pressed={all}
            className={all ? 'active' : ''}
            onClick={() => {
              setRows(null);
              setAll(true);
            }}
          >
            {L('Όλα', 'All')} <b>{counts.all}</b>
          </button>
        </div>
        <AppButton icon={<RefreshCw size={16} />} onClick={() => void load()}>
          {L('Ανανέωση', 'Refresh')}
        </AppButton>
      </header>
      {failed && <p className="studio-errors-failed">{failed}</p>}
      {rows === null ? (
        <Spinner />
      ) : !shown.length ? (
        <div className="studio-errors-empty">
          <Inbox size={22} />
          <strong>{all ? L('Κανένα αίτημα', 'No requests') : L('Κανένα νέο αίτημα', 'No new requests')}</strong>
          <span>
            {L(
              'Τα αιτήματα από το «Ζητήστε παρουσίαση» της πρώτης σελίδας εμφανίζονται εδώ και έρχονται και με email.',
              'Requests from «Request a demo» on the first page show here and also arrive by email.',
            )}
          </span>
        </div>
      ) : (
        <ul className="studio-requests-list">
          {shown.map(row => (
            <li key={row.id} className={row.handledAt ? 'handled' : ''}>
              <div className="studio-request-head">
                <span className="studio-request-who">
                  <b>{row.organization || row.name}</b>
                  <small>{formatDateTime(row.createdAt)}</small>
                </span>
                {row.handledAt ? (
                  <span className="studio-request-state">
                    <Check size={14} aria-hidden="true" /> {L('Ολοκληρώθηκε', 'Handled')}
                  </span>
                ) : (
                  <span className="studio-request-state new">{L('Νέο', 'New')}</span>
                )}
              </div>
              <ul className="studio-request-facts">
                <li>
                  <UserRound size={14} aria-hidden="true" />
                  {row.name}
                  {row.role && <small> · {row.role}</small>}
                </li>
                {row.organization && (
                  <li>
                    <Building2 size={14} aria-hidden="true" />
                    {row.organization}
                  </li>
                )}
                <li>
                  <Mail size={14} aria-hidden="true" />
                  <a href={`mailto:${row.email}`}>{row.email}</a>
                </li>
                {row.phone && (
                  <li>
                    <Phone size={14} aria-hidden="true" />
                    <a href={`tel:${row.phone.replace(/[^\d+]/g, '')}`}>{row.phone}</a>
                  </li>
                )}
              </ul>
              <p className="studio-request-message">{row.message}</p>
              <div className="studio-request-actions">
                {row.handledAt ? (
                  <AppButton size="sm" icon={<RotateCcw size={15} />} onClick={() => void mark(row, false)}>
                    {L('Ξανά νέο', 'Mark as new')}
                  </AppButton>
                ) : (
                  <AppButton
                    size="sm"
                    variant="primary"
                    icon={<Check size={15} />}
                    onClick={() => void mark(row, true)}
                  >
                    {L('Ολοκληρώθηκε', 'Mark handled')}
                  </AppButton>
                )}
                <AppButton
                  size="sm"
                  variant="ghost"
                  icon={<Trash2 size={15} />}
                  aria-label={L('Διαγραφή', 'Delete')}
                  onClick={() => void remove(row)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      {more && (
        <AppButton className="studio-requests-more" onClick={() => void loadMore()}>
          {L('Περισσότερα', 'More')}
        </AppButton>
      )}
    </section>
  );
}
