import {useState} from 'react';
import {Wrench, X} from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import type {OutOfService} from '../../core/libraries';
import type {Lang} from './deviceUi';

/** Takes a sterilizer or washer out of use: a breakdown or maintenance, with a note for whoever comes next. */
export default function OutOfServiceDialog({
  L,
  name,
  onSave,
  onClose,
}: {
  L: Lang;
  name: string;
  onSave: (value: {reason: OutOfService['reason']; note?: string}) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<OutOfService['reason']>('BREAKDOWN');
  const [note, setNote] = useState('');
  return (
    <div className="modal-backdrop" onMouseDown={e => e.currentTarget === e.target && onClose()}>
      <form
        className="confirm-dialog out-of-service-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={L('Εκτός λειτουργίας', 'Out of service')}
        onSubmit={e => {
          e.preventDefault();
          onSave({reason, note: note.trim() || undefined});
        }}
      >
        <header>
          <div className="confirm-icon">
            <Wrench size={20} />
          </div>
          <div>
            <h3>{L('Εκτός λειτουργίας', 'Out of service')}</h3>
            <p>
              {L(
                `Ο «${name}» δεν θα επιλέγεται για νέα φορτία μέχρι να τον επαναφέρετε. Ό,τι τρέχει ήδη δεν διακόπτεται.`,
                `“${name}” cannot be chosen for new loads until you put it back. A load already running is not stopped.`,
              )}
            </p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label={L('Κλείσιμο', 'Close')}>
            <X size={18} />
          </button>
        </header>
        <div className="notice-choice" role="radiogroup" aria-label={L('Αιτία', 'Reason')}>
          {(
            [
              ['BREAKDOWN', L('Βλάβη', 'Breakdown')],
              ['MAINTENANCE', L('Συντήρηση', 'Maintenance')],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={reason === id}
              className={reason === id ? 'on' : ''}
              onClick={() => setReason(id)}
            >
              <i className="notice-dot" aria-hidden="true" />
              <b>{label}</b>
            </button>
          ))}
        </div>
        <label className="confirm-dialog-type">
          {L('Σημείωση (προαιρετική)', 'Note (optional)')}
          <input
            value={note}
            maxLength={200}
            onChange={e => setNote(e.target.value)}
            placeholder={L('Π.χ. καλέστηκε ο τεχνικός', 'E.g. the technician was called')}
          />
        </label>
        <footer>
          <AppButton type="button" onClick={onClose}>
            {L('Ακύρωση', 'Cancel')}
          </AppButton>
          <AppButton type="submit" variant="primary">
            {L('Εκτός λειτουργίας', 'Out of service')}
          </AppButton>
        </footer>
      </form>
    </div>
  );
}
