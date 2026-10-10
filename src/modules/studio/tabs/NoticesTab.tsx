import {useCallback, useEffect, useMemo, useState} from 'react';
import {Megaphone, Plus, RefreshCw, Square, Trash2} from 'lucide-react';
import AppButton from '../../../components/ui/AppButton';
import Spinner from '../../../components/ui/Spinner';
import {askConfirm} from '../../../components/ui/confirmService';
import {formatDateTime} from '../../../core/displayDate';
import {
  addNotice,
  deleteNotice,
  endNotice,
  loadNotices,
  noticeStatus,
  type NoticeStatus,
  type PlatformNotice,
} from '../../../data/cloud/platformNotices';
import type {StudioPageState} from '../useStudioPage';

/** A datetime-local value for a moment, in the browser's time zone. */
const localInput = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const toIso = (value: string) => (value ? new Date(value).toISOString() : undefined);

const STATUS: Record<NoticeStatus, [string, string]> = {
  ACTIVE: ['Εμφανίζεται', 'Showing'],
  SCHEDULED: ['Προγραμματισμένη', 'Scheduled'],
  ENDED: ['Έληξε', 'Ended'],
};
const ORDER: NoticeStatus[] = ['ACTIVE', 'SCHEDULED', 'ENDED'];

/**
 * The platform owner's notices to every user (e.g. «Συντήρηση την Κυριακή 22:00–23:00»): a new one with its
 * window, and the list of them, the ones showing now first, then the scheduled ones, then the ended ones.
 */
