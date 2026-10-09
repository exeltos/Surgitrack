import {useState} from 'react';
import {AlertTriangle, X} from 'lucide-react';
import AppButton from './AppButton';
import {tr} from '../../i18n';
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = tr('Επιβεβαίωση'),
  cancelLabel = tr('Ακύρωση'),
  danger = false,
  confirmText,
  note,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** For what cannot be undone: the confirm button waits until this exact text is typed. */
  confirmText?: string;
  /** An optional free-text field (e.g. how an issue was resolved), handed to onConfirm. */
  note?: {label: string; placeholder?: string};
  onConfirm: (note: string) => void;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState('');
  const [noteText, setNoteText] = useState('');
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
        {note && (
          <label className="confirm-dialog-type">
            {note.label}
            <textarea
              autoFocus
              rows={2}
              value={noteText}
              placeholder={note.placeholder}
              onChange={e => setNoteText(e.target.value)}
            />
          </label>
        )}
        <footer>
          {/* Before something dangerous, the safe choice is the one already selected. */}
          <AppButton onClick={onClose} autoFocus={danger && !confirmText}>
            {cancelLabel}
          </AppButton>
          <AppButton
            variant={danger ? 'danger' : 'primary'}
            disabled={!ready}
            onClick={() => onConfirm(noteText.trim())}
          >
            {confirmLabel}
          </AppButton>
        </footer>
      </div>
    </div>
  );
}
