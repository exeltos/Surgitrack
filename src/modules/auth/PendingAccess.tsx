import {Clock3, LogOut, XCircle} from 'lucide-react';
import {useAppPreferences} from '../../core/AppPreferences';
import type {AccessRequest} from '../../data/cloud/identity';

/**
 * What a self-signed-up user sees until the hospital admin decides: waiting for approval,
 * or the rejection with the admin's note.
 */
export default function PendingAccess({request, onSignOut}: {request: AccessRequest; onSignOut: () => void}) {
  const {lang} = useAppPreferences();
  const L = (el: string, en: string) => (lang === 'el' ? el : en);

  const rejected = request.status === 'REJECTED';
  return (
    <div className="auth-page">
      <main className="auth-main pending-access">
        <section className="auth-card-wrap">
          <div className="auth-card">
            <div className="auth-status-card">
              <div className={`auth-status-icon ${rejected ? 'danger' : ''}`}>
                {rejected ? <XCircle size={24} /> : <Clock3 size={24} />}
              </div>
              <span className="auth-eyebrow">{request.organization_name}</span>
              <h2>
                {rejected
                  ? L('Το αίτημα δεν εγκρίθηκε', 'Request not approved')
                  : L('Αναμονή έγκρισης', 'Awaiting approval')}
              </h2>
              <p>
                {rejected
                  ? L(
                      'Ο διαχειριστής του νοσοκομείου απέρριψε το αίτημα πρόσβασης.',
                      'The hospital administrator declined the access request.',
                    )
                  : L(
                      'Ο λογαριασμός σας περιμένει την έγκριση του διαχειριστή του νοσοκομείου. Θα λάβετε email μόλις εγκριθεί· μετά συνδέεστε με το όνομα χρήστη και τον κωδικό σας.',
                      'Your account is waiting for the hospital administrator’s approval. You will get an email once approved; then sign in with your username and password.',
                    )}
              </p>
              <dl className="pending-access-details">
                {request.user_code && (
                  <>
                    <dt>{L('Όνομα χρήστη', 'Username')}</dt>
                    <dd>
                      <b>{request.user_code}</b>
                    </dd>
                  </>
                )}
                <dt>{L('Ονοματεπώνυμο', 'Name')}</dt>
                <dd>{request.full_name}</dd>
                <dt>Email</dt>
                <dd>{request.email}</dd>
                <dt>{L('Τμήμα', 'Department')}</dt>
                <dd>{request.department_name || '—'}</dd>
                {rejected && request.decision_note && (
                  <>
                    <dt>{L('Σχόλιο', 'Note')}</dt>
                    <dd>{request.decision_note}</dd>
                  </>
                )}
              </dl>
              <button className="auth-primary" type="button" onClick={onSignOut}>
                <LogOut size={16} />
                {L('Αποσύνδεση', 'Sign out')}
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
