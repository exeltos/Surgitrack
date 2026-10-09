import {useState} from 'react';
import {Sparkles, X} from 'lucide-react';
import AppButton from '../ui/AppButton';
import {APP_VERSION} from '../../config/appMeta';
import {getRuntimeDataMode} from '../../config/dataMode';
import {formatDate} from '../../core/displayDate';
import type {Permission} from '../../core/permissions';
import {notesFor, olderVersion, releases, type Release} from '../../core/whatsNew';
import {getRealIdentity} from '../../data/cloud/identity';
import {tr} from '../../i18n';

const seenKey = (userId: string) => `surgitrack-seen-version:${userId}`;

/** The notes of one release this user can use, as a list. */
export function ReleaseNotes({
  release,
  lang,
  can,
}: {
  release: Release;
  lang: 'el' | 'en';
  can: (p: Permission) => boolean;
}) {
  return (
    <ul className="whats-new-notes">
      {notesFor(release, can).map(note => (
        <li key={note.el}>{note[lang]}</li>
      ))}
    </ul>
  );
}

/** Every release with notes for this user, newest first (Help → What's new). */
export function ReleaseHistory({lang, can}: {lang: 'el' | 'en'; can: (p: Permission) => boolean}) {
  return (
    <>
      {releases
        .filter(r => notesFor(r, can).length)
        .map(r => (
          <section key={r.version} className="whats-new-release">
            <h2>
              v{r.version} <small>{formatDate(r.date)}</small>
            </h2>
            <ReleaseNotes release={r} lang={lang} can={can} />
          </section>
        ))}
    </>
  );
}

/**
 * Once after an update, per person (devices are shared on the wards): what changed that they can use.
 * Someone who never saw a version before (a new account or device) is told nothing and starts from this one.
 */
export default function WhatsNewDialog({lang, can}: {lang: 'el' | 'en'; can: (p: Permission) => boolean}) {
  const userId = getRuntimeDataMode() === 'PRODUCTION' ? getRealIdentity()?.id : undefined;
  const [open, setOpen] = useState(() => {
    if (!userId) return false;
    try {
      const seen = localStorage.getItem(seenKey(userId));
      if (!seen) localStorage.setItem(seenKey(userId), APP_VERSION);
      return !!seen && olderVersion(seen, APP_VERSION);
    } catch {
      return false;
    }
  });
  const release = releases.find(r => r.version === APP_VERSION);
  if (!open || !userId || !release || !notesFor(release, can).length) return null;
  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(seenKey(userId), APP_VERSION);
    } catch {
      // Private mode: asked again next time.
    }
  };
  return (
    <div className="modal-backdrop confirm-dialog-backdrop" onMouseDown={e => e.currentTarget === e.target && close()}>
      <div
        className="confirm-dialog whats-new-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
      >
        <header>
          <div className="confirm-icon whats-new-icon">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 id="whats-new-title">{tr('Τι νέο υπάρχει')}</h3>
            <p>{tr('Η εφαρμογή ενημερώθηκε στην έκδοση {0}.', `v${APP_VERSION}`)}</p>
          </div>
          <button className="icon-button" onClick={close} aria-label={tr('Κλείσιμο')}>
            <X size={18} />
          </button>
        </header>
        <ReleaseNotes release={release} lang={lang} can={can} />
        <footer>
          <AppButton variant="primary" autoFocus onClick={close}>
            {tr('Εντάξει')}
          </AppButton>
        </footer>
      </div>
    </div>
  );
}
