import {useEffect, useRef, useState} from 'react';
import {KeyRound, PenLine} from 'lucide-react';
import {
  DEMO_HANDOVER_PEOPLE,
  DEMO_HANDOVER_STERILIZATION,
  isDemoHandover,
  passFromScan,
  verifyHandover,
  verifyHandoverPass,
  type HandoverSigner,
} from '../../data/cloud/handover';
import {tr, trData} from '../../i18n';

const REASON_TEXT = {
  invalid: 'Λάθος κωδικός χρήστη ή συνθηματικό.',
  locked: 'Πολλές αποτυχημένες προσπάθειες. Δοκιμάστε ξανά σε 15 λεπτά.',
  same_user: 'Υπογράφει το άλλο πρόσωπο της παράδοσης, όχι ο συνδεδεμένος χρήστης.',
  invalid_pass: 'Το QR έληξε ή χρησιμοποιήθηκε. Ζητήστε να ανανεωθεί και σκανάρετε ξανά.',
  unavailable: 'Η επιβεβαίωση δεν είναι διαθέσιμη. Ελέγξτε τη σύνδεση και δοκιμάστε ξανά.',
} as const;

/**
 * The other party of a handover signs with their own user code + password.
 * The signed-in Sterilization user is recorded automatically as the other side.
 * One signature covers the items on screen (`assetIds`) for this handover only: when they change after
 * signing, the signature is dropped and the other party signs again for what is now handed over.
 */
export default function HandoverSignature({
  label,
  department,
  signer,
  onSigned,
  disabled,
  autoFocus,
  assetIds = [],
}: {
  /** Shown above the fields; left out where the section's own title already says it. */
  label?: string;
  /** The Sets and instruments of this handover. */
  assetIds?: string[];
  /** The department the handover concerns, for the demo hint. */
  department?: string;
  signer: HandoverSigner | null;
  onSigned: (signer: HandoverSigner | null) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const demo = isDemoHandover();
  const demoPerson =
    demo && department
      ? [...DEMO_HANDOVER_PEOPLE, DEMO_HANDOVER_STERILIZATION].find(p => p.department === department)
      : undefined;
  const itemsKey = [...assetIds].sort().join('|');
  const signedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!signer) signedFor.current = null;
    else if (signedFor.current !== null && signedFor.current !== itemsKey) onSigned(null);
  }, [itemsKey, signer, onSigned]);

  // The other party's QR, read by a scanner into the code field (or by the phone's camera): a one-time pass.
  const signWithPass = async (pass: string) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setCode('');
    const result = await verifyHandoverPass(pass, assetIds);
    setBusy(false);
    if (result.ok) {
      signedFor.current = itemsKey;
      onSigned(result.signer);
    } else setError(tr(REASON_TEXT[result.reason]));
  };
  const sign = async (userCode = code, secret = password) => {
    if (busy || !userCode.trim() || !secret) return;
    setBusy(true);
    setError('');
    const result = await verifyHandover(userCode, secret, assetIds);
    setBusy(false);
    setPassword('');
    if (result.ok) {
      signedFor.current = itemsKey;
      onSigned(result.signer);
    } else setError(tr(REASON_TEXT[result.reason]));
  };

  if (signer)
    return (
      <div className="handover-signed">
        <PenLine size={15} />
        <span>
          {tr('Υπογραφή με κωδικό')} <b>{signer.code}</b>
        </span>
        <button
          type="button"
          onClick={() => {
            setCode('');
            onSigned(null);
          }}
        >
          {tr('Αλλαγή')}
        </button>
      </div>
    );

  return (
    <form
      className="handover-signature"
      onSubmit={e => {
        e.preventDefault();
        void sign();
      }}
    >
      {label && <span className="handover-signature-label">{label}</span>}
      <div className="handover-signature-row">
        <input
          autoFocus={autoFocus}
          disabled={disabled || busy}
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          onKeyDown={e => {
            // A scanner types the QR and then Enter: the pass signs on its own, no password asked.
            const pass = passFromScan(code);
            if (e.key === 'Enter' && pass) {
              e.preventDefault();
              void signWithPass(pass);
            }
          }}
          placeholder={tr('Κωδικός χρήστη')}
          aria-label={tr('Κωδικός χρήστη')}
          autoComplete="off"
          spellCheck={false}
        />
        <input
          type="password"
          disabled={disabled || busy}
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder={tr('Συνθηματικό')}
          aria-label={tr('Συνθηματικό')}
          autoComplete="off"
        />
        <button type="submit" className="primary" disabled={disabled || busy || !code.trim() || !password}>
          {busy ? <span className="app-spinner inline" aria-hidden="true" /> : <KeyRound size={15} />} {tr('Υπογραφή')}
        </button>
      </div>
      {demoPerson && (
        <small className="demo-code">
          Demo: {demoPerson.code} · {trData(demoPerson.department)} ·{' '}
          <button type="button" className="demo-fill-btn" onClick={() => void sign(demoPerson.code, 'demo')}>
            {tr('Υπογραφή demo')}
          </button>
        </small>
      )}
      {error && <div className="identity-error">{error}</div>}
    </form>
  );
}
