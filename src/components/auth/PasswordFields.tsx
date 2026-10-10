import {useState} from 'react';
import {Check, Circle, Eye, EyeOff, KeyRound} from 'lucide-react';
import {passwordRules} from '../../core/passwordRules';

type Props = {
  el: boolean;
  password: string;
  confirm: string;
  onPassword: (value: string) => void;
  onConfirm: (value: string) => void;
  label?: string;
};

/**
 * A new password and its repetition: one eye button shows or hides both, and the rules (with the
 * match) are ticked off as the person types.
 */
export function PasswordFields({el, password, confirm, onPassword, onConfirm, label}: Props) {
  const [show, setShow] = useState(false);
  const L = (g: string, e: string) => (el ? g : e);
  const type = show ? 'text' : 'password';
  const checks = [
    ...passwordRules(password).map(r => ({id: r.id, ok: r.ok, text: el ? r.el : r.en})),
    {id: 'match', ok: !!confirm && password === confirm, text: L('Οι δύο κωδικοί ταιριάζουν', 'Both passwords match')},
  ];
  return (
    <>
      <div className="auth-name-row">
        <label>
          {label || L('Κωδικός', 'Password')}
          <div className="auth-input">
            <KeyRound size={17} />
            <input
              type={type}
              value={password}
              onChange={e => onPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShow(v => !v)}
              aria-label={show ? L('Απόκρυψη κωδικού', 'Hide password') : L('Εμφάνιση κωδικού', 'Show password')}
              aria-pressed={show}
            >
              {show ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </label>
        <label>
          {L('Επανάληψη κωδικού', 'Repeat password')}
          <div className="auth-input">
            <KeyRound size={17} />
            <input
              type={type}
              value={confirm}
              onChange={e => onConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
        </label>
      </div>
      <ul className="auth-password-rules" aria-live="polite">
        {checks.map(c => (
          <li key={c.id} className={c.ok ? 'is-ok' : ''}>
            {c.ok ? <Check size={13} aria-hidden /> : <Circle size={11} aria-hidden />}
            <span>{c.text}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
