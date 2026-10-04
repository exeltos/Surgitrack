import {useState} from 'react';
import {KeyRound, Mail} from 'lucide-react';
import {markRecovery, supabase} from '../../lib/supabase';

/**
 * What an emailed link carries: `?st_token=<token hash>&st_link=invite|recovery` (not "type=", which
 * the client would take for a link it has already used).
 */
export const emailLink = (): {token: string; type: 'invite' | 'recovery'} | undefined => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('st_token');
  const type = params.get('st_link');
  return token && (type === 'invite' || type === 'recovery') ? {token, type} : undefined;
};

/**
 * Opening an invitation or password-reset email lands here, and the one-time link is used only
 * when the person presses the button. Hospital mail filters open every link in a message to check
 * it; a link that signed in on open was spent by the filter before the person ever saw it.
 */
export default function EmailLinkPage({token, type}: {token: string; type: 'invite' | 'recovery'}) {
  const el = (localStorage.getItem('surgitrack-lang') || 'el') !== 'en';
  const L = (gr: string, en: string) => (el ? gr : en);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const home = `${window.location.origin}${window.location.pathname}#/`;

  const proceed = async () => {
    setBusy(true);
    const {error} = await supabase.auth.verifyOtp({token_hash: token, type});
    if (error) {
      setBusy(false);
      setFailed(true);
      return;
    }
    // Signed in: the app opens on the "set your password" form.
    markRecovery();
    window.location.replace(home);
  };

  const invite = type === 'invite';
  return (
    <div className="email-link-page">
      <div className="email-link-card">
        <div className="email-link-brand">
          <span>S</span>
          <div>
            <b>SurgiTrack</b>
            <small>Surgical Instrument Traceability</small>
          </div>
        </div>
        <div className="email-link-icon">{invite ? <Mail size={26} /> : <KeyRound size={26} />}</div>
        <h1>
          {invite ? L('Καλώς ήρθατε στο SurgiTrack', 'Welcome to SurgiTrack') : L('Νέος κωδικός', 'New password')}
        </h1>
        {failed ? (
          <>
            <p className="email-link-error">
              {L(
                'Ο σύνδεσμος έχει λήξει ή έχει ήδη χρησιμοποιηθεί. Ζητήστε νέα πρόσκληση από τον διαχειριστή σας, ή χρησιμοποιήστε «Ξέχασα τον κωδικό» στη σελίδα σύνδεσης.',
                'The link has expired or was already used. Ask your administrator for a new invitation, or use «Forgot password» on the sign-in page.',
              )}
            </p>
            <a className="email-link-button" href={home}>
              {L('Σελίδα σύνδεσης', 'Sign-in page')}
            </a>
          </>
        ) : (
          <>
            <p>
              {invite
                ? L(
                    'Έχετε πρόσκληση να χρησιμοποιήσετε το SurgiTrack. Πατήστε «Συνέχεια» για να ορίσετε τον κωδικό σας.',
                    'You are invited to use SurgiTrack. Press «Continue» to set your password.',
                  )
                : L('Πατήστε «Συνέχεια» για να ορίσετε νέο κωδικό.', 'Press «Continue» to set a new password.')}
            </p>
            <button className="email-link-button" disabled={busy} onClick={() => void proceed()}>
              {busy ? L('Μία στιγμή…', 'One moment…') : L('Συνέχεια', 'Continue')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
