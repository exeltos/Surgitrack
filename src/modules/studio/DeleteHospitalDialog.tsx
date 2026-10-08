import {useState} from 'react';
import {Trash2, X} from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import {supabase} from '../../lib/supabase';
import type {Organization} from '../../core/libraryTypes';

type Member = {id: string; name: string; email?: string};

/**
 * Deletes an inactive hospital for good: first its users (their sign-in accounts too), then all its
 * data and the hospital itself. The owner types the hospital's code to confirm.
 */
export default function DeleteHospitalDialog({
  org,
  members,
  departments,
  L,
  onClose,
  onDeleted,
}: {
  org: Organization;
  members: Member[];
  departments: number;
  L: (el: string, en: string) => string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const confirmed = typed.trim().toUpperCase() === org.code.toUpperCase();

  const remove = async () => {
    setBusy(true);
    setError('');
    for (const [index, member] of members.entries()) {
      setProgress(
        L(`Διαγραφή χρηστών ${index + 1}/${members.length}…`, `Deleting users ${index + 1}/${members.length}…`),
      );
      const {data, error: fail} = await supabase.functions.invoke<{ok?: boolean; error?: string}>('delete-staff', {
        body: {user_id: member.id},
      });
      if (fail || !data?.ok) {
        setBusy(false);
        setProgress('');
        setError(
          L(`Δεν διαγράφηκε ο χρήστης ${member.name}: `, `Could not delete the user ${member.name}: `) +
            (data?.error || fail?.message || ''),
        );
        return;
      }
    }
    setProgress(L('Διαγραφή δεδομένων και νοσοκομείου…', 'Deleting the data and the hospital…'));
    const {error: rpcError} = await supabase.rpc('platform_delete_organization', {p_org: org.id});
    setBusy(false);
    setProgress('');
    if (rpcError) {
      const reason = rpcError.message.includes('hospital_active')
        ? L(
            'Το νοσοκομείο είναι ενεργό. Κάντε το πρώτα «Ανενεργό».',
            'The hospital is active. Make it «Inactive» first.',
          )
        : rpcError.message.includes('hospital_has_users')
          ? L('Το νοσοκομείο έχει ακόμα χρήστες.', 'The hospital still has users.')
          : rpcError.message;
      setError(reason);
      return;
    }
    onDeleted();
  };

  return (
    <div className="studio-drawer-backdrop" onMouseDown={e => !busy && e.currentTarget === e.target && onClose()}>
      <aside
        className="studio-drawer delete-hospital"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-hospital-title"
      >
        <header>
          <div>
            <span className="eyebrow">{L('ΝΟΣΟΚΟΜΕΙΟ', 'HOSPITAL')}</span>
            <h2 id="delete-hospital-title">{L('Διαγραφή νοσοκομείου', 'Delete hospital')}</h2>
          </div>
          <button onClick={onClose} disabled={busy} aria-label={L('Κλείσιμο', 'Close')}>
            <X />
          </button>
        </header>
        <div className="studio-drawer-form">
          <p className="delete-hospital-warning">
            {L(
              `Το «${org.name}» θα διαγραφεί οριστικά, μαζί με:`,
              `«${org.name}» will be deleted for good, together with:`,
            )}
          </p>
          <ul className="delete-hospital-list">
            <li>
              <b>{members.length}</b> {L('χρήστες και οι λογαριασμοί εισόδου τους', 'users and their sign-in accounts')}
            </li>
            <li>
              <b>{departments}</b> {L('τμήματα', 'departments')}
            </li>
            <li>
              {L(
                'όλα τα Σετ, τα εργαλεία, το ιστορικό, οι συσκευές και οι ρυθμίσεις του',
                'all its Sets, instruments, history, devices and settings',
              )}
            </li>
          </ul>
          <p>{L('Αυτό δεν αναιρείται.', 'This cannot be undone.')}</p>
          <label>
            {L(`Πληκτρολογήστε τον κωδικό ${org.code} για επιβεβαίωση`, `Type the code ${org.code} to confirm`)}
            <input
              autoFocus
              value={typed}
              disabled={busy}
              onChange={e => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          {progress && <small className="delete-hospital-progress">{progress}</small>}
          {error && (
            <small className="studio-field-error" role="alert">
              {error}
            </small>
          )}
        </div>
        <footer>
          <AppButton onClick={onClose} disabled={busy}>
            {L('Ακύρωση', 'Cancel')}
          </AppButton>
          <AppButton
            variant="danger"
            icon={<Trash2 size={15} />}
            disabled={!confirmed || busy}
            onClick={() => void remove()}
          >
            {L('Οριστική διαγραφή', 'Delete for good')}
          </AppButton>
        </footer>
      </aside>
    </div>
  );
}
