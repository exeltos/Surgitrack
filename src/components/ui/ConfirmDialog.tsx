import {useState} from 'react';
import {AlertTriangle, X} from 'lucide-react';
import AppButton from './AppButton';
import {tr} from '../../i18n';
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = tr('Επιβεβαίωση'),
  danger = false,
  confirmText,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  /** For what cannot be undone: the confirm button waits until this exact text is typed. */
  confirmText?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState('');
  const ready = !confirmText || typed.trim() === confirmText.trim();
  return (
    <div
      className="modal-backdrop confirm-dialog-backdrop"
      onMouseDown={e => e.currentTarget === e.target && onClose()}
    >
      <div className="confirm-dialog" role="dialog" aria-modal="true">
        <header>
          <div className="confirm-icon">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h3>{title}</h3>
            <p>{message}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label={tr('Κλείσιμο')}>
            <X size={18} />
          </button>
        </header>
        {confirmText && (
          <label className="confirm-dialog-type">
            {tr('Για επιβεβαίωση, πληκτρολογήστε «{0}»', confirmText)}
            <input autoFocus value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" />
          </label>
        )}
        <footer>
          <AppButton onClick={onClose}>{tr('Ακύρωση')}</AppButton>
          <AppButton variant={danger ? 'danger' : 'primary'} disabled={!ready} onClick={onConfirm}>
            {confirmLabel}
          </AppButton>
        </footer>
      </div>
    </div>
  );
}
