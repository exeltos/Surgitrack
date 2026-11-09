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
  safeLink,
  type NoticeAudience,
  type NoticeKind,
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
  const {L, currentUser, displayedOrganizations, platformAdmin, tab} = s;
  const [notices, setNotices] = useState<PlatformNotice[] | null>(null);
  const [failed, setFailed] = useState('');
  const [message, setMessage] = useState('');
  const [from, setFrom] = useState('');
  const [until, setUntil] = useState('');
  const [kind, setKind] = useState<NoticeKind>('NOTICE');
  const [audience, setAudience] = useState<NoticeAudience>('ALL');
  const [title, setTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [onlyChosen, setOnlyChosen] = useState(false);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
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

  const wrongWindow = !!from && !!until && new Date(until) <= new Date(from);
  const pastUntil = !!until && new Date(until).getTime() <= Date.now();
  const promo = kind === 'PROMO';
  // A promotion is for the administrators and has a title; a link opens over https only.
  const badLink = !!linkUrl.trim() && !safeLink(linkUrl.trim());
  const noTitle = promo && !title.trim();
  const noHospital = onlyChosen && chosen.size === 0;
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
      await addNotice({
        message,
        kind,
        audience: promo ? 'ADMINS' : audience,
        title: promo || title.trim() ? title : undefined,
        linkUrl: linkUrl.trim() || undefined,
        linkLabel: linkLabel.trim() || undefined,
        organizationIds: onlyChosen ? [...chosen] : undefined,
        startsAt: toIso(from),
        endsAt: toIso(until),
        byName: currentUser.name,
      });
      setMessage('');
      setTitle('');
      setLinkUrl('');
      setLinkLabel('');
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
          <h2>{L('Ανακοινώσεις και προωθήσεις', 'Announcements and promotions')}</h2>
          <p>
            {L(
              'Η ανακοίνωση εμφανίζεται ως γραμμή πάνω στην εφαρμογή, σε όλους ή μόνο στους διαχειριστές, από την ώρα «Από» μέχρι την ώρα «Μέχρι». Η προώθηση (π.χ. ένα προϊόν) εμφανίζεται ως κάρτα στην Επισκόπηση του διαχειριστή του νοσοκομείου, με τίτλο και σύνδεσμο. Και τα δύο μπορούν να πάνε σε όλα τα νοσοκομεία ή σε επιλεγμένα.',
              'An announcement shows as a line at the top of the app, to everyone or only to the administrators, from the "From" time until the "Until" time. A promotion (e.g. a product) shows as a card on the hospital administrator’s Overview, with a title and a link. Either can go to every hospital or to chosen ones.',
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
        <div className="studio-notice-extra">
          <label>
            {L('Είδος', 'Kind')}
            <select value={kind} onChange={e => setKind(e.target.value as NoticeKind)}>
              <option value="NOTICE">{L('Ανακοίνωση (γραμμή στην κορυφή)', 'Announcement (line at the top)')}</option>
              <option value="PROMO">{L('Προώθηση (κάρτα στην Επισκόπηση)', 'Promotion (card on the Overview)')}</option>
            </select>
          </label>
          <label>
            {L('Προς', 'To')}
            <select
              value={promo ? 'ADMINS' : audience}
              disabled={promo}
              onChange={e => setAudience(e.target.value as NoticeAudience)}
            >
              <option value="ALL">{L('Όλους τους χρήστες', 'Every user')}</option>
              <option value="ADMINS">{L('Μόνο τους διαχειριστές νοσοκομείων', 'Hospital administrators only')}</option>
            </select>
            {promo && (
              <small>{L('Οι προωθήσεις πάνε μόνο στους διαχειριστές.', 'Promotions go to administrators only.')}</small>
            )}
          </label>
          {(promo || title) && (
            <label>
              {L('Τίτλος', 'Title')}
              <input value={title} maxLength={120} onChange={e => setTitle(e.target.value)} />
            </label>
          )}
          <label className="studio-notice-link">
            {L('Σύνδεσμος (προαιρετικός, https)', 'Link (optional, https)')}
            <input
              value={linkUrl}
              maxLength={500}
              inputMode="url"
              onChange={e => setLinkUrl(e.target.value)}
              placeholder="https://"
            />
          </label>
          {linkUrl.trim() && (
            <label>
              {L('Κείμενο κουμπιού', 'Button text')}
              <input
                value={linkLabel}
                maxLength={40}
                onChange={e => setLinkLabel(e.target.value)}
                placeholder={L('Περισσότερα', 'Learn more')}
              />
            </label>
          )}
        </div>
        <fieldset className="studio-notice-hospitals">
          <legend>{L('Νοσοκομεία', 'Hospitals')}</legend>
          <label className="studio-notice-radio">
            <input type="radio" name="notice-hospitals" checked={!onlyChosen} onChange={() => setOnlyChosen(false)} />
            {L('Όλα τα νοσοκομεία', 'Every hospital')}
          </label>
          <label className="studio-notice-radio">
            <input type="radio" name="notice-hospitals" checked={onlyChosen} onChange={() => setOnlyChosen(true)} />
            {L('Μόνο τα επιλεγμένα', 'Only the chosen ones')}
          </label>
          {onlyChosen && (
            <ul className="studio-notice-orgs">
              {displayedOrganizations.map(org => (
                <li key={org.id}>
                  <label className="studio-notice-radio">
                    <input
                      type="checkbox"
                      checked={chosen.has(org.id)}
                      onChange={() =>
                        setChosen(current => {
                          const next = new Set(current);
                          if (next.has(org.id)) next.delete(org.id);
                          else next.add(org.id);
                          return next;
                        })
                      }
                    />
                    {org.name}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
        <label className="studio-notice-message">
          {promo ? L('Κείμενο προώθησης', 'Promotion text') : L('Νέα ανακοίνωση', 'New announcement')}
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
          disabled={busy || !message.trim() || wrongWindow || pastUntil || badLink || noTitle || noHospital}
        >
          {L('Δημοσίευση', 'Publish')}
        </AppButton>
        {(wrongWindow || pastUntil || badLink || noTitle || noHospital) && (
          <small className="studio-notice-warning" role="alert">
            {wrongWindow
              ? L('Το «Μέχρι» πρέπει να είναι μετά το «Από».', '"Until" must be after "From".')
              : pastUntil
                ? L('Το «Μέχρι» έχει ήδη περάσει.', '"Until" has already passed.')
                : badLink
                  ? L(
                      'Ο σύνδεσμος πρέπει να αρχίζει με https:// και να μην έχει κενά.',
                      'The link must start with https:// and have no spaces.',
                    )
                  : noTitle
                    ? L('Η προώθηση χρειάζεται τίτλο.', 'A promotion needs a title.')
                    : L('Διαλέξτε τουλάχιστον ένα νοσοκομείο.', 'Choose at least one hospital.')}
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
