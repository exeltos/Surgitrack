import {useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import {Eye, EyeOff, KeyRound} from 'lucide-react';
import {supabase} from '../../lib/supabase';
import {passwordOk} from '../../core/passwordRules';
import {PasswordFields} from '../auth/PasswordFields';
import AppButton from '../ui/AppButton';
import {getI18nLang, tr} from '../../i18n';

/**
 * The signed-in person changes their own password: the current one first (so an unattended, signed-in screen
 * cannot be taken over), then the new one twice, with the same rules as everywhere else.
 */
export default function ChangePasswordDialog({onClose}: {onClose: () => void}) {
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [current, setCurrent] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({data}) => setEmail(data.user?.email || null));
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email) return setError(tr('Ο κωδικός αλλάζει μόνο σε λογαριασμό που έχει συνδεθεί.'));
    if (!passwordOk(next))
      return setError(tr('Ο νέος κωδικός πρέπει να έχει τουλάχιστον 10 χαρακτήρες, με ένα γράμμα και έναν αριθμό.'));
    if (next !== again) return setError(tr('Οι δύο νέοι κωδικοί δεν ταιριάζουν.'));
    if (next === current) return setError(tr('Ο νέος κωδικός πρέπει να διαφέρει από τον τρέχοντα.'));
    setBusy(true);
    // The current password, checked against this account only.
    const {data, error: checkError} = await supabase.auth.signInWithPassword({email, password: current});
    if (checkError || !data.user) {
      setBusy(false);
      setCurrent('');
      return setError(tr('Ο τρέχων κωδικός δεν είναι σωστός.'));
    }
    const {error: updateError} = await supabase.auth.updateUser({password: next});
    setBusy(false);
    if (updateError) {
      return setError(
        updateError.code === 'weak_password'
          ? tr('Ο κωδικός είναι πολύ κοινός (υπάρχει σε λίστες κωδικών που έχουν διαρρεύσει). Διαλέξτε άλλον.')
          : tr('Ο κωδικός δεν άλλαξε. Δοκιμάστε ξανά σε λίγο.'),
      );
    }
    setDone(true);
  };

  // Over the whole app (menu included), not inside the top bar where the button sits.
  return createPortal(
    <div
      className="modal-backdrop confirm-dialog-backdrop"
      onMouseDown={e => e.currentTarget === e.target && !busy && onClose()}
    >
      <form
        className="confirm-dialog change-password-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
        onSubmit={e => void submit(e)}
      >
        <header>
          <div className="confirm-icon">
            <KeyRound size={20} />
          </div>
          <div>
            <h3 id="change-password-title">{tr('Αλλαγή κωδικού')}</h3>
            <p>
              {done
                ? tr('Ο κωδικός σας άλλαξε. Την επόμενη φορά συνδέεστε με τον νέο.')
                : tr('Για ασφάλεια, γράψτε πρώτα τον τρέχοντα κωδικό σας.')}
            </p>
          </div>
        </header>
        {!done && (
          <div className="change-password-fields">
            <label>
              {tr('Τρέχων κωδικός')}
              <div className="auth-input">
                <KeyRound size={17} />
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={current}
                  onChange={e => setCurrent(e.target.value)}
                  autoComplete="current-password"
                  autoFocus
                  required
                  disabled={busy}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(v => !v)}
                  aria-label={showCurrent ? tr('Απόκρυψη συνθηματικού') : tr('Εμφάνιση συνθηματικού')}
                  aria-pressed={showCurrent}
                >
                  {showCurrent ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
            <PasswordFields
              el={getI18nLang() === 'el'}
              label={tr('Νέος κωδικός')}
              password={next}
              confirm={again}
              onPassword={setNext}
              onConfirm={setAgain}
            />
            {error && (
              <p className="change-password-error" role="alert">
                {error}
              </p>
            )}
          </div>
        )}
        <footer>
          {done ? (
            <AppButton variant="primary" type="button" onClick={onClose} autoFocus>
              {tr('Κλείσιμο')}
            </AppButton>
          ) : (
            <>
              <AppButton type="button" onClick={onClose} disabled={busy}>
                {tr('Ακύρωση')}
              </AppButton>
              <AppButton
                variant="primary"
                type="submit"
                disabled={busy || !current || !next || !again || email === undefined}
              >
                {busy ? tr('Έλεγχος…') : tr('Αποθήκευση νέου κωδικού')}
              </AppButton>
            </>
          )}
        </footer>
      </form>
    </div>,
    document.body,
  );
}
