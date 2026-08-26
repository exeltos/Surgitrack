import {AlertTriangle, X} from 'lucide-react';
import AppButton from './AppButton';
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Επιβεβαίωση',
  danger = false,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
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
          <button className="icon-button" onClick={onClose} aria-label="Κλείσιμο">
            <X size={18} />
          </button>
        </header>
        <footer>
          <AppButton onClick={onClose}>Ακύρωση</AppButton>
          <AppButton variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </AppButton>
        </footer>
      </div>
    </div>
  );
}