export default function NoticesTab({s}: {s: StudioPageState}) {
  const {L, currentUser, platformAdmin, tab} = s;
  const [notices, setNotices] = useState<PlatformNotice[] | null>(null);
  const [failed, setFailed] = useState('');
  const [message, setMessage] = useState('');
  const [from, setFrom] = useState('');
  const [until, setUntil] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setFailed('');
    try {
      setNotices(await loadNotices());
    } catch (e) {
      setFailed(e instanceof Error ? e.message : String((e as {message?: string})?.message || e));
      setNotices([]);
    }
  }, []);
  const active = tab === 'NOTICES' && platformAdmin;
  useEffect(() => {
    if (active) void load();
  }, [active, load]);
  const grouped = useMemo(() => {
    const now = Date.now();
    return ORDER.map(status => ({status, items: (notices || []).filter(n => noticeStatus(n, now) === status)}));
  }, [notices]);
  if (!active) return null;

  const wrongWindow = !!from && !!until && new Date(until) <= new Date(from);
  const pastUntil = !!until && new Date(until).getTime() <= Date.now();
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setFailed('');
    try {
      await action();
      await load();
    } catch (e) {
      setFailed(e instanceof Error ? e.message : String((e as {message?: string})?.message || e));
    } finally {
      setBusy(false);
    }
  };
  const publish = () =>
    run(async () => {
      await addNotice({message, startsAt: toIso(from), endsAt: toIso(until), byName: currentUser.name});
      setMessage('');
      setFrom('');
      setUntil('');
    });
  const remove = async (notice: PlatformNotice) => {
    const sure = await askConfirm({
      title: L('Διαγραφή ειδοποίησης', 'Delete notice'),
      message: L('Η ειδοποίηση φεύγει και από τη λίστα.', 'The notice also leaves the list.'),
      confirmLabel: L('Διαγραφή', 'Delete'),
      danger: true,
    });
    if (sure !== false) await run(() => deleteNotice(notice.id));
  };

  return (
    <section className="studio-errors studio-notices">
      <header className="studio-errors-head">
        <div>
          <h2>{L('Ειδοποιήσεις προς όλους τους χρήστες', 'Notices to every user')}</h2>
          <p>
            {L(
              'Εμφανίζονται πάνω στην εφαρμογή, σε όλα τα νοσοκομεία, από την ώρα «Από» μέχρι την ώρα «Μέχρι». Κάθε χρήστης μπορεί να κλείσει μια ειδοποίηση για τη συνεδρία του.',
              'Shown at the top of the app, in every hospital, from the "From" time until the "Until" time. Each user can close a notice for their session.',
            )}
          </p>
        </div>
        <div className="studio-errors-actions">
          <AppButton icon={<RefreshCw size={16} />} onClick={() => void load()}>
            {L('Ανανέωση', 'Refresh')}
          </AppButton>
        </div>
      </header>

      <form
        className="studio-notice-new"
        onSubmit={e => {
          e.preventDefault();
          void publish();
        }}
      >
        <label className="studio-notice-message">
          {L('Νέα ειδοποίηση', 'New notice')}
          <input
            value={message}
            maxLength={300}
            onChange={e => setMessage(e.target.value)}
            placeholder={L('Π.χ. Συντήρηση την Κυριακή 22:00–23:00', 'E.g. Maintenance on Sunday 22:00–23:00')}
          />
        </label>
        <label>
          {L('Από', 'From')}
          <input type="datetime-local" value={from} onChange={e => setFrom(e.target.value)} />
          <small>{L('Κενό: από τώρα', 'Empty: from now')}</small>
        </label>
        <label>
          {L('Μέχρι', 'Until')}
          <input
            type="datetime-local"
            value={until}
            min={from || localInput(new Date())}
            onChange={e => setUntil(e.target.value)}
          />
          <small>{L('Κενό: μέχρι να τη λήξετε', 'Empty: until you end it')}</small>
        </label>
        <AppButton
          type="submit"
          variant="primary"
          icon={<Plus size={16} />}
          disabled={busy || !message.trim() || wrongWindow || pastUntil}
        >
          {L('Δημοσίευση', 'Publish')}
        </AppButton>
        {(wrongWindow || pastUntil) && (
          <small className="studio-notice-warning" role="alert">
            {wrongWindow
              ? L('Το «Μέχρι» πρέπει να είναι μετά το «Από».', '"Until" must be after "From".')
              : L('Το «Μέχρι» έχει ήδη περάσει.', '"Until" has already passed.')}
          </small>
        )}
      </form>

      {failed && <p className="studio-errors-failed">{failed}</p>}
      {notices === null ? (
        <Spinner />
      ) : !notices.length ? (
        <div className="studio-errors-empty">
          <Megaphone size={22} />
          <strong>{L('Καμία ειδοποίηση', 'No notices')}</strong>
          <span>{L('Ό,τι δημοσιεύσετε εμφανίζεται εδώ.', 'What you publish shows here.')}</span>
        </div>
      ) : (
        grouped
          .filter(group => group.items.length)
          .map(group => (
            <div key={group.status} className="studio-notice-group">
              <h3>
                {L(...STATUS[group.status])} <span>{group.items.length}</span>
              </h3>
              <ul className="studio-errors-list">
                {group.items.map(notice => (
                  <li key={notice.id} className={`studio-notice-row status-${group.status.toLowerCase()}`}>
                    <span className={`studio-notice-status status-${group.status.toLowerCase()}`}>
                      {L(...STATUS[group.status])}
                    </span>
                    <span className="studio-error-main">
                      <b>{notice.message}</b>
                      <small>
                        {L('Από', 'From')} {formatDateTime(notice.startsAt)} · {L('Μέχρι', 'Until')}{' '}
                        {notice.endsAt ? formatDateTime(notice.endsAt) : L('να τη λήξετε', 'you end it')}
                        {notice.createdByName ? ` · ${notice.createdByName}` : ''}
                      </small>
                    </span>
                    <span className="studio-notice-actions">
                      {group.status !== 'ENDED' && (
                        <AppButton
                          size="sm"
                          icon={<Square size={14} />}
                          disabled={busy}
                          onClick={() =>
                            // One still to come is simply dropped; one showing ends now and stays in the list.
                            void run(() =>
                              group.status === 'SCHEDULED' ? deleteNotice(notice.id) : endNotice(notice.id),
                            )
                          }
                        >
                          {group.status === 'SCHEDULED' ? L('Ακύρωση', 'Cancel') : L('Λήξη τώρα', 'End now')}
                        </AppButton>
                      )}
                      <AppButton
                        size="sm"
                        variant="danger"
                        icon={<Trash2 size={14} />}
                        disabled={busy}
                        onClick={() => void remove(notice)}
                      >
                        {L('Διαγραφή', 'Delete')}
                      </AppButton>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))
      )}
    </section>
  );
}
