import {useCallback, useEffect, useMemo, useState} from 'react';
import {Bug, RefreshCw, Trash2} from 'lucide-react';
import AppButton from '../../../components/ui/AppButton';
import Spinner from '../../../components/ui/Spinner';
import {askConfirm} from '../../../components/ui/confirmService';
import {formatDateTime} from '../../../core/displayDate';
import {supabase} from '../../../lib/supabase';
import type {StudioPageState} from '../useStudioPage';

type Row = {
  id: string;
  organization_id: string | null;
  occurred_at: string;
  kind: string;
  message: string;
  detail: string | null;
  route: string | null;
  app_version: string | null;
  user_agent: string | null;
};

type Group = {key: string; kind: string; message: string; rows: Row[]};

const KIND = {
  error: ['Σφάλμα', 'Error'],
  rejection: ['Αποτυχία', 'Failure'],
  render: ['Σελίδα', 'Page'],
  sync: ['Συγχρονισμός', 'Sync'],
} as const;

/** The platform owner's list of errors users met, the same error grouped, newest first. */
export default function ErrorsTab({s}: {s: StudioPageState}) {
  const {L, displayedOrganizations, platformAdmin, tab} = s;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState('');
  const [open, setOpen] = useState('');
  const load = useCallback(async () => {
    setFailed('');
    const {data, error} = await supabase
      .from('client_errors')
      .select('id,organization_id,occurred_at,kind,message,detail,route,app_version,user_agent')
      .order('occurred_at', {ascending: false})
      .limit(1000);
    if (error) setFailed(error.message);
    setRows((data as Row[] | null) || []);
  }, []);
  useEffect(() => {
    if (tab === 'ERRORS' && platformAdmin) void load();
  }, [tab, platformAdmin, load]);

  const hospital = useMemo(() => new Map(displayedOrganizations.map(o => [o.id, o.name])), [displayedOrganizations]);
  const groups = useMemo(() => {
    const map = new Map<string, Group>();
    for (const row of rows || []) {
      const key = `${row.kind}|${row.message}`;
      const group = map.get(key) || {key, kind: row.kind, message: row.message, rows: []};
      group.rows.push(row);
      map.set(key, group);
    }
    return [...map.values()];
  }, [rows]);

  if (tab !== 'ERRORS' || !platformAdmin) return null;
  const clear = async (group?: Group) => {
    const sure = await askConfirm({
      title: group ? L('Διαγραφή σφάλματος', 'Delete error') : L('Διαγραφή όλων', 'Delete all'),
      message: group
        ? L(
            `Διαγράφονται οι ${group.rows.length} καταγραφές αυτού του σφάλματος.`,
            `${group.rows.length} entries of this error are deleted.`,
          )
        : L('Διαγράφονται όλες οι καταγραφές σφαλμάτων.', 'All error entries are deleted.'),
      confirmLabel: L('Διαγραφή', 'Delete'),
      danger: true,
    });
    if (sure === false) return;
    const ids = (group ? group.rows : rows || []).map(r => r.id);
    for (let i = 0; i < ids.length; i += 200)
      await supabase
        .from('client_errors')
        .delete()
        .in('id', ids.slice(i, i + 200));
    await load();
  };

  return (
    <section className="studio-errors">
      <header className="studio-errors-head">
        <div>
          <h2>{L('Σφάλματα εφαρμογής', 'App errors')}</h2>
          <p>
            {L(
              'Ό,τι στράβωσε στους χρήστες όλων των νοσοκομείων: το ίδιο σφάλμα μαζί, με το πόσες φορές, πού και πότε. Μένουν 90 ημέρες. Χωρίς δεδομένα ασθενών.',
              'What went wrong for users in every hospital: the same error together, how often, where and when. Kept 90 days. No patient data.',
            )}
          </p>
        </div>
        <div className="studio-errors-actions">
          <AppButton icon={<RefreshCw size={16} />} onClick={() => void load()}>
            {L('Ανανέωση', 'Refresh')}
          </AppButton>
          {!!rows?.length && (
            <AppButton variant="danger" icon={<Trash2 size={16} />} onClick={() => void clear()}>
              {L('Διαγραφή όλων', 'Delete all')}
            </AppButton>
          )}
        </div>
      </header>
      {failed && <p className="studio-errors-failed">{failed}</p>}
      {rows === null ? (
        <Spinner />
      ) : !groups.length ? (
        <div className="studio-errors-empty">
          <Bug size={22} />
          <strong>{L('Κανένα σφάλμα', 'No errors')}</strong>
          <span>
            {L('Δεν έχει καταγραφεί σφάλμα τις τελευταίες 90 ημέρες.', 'No error recorded in the last 90 days.')}
          </span>
        </div>
      ) : (
        <ul className="studio-errors-list">
          {groups.map(g => {
            const last = g.rows[0];
            const where = [
              ...new Set(
                g.rows.map(
                  r => (r.organization_id && hospital.get(r.organization_id)) || L('Χωρίς νοσοκομείο', 'No hospital'),
                ),
              ),
            ];
            const routes = [...new Set(g.rows.map(r => r.route).filter(Boolean))];
            const versions = [...new Set(g.rows.map(r => r.app_version).filter(Boolean))];
            const kind = KIND[g.kind as keyof typeof KIND];
            return (
              <li key={g.key}>
                <button
                  type="button"
                  className="studio-error-row"
                  aria-expanded={open === g.key}
                  onClick={() => setOpen(open === g.key ? '' : g.key)}
                >
                  <span className={`studio-error-kind kind-${g.kind}`}>{kind ? L(kind[0], kind[1]) : g.kind}</span>
                  <span className="studio-error-main">
                    <b>{g.message}</b>
                    <small>
                      {where.join(', ')} · {routes.slice(0, 3).join(', ')}
                      {routes.length > 3 ? '…' : ''} · v{versions.join(', v')}
                    </small>
                  </span>
                  <span className="studio-error-count">
                    <b>{g.rows.length}×</b>
                    <small>{formatDateTime(last.occurred_at)}</small>
                  </span>
                </button>
                {open === g.key && (
                  <div className="studio-error-detail">
                    {last.detail && <pre>{last.detail}</pre>}
                    <small>{last.user_agent}</small>
                    <AppButton size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={() => void clear(g)}>
                      {L('Διαγραφή', 'Delete')}
                    </AppButton>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
