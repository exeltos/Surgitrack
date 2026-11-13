import {useCallback, useEffect, useMemo, useState} from 'react';
import {Megaphone, RefreshCw, Square, Trash2} from 'lucide-react';
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
import {uploadPromoFile, uploadPromoImage} from '../../../data/cloud/promoImage';
import NoticeComposer, {type NoticeFields} from './NoticeComposer';

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
  const {L, currentUser, displayedOrganizations, platformAdmin, tab} = s;
  const [notices, setNotices] = useState<PlatformNotice[] | null>(null);
  const [failed, setFailed] = useState('');
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
  const hospitalName = useMemo(
    () => new Map(displayedOrganizations.map(o => [o.id, o.name])),
    [displayedOrganizations],
  );
  const grouped = useMemo(() => {
    const now = Date.now();
    return ORDER.map(status => ({status, items: (notices || []).filter(n => noticeStatus(n, now) === status)}));
  }, [notices]);
  if (!active) return null;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setFailed('');
    try {
      await action();
      await load();
      return true;
    } catch (e) {
      setFailed(e instanceof Error ? e.message : String((e as {message?: string})?.message || e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const publish = (fields: NoticeFields) => run(() => addNotice({...fields, byName: currentUser.name}));
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
      <NoticeComposer
        L={L}
        organizations={displayedOrganizations.map(o => ({id: o.id, name: o.name}))}
        busy={busy}
        onPublish={publish}
        onUploadImage={uploadPromoImage}
        onUploadFile={uploadPromoFile}
      />

      {/* «Ανανέωση» refreshes the published notices, so it heads their list (not a row of its own above the form). */}
      <header className="studio-notices-listhead">
        <h2>{L('Δημοσιευμένες ειδοποιήσεις', 'Published notices')}</h2>
        <AppButton icon={<RefreshCw size={16} />} onClick={() => void load()}>
          {L('Ανανέωση', 'Refresh')}
        </AppButton>
      </header>
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
                      <b>
                        {notice.kind === 'PROMO' && (
                          <em className="studio-notice-kind">{L('Προώθηση', 'Promotion')}</em>
                        )}
                        {notice.title ? `${notice.title} · ` : ''}
                        {notice.message}
                      </b>
                      <small>
                        {notice.audience === 'ADMINS'
                          ? L('Μόνο διαχειριστές', 'Administrators only')
                          : L('Όλοι οι χρήστες', 'Every user')}
                        {' · '}
                        {notice.organizationIds
                          ? notice.organizationIds.map(id => hospitalName.get(id) || '—').join(', ')
                          : L('Όλα τα νοσοκομεία', 'Every hospital')}
                        {notice.linkUrl ? ` · ${notice.linkUrl}` : ''}
                      </small>
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
