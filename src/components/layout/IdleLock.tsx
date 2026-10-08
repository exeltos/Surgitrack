import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {Lock, LogIn} from 'lucide-react';
import {supabase} from '../../lib/supabase';
import {useSyncInfo} from '../../data/cloud/useAppRecordSync';
import {tr} from '../../i18n';

const LOCK_KEY = 'surgitrack-screen-locked';
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const;
/** How often the idle time is checked (the lock may come up to this much later than the setting). */
const CHECK_MS = 15000;

/**
 * Locks the screen after the hospital's idle time (Studio → Settings), for shared tablets and computers.
 * The app stays mounted behind the lock, so syncing goes on and nothing unsaved is lost. The same user
 * unlocks with their password; anyone else signs in as themselves. A reload does not skip the lock.
 */
export default function IdleLock({
  minutes,
  userName,
  hospital,
  onSwitchUser,
}: {
  minutes: number;
  userName: string;
  hospital?: string;
  onSwitchUser?: () => void;
}) {
  const [locked, setLocked] = useState(() => sessionStorage.getItem(LOCK_KEY) === '1');
  const lastActivity = useRef(Date.now());

  useEffect(() => {
    if (!minutes || locked) return;
    lastActivity.current = Date.now();
    const limit = minutes * 60000;
    const mark = () => {
      lastActivity.current = Date.now();
    };
    const check = () => {
      if (Date.now() - lastActivity.current < limit) return;
      sessionStorage.setItem(LOCK_KEY, '1');
      setLocked(true);
    };
    ACTIVITY_EVENTS.forEach(event => window.addEventListener(event, mark, {passive: true, capture: true}));
    // A tablet that slept past the idle time locks as soon as it wakes.
    const onShow = () => {
      if (!document.hidden) check();
    };
    document.addEventListener('visibilitychange', onShow);
    const timer = window.setInterval(check, CHECK_MS);
    return () => {
      ACTIVITY_EVENTS.forEach(event => window.removeEventListener(event, mark, {capture: true}));
      document.removeEventListener('visibilitychange', onShow);
      window.clearInterval(timer);
    };
  }, [minutes, locked]);

  // Nothing behind the lock can be reached with the keyboard or a screen reader.
  useEffect(() => {
    const shell = document.querySelector<HTMLElement>('.app-shell');
    if (!shell) return;
    if (locked) shell.setAttribute('inert', '');
    else shell.removeAttribute('inert');
    return () => shell.removeAttribute('inert');
  }, [locked]);

  if (!locked) return null;
  return createPortal(
    <LockScreen
      userName={userName}
      hospital={hospital}
      onUnlock={() => {
        sessionStorage.removeItem(LOCK_KEY);
        setLocked(false);
      }}
      onSwitchUser={onSwitchUser}
    />,
    document.body,
  );
}

/** Clears the lock (sign-out: the next user starts unlocked). */
export const clearIdleLock = () => sessionStorage.removeItem(LOCK_KEY);

function LockScreen({
  userName,
  hospital,
  onUnlock,
  onSwitchUser,
}: {
  userName: string;
  hospital?: string;
  onUnlock: () => void;
  onSwitchUser?: () => void;
}) {
  const sync = useSyncInfo();
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({data}) => setEmail(data.user?.email || null));
  }, []);

  // Demo on this device only (no account): the lock still hides the screen; no password to check.
  const passwordless = email === null;
  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordless) return onUnlock();
    if (!email || !password) return;
    setBusy(true);
    setError('');
    const {data, error: signInError} = await supabase.auth.signInWithPassword({email, password});
    setBusy(false);
    // The email is the signed-in account's own, so only that account's password unlocks.
    if (signInError || !data.user) {
      setError(tr('Λάθος συνθηματικό.'));
      setPassword('');
      return;
    }
    setPassword('');
    onUnlock();
  };
  const switchUser = () => {
    if (!onSwitchUser) return;
    if (
      sync.status !== 'saved' &&
      !window.confirm(
        tr(
          'Δεν έχουν αποθηκευτεί ακόμη {0} αλλαγές αυτού του χρήστη. Αν συνδεθεί άλλος χρήστης τώρα, θα χαθούν. Συνέχεια;',
          sync.pendingRecords || 1,
        ),
      )
    )
      return;
    sessionStorage.removeItem(LOCK_KEY);
    onSwitchUser();
  };

  return (
    <div className="idle-lock" role="dialog" aria-modal="true" aria-labelledby="idle-lock-title">
      <form className="idle-lock-card" onSubmit={e => void unlock(e)}>
        <span className="idle-lock-icon" aria-hidden="true">
          <Lock size={26} />
        </span>
        <h2 id="idle-lock-title">{tr('Η οθόνη κλειδώθηκε')}</h2>
        <p>{tr('Κλείδωσε λόγω αδράνειας. Οι αλλαγές συνεχίζουν να αποθηκεύονται.')}</p>
        <div className="idle-lock-user">
          <b>{userName}</b>
          {hospital && <small>{hospital}</small>}
        </div>
        {!passwordless && (
          <label>
            <span>{tr('Συνθηματικό')}</span>
            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={busy || email === undefined}
            />
          </label>
        )}
        {error && (
          <p className="idle-lock-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="primary" disabled={busy || (!passwordless && !password)}>
          {busy ? tr('Έλεγχος…') : tr('Ξεκλείδωμα')}
        </button>
        {onSwitchUser && (
          <button type="button" className="idle-lock-switch" onClick={switchUser}>
            <LogIn size={15} /> {tr('Σύνδεση με άλλο χρήστη')}
          </button>
        )}
      </form>
    </div>
  );
}
