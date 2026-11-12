import {useState} from 'react';
import {FlaskConical} from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import type {EquipmentTest} from '../../core/libraries';
import type {Lang} from './deviceUi';

/** Records one test of a sterilizer: passed or failed, with a note. A failed one stops the sterilizer being loaded. */
export default function TestDialog({
  L,
  sterilizer,
  test,
  onSave,
  onClose,
}: {
  L: Lang;
  sterilizer: string;
  test: string;
  onSave: (value: {result: EquipmentTest['result']; note?: string}) => void;
  onClose: () => void;
}) {
  const [result, setResult] = useState<EquipmentTest['result']>('PASS');
  const [note, setNote] = useState('');
  return (
    <div className="modal-backdrop" onMouseDown={e => e.currentTarget === e.target && onClose()}>
      <form
        className="confirm-dialog out-of-service-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={L('Καταγραφή δοκιμής', 'Record a test')}
        onSubmit={e => {
          e.preventDefault();
          onSave({result, note: note.trim() || undefined});
        }}
      >
        <header>
          <div className="confirm-icon">
            <FlaskConical size={20} />
          </div>
          <div>
            <h3>{L('Καταγραφή δοκιμής', 'Record a test')}</h3>
            <p>
              {test} · {sterilizer}
              {result === 'FAIL'
                ? ` — ${L(
                    'ο κλίβανος δεν θα φορτώνεται μέχρι να καταγραφεί επιτυχής δοκιμή.',
                    'the sterilizer is not loaded until a passing test is recorded.',
                  )}`
                : ''}
            </p>
          </div>
        </header>
        <div className="notice-choice" role="radiogroup" aria-label={L('Αποτέλεσμα', 'Result')}>
          {(
            [
              ['PASS', L('Επιτυχία', 'Pass')],
              ['FAIL', L('Αποτυχία', 'Fail')],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={result === id}
              className={result === id ? 'on' : ''}
              onClick={() => setResult(id)}
            >
              <i className="notice-dot" aria-hidden="true" />
              <b>{label}</b>
            </button>
          ))}
        </div>
        <label className="confirm-dialog-type">
          {L('Σημείωση (προαιρετική)', 'Note (optional)')}
          <input value={note} maxLength={200} onChange={e => setNote(e.target.value)} />
        </label>
        <footer>
          <AppButton type="button" onClick={onClose}>
            {L('Ακύρωση', 'Cancel')}
          </AppButton>
          <AppButton type="submit" variant="primary">
            {L('Καταγραφή', 'Record')}
          </AppButton>
        </footer>
      </form>
    </div>
  );
}
