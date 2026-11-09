import {useMemo, useState} from 'react';
import {ExternalLink, Megaphone, Plus} from 'lucide-react';
import AppButton from '../../../components/ui/AppButton';
import {safeLink, type NoticeAudience, type NoticeKind} from '../../../data/cloud/platformNotices';

type Lang = (el: string, en: string) => string;

/** What the owner publishes: the form hands it over, the database decides who reads it. */
export type NoticeFields = {
  message: string;
  kind: NoticeKind;
  audience: NoticeAudience;
  title?: string;
  linkUrl?: string;
  linkLabel?: string;
  imageUrl?: string;
  organizationIds?: string[];
  startsAt?: string;
  endsAt?: string;
};

const MESSAGE_MAX = 300;
const toIso = (value: string) => (value ? new Date(value).toISOString() : undefined);
/** A datetime-local value for a moment, in the browser's time zone. */
const localInput = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/** A choice between a few options, each with a line saying what it does. */
function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{id: T; title: string; hint?: string; disabled?: boolean}>;
  onChange: (id: T) => void;
}) {
  return (
    <div className="notice-choice-group">
      <span className="notice-choice-label">{label}</span>
      <div className="notice-choice" role="radiogroup" aria-label={label}>
        {options.map(option => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={value === option.id}
            disabled={option.disabled}
            className={value === option.id ? 'on' : ''}
            onClick={() => onChange(option.id)}
          >
            <i className="notice-dot" aria-hidden="true" />
            <b>{option.title}</b>
            {option.hint && <small>{option.hint}</small>}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The owner's form for an announcement or a promotion, in three parts (what, to whom, when) with a preview of what
 * the administrators will see. `onPublish` says whether it was published (the form then empties).
 */
export default function NoticeComposer({
  L,
  organizations,
  busy,
  onPublish,
  onUploadImage,
}: {
  L: Lang;
  organizations: Array<{id: string; name: string}>;
  busy: boolean;
  onPublish: (fields: NoticeFields) => Promise<boolean>;
  /** Uploads a picture chosen on the device and gives back its https address. */
  onUploadImage: (file: File) => Promise<string>;
}) {
  const [kind, setKind] = useState<NoticeKind>('NOTICE');
  const [audience, setAudience] = useState<NoticeAudience>('ALL');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [brokenImage, setBrokenImage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [onlyChosen, setOnlyChosen] = useState(false);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [until, setUntil] = useState('');

  const promo = kind === 'PROMO';
  const to: NoticeAudience = promo ? 'ADMINS' : audience;
  const link = linkUrl.trim();
  const image = promo ? imageUrl.trim() : '';
  const problem = !message.trim()
    ? ''
    : promo && !title.trim()
      ? L('Η προώθηση χρειάζεται τίτλο.', 'A promotion needs a title.')
      : link && !safeLink(link)
        ? L(
            'Ο σύνδεσμος πρέπει να αρχίζει με https:// και να μην έχει κενά.',
            'The link must start with https:// and have no spaces.',
          )
        : onlyChosen && chosen.size === 0
          ? L('Διαλέξτε τουλάχιστον ένα νοσοκομείο.', 'Choose at least one hospital.')
          : from && until && new Date(until) <= new Date(from)
            ? L('Το «Μέχρι» πρέπει να είναι μετά το «Από».', '"Until" must be after "From".')
            : until && new Date(until).getTime() <= Date.now()
              ? L('Το «Μέχρι» έχει ήδη περάσει.', '"Until" has already passed.')
              : '';
  const ready = !!message.trim() && !problem && !busy && !uploading;
  const choosePicture = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      setImageUrl(await onUploadImage(file));
    } catch {
      setUploadError(
        L(
          'Η εικόνα δεν ανέβηκε. Δοκιμάστε άλλο αρχείο (JPEG, PNG ή WebP).',
          'The picture did not upload. Try another file (JPEG, PNG or WebP).',
        ),
      );
    } finally {
      setUploading(false);
    }
  };
  const shown = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('el-GR');
    return organizations.filter(o => !q || o.name.toLocaleLowerCase('el-GR').includes(q));
  }, [organizations, search]);
  const who = `${to === 'ADMINS' ? L('Διαχειριστές', 'Administrators') : L('Όλοι οι χρήστες', 'Every user')} · ${
    onlyChosen
      ? chosen.size
        ? organizations
            .filter(o => chosen.has(o.id))
            .map(o => o.name)
            .join(', ')
        : L('κανένα νοσοκομείο ακόμα', 'no hospital yet')
      : L('όλα τα νοσοκομεία', 'every hospital')
  }`;
  const toggle = (id: string) =>
    setChosen(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const publish = async () => {
    const done = await onPublish({
      message,
      kind,
      audience: to,
      title: promo || title.trim() ? title : undefined,
      linkUrl: link || undefined,
      linkLabel: linkLabel.trim() || undefined,
      imageUrl: image || undefined,
      organizationIds: onlyChosen ? [...chosen] : undefined,
      startsAt: toIso(from),
      endsAt: toIso(until),
    });
    if (done) {
      setTitle('');
      setMessage('');
      setLinkUrl('');
      setLinkLabel('');
      setImageUrl('');
      setFrom('');
      setUntil('');
    }
  };

  return (
    <form
      className="notice-composer"
      onSubmit={e => {
        e.preventDefault();
        if (ready) void publish();
      }}
    >
      <div className="notice-form">
        <fieldset className="notice-block">
          <legend className="sr-only">{L('1 · Τι θα δείξετε', '1 · What to show')}</legend>
          <h3 className="notice-block-title" aria-hidden="true">
            {L('1 · Τι θα δείξετε', '1 · What to show')}
          </h3>
          <Choice
            label={L('Είδος', 'Kind')}
            value={kind}
            onChange={setKind}
            options={[
              {
                id: 'NOTICE',
                title: L('Ανακοίνωση', 'Announcement'),
                hint: L('Γραμμή στην κορυφή της εφαρμογής', 'A line at the top of the app'),
              },
              {
                id: 'PROMO',
                title: L('Προώθηση', 'Promotion'),
                hint: L(
                  'Κάρτα με τίτλο και σύνδεσμο στην Επισκόπηση του διαχειριστή',
                  'A card with a title and a link on the administrator’s Overview',
                ),
              },
            ]}
          />
          {promo && (
            <label>
              {L('Τίτλος', 'Title')}
              <input value={title} maxLength={120} onChange={e => setTitle(e.target.value)} />
            </label>
          )}
          <label>
            {promo ? L('Κείμενο', 'Text') : L('Μήνυμα', 'Message')}
            <textarea
              rows={3}
              value={message}
              maxLength={MESSAGE_MAX}
              onChange={e => setMessage(e.target.value)}
              placeholder={
                promo
                  ? L(
                      'Π.χ. Παρακολουθήστε όλους τους κλιβάνους σε μία οθόνη.',
                      'E.g. Watch every sterilizer on one screen.',
                    )
                  : L('Π.χ. Συντήρηση την Κυριακή 22:00–23:00', 'E.g. Maintenance on Sunday 22:00–23:00')
              }
            />
            <small>
              {message.length} / {MESSAGE_MAX}
            </small>
          </label>
          {promo && (
            <div className="notice-picture">
              <span className="notice-choice-label">
                {L('Εικόνα προϊόντος (προαιρετική)', 'Product picture (optional)')}
              </span>
              {image ? (
                <div className="notice-picture-row">
                  <img src={image} alt="" />
                  <button type="button" onClick={() => setImageUrl('')}>
                    {L('Αφαίρεση εικόνας', 'Remove picture')}
                  </button>
                </div>
              ) : (
                <label className="notice-picture-pick">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={uploading}
                    aria-label={L('Επιλογή εικόνας', 'Choose a picture')}
                    onChange={e => {
                      void choosePicture(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                  <small>
                    {uploading
                      ? L('Ανέβασμα…', 'Uploading…')
                      : L(
                          'Διαλέξτε αρχείο από τον υπολογιστή (JPEG, PNG ή WebP).',
                          'Choose a file from your computer (JPEG, PNG or WebP).',
                        )}
                  </small>
                </label>
              )}
            </div>
          )}
          <div className="notice-button-box">
            <span className="notice-choice-label">
              {L('Κουμπί με σύνδεσμο (προαιρετικό)', 'Button with a link (optional)')}
            </span>
            <div className="notice-row">
              <label>
                {L('Σύνδεσμος', 'Link')}
                <input
                  value={linkUrl}
                  maxLength={500}
                  inputMode="url"
                  placeholder="https://"
                  onChange={e => setLinkUrl(e.target.value)}
                />
              </label>
              <label>
                {L('Κείμενο κουμπιού', 'Button text')}
                <input
                  value={linkLabel}
                  maxLength={40}
                  placeholder={L('Π.χ. Πατήστε εδώ', 'E.g. Click here')}
                  onChange={e => setLinkLabel(e.target.value)}
                />
              </label>
            </div>
          </div>
        </fieldset>

        <fieldset className="notice-block">
          <legend className="sr-only">{L('2 · Σε ποιους', '2 · To whom')}</legend>
          <h3 className="notice-block-title" aria-hidden="true">
            {L('2 · Σε ποιους', '2 · To whom')}
          </h3>
          <Choice
            label={L('Χρήστες', 'Users')}
            value={to}
            onChange={setAudience}
            options={[
              {id: 'ALL', title: L('Όλοι οι χρήστες', 'Every user'), disabled: promo},
              {id: 'ADMINS', title: L('Μόνο διαχειριστές νοσοκομείων', 'Hospital administrators only')},
            ]}
          />
          {promo && (
            <small className="notice-note">
              {L(
                'Οι προωθήσεις πηγαίνουν πάντα μόνο στους διαχειριστές.',
                'Promotions always go to the administrators only.',
              )}
            </small>
          )}
          <Choice
            label={L('Νοσοκομεία', 'Hospitals')}
            value={onlyChosen ? 'SOME' : 'ALL'}
            onChange={id => setOnlyChosen(id === 'SOME')}
            options={[
              {id: 'ALL', title: L('Όλα τα νοσοκομεία', 'Every hospital')},
              {id: 'SOME', title: L('Μόνο επιλεγμένα', 'Only chosen ones')},
            ]}
          />
          {onlyChosen && (
            <div className="notice-orgs">
              <div className="notice-orgs-bar">
                <input
                  type="search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={L('Αναζήτηση νοσοκομείου', 'Search a hospital')}
                  aria-label={L('Αναζήτηση νοσοκομείου', 'Search a hospital')}
                />
                <button type="button" onClick={() => setChosen(new Set(organizations.map(o => o.id)))}>
                  {L('Όλα', 'All')}
                </button>
                <button type="button" onClick={() => setChosen(new Set())}>
                  {L('Κανένα', 'None')}
                </button>
                <span>
                  {chosen.size} / {organizations.length}
                </span>
              </div>
              <ul>
                {shown.map(org => (
                  <li key={org.id}>
                    <label>
                      <input type="checkbox" checked={chosen.has(org.id)} onChange={() => toggle(org.id)} />
                      {org.name}
                    </label>
                  </li>
                ))}
                {!shown.length && <li className="muted">{L('Κανένα αποτέλεσμα.', 'No results.')}</li>}
              </ul>
            </div>
          )}
        </fieldset>

        <fieldset className="notice-block">
          <legend className="sr-only">{L('3 · Πότε', '3 · When')}</legend>
          <h3 className="notice-block-title" aria-hidden="true">
            {L('3 · Πότε', '3 · When')}
          </h3>
          <div className="notice-row">
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
          </div>
        </fieldset>

        <div className="notice-footer">
          <p role="alert">{problem || uploadError}</p>
          <AppButton type="submit" variant="primary" icon={<Plus size={16} />} disabled={!ready}>
            {L('Δημοσίευση', 'Publish')}
          </AppButton>
        </div>
      </div>

      <aside className="notice-preview" aria-label={L('Προεπισκόπηση', 'Preview')}>
        <h3>{L('Προεπισκόπηση', 'Preview')}</h3>
        <p className="notice-preview-who">{who}</p>
        {promo ? (
          <article className="promo-card">
            <Megaphone size={20} aria-hidden="true" />
            {safeLink(image) && brokenImage !== image && (
              <img className="promo-image" src={image} alt="" onError={() => setBrokenImage(image)} />
            )}
            <div>
              <small>{L('Πρόταση', 'Suggestion')}</small>
              <h3>{title.trim() || L('Τίτλος προώθησης', 'Promotion title')}</h3>
              <p>{message.trim() || L('Το κείμενο θα εμφανιστεί εδώ.', 'The text will show here.')}</p>
              {link && (
                <span className="promo-cta">
                  {linkLabel.trim() || L('Περισσότερα', 'Learn more')} <ExternalLink size={14} aria-hidden="true" />
                </span>
              )}
            </div>
          </article>
        ) : (
          <div className="trial-strip maintenance-strip" role="presentation">
            <Megaphone size={16} aria-hidden="true" />
            <span>{message.trim() || L('Το μήνυμα θα εμφανιστεί εδώ.', 'The message will show here.')}</span>
          </div>
        )}
      </aside>
    </form>
  );
}
