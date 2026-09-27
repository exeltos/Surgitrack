import {useEffect} from 'react';
import {Clock3, LogOut, MailWarning, XCircle} from 'lucide-react';
import {supabase} from '../../lib/supabase';
import {useAppPreferences} from '../../core/AppPreferences';
import type {AccessRequest} from '../../data/cloud/identity';

/**
 * What a self-signed-up user sees until the hospital admin decides: waiting for approval,
 * or the rejection with the admin's note.
 */
export default function PendingAccess({request, onSignOut}: {request: AccessRequest; onSignOut: () => void}) {
  const {lang} = useAppPreferences();
  const L = (el: string, en: string) => (lang === 'el' ? el : en);

  // After the email is confirmed the hospital admins get the email alert (once).
  useEffect(() => {
    if (request.status === 'PENDING' && !request.admin_notified)
      void supabase.functions.invoke('access-requests', {body: {action: 'notify-admins'}});
  }, [request.status, request.admin_notified]);

  const rejected = request.status === 'REJECTED';
  const unconfirmed = request.status === 'PENDING_EMAIL';
  return (
    <div className="auth-page">
      <main className="auth-main pending-access">
        <section className="auth-card-wrap">
          <div className="auth-card">
            <div className="auth-status-card">
              <div className={`auth-status-icon ${rejected ? 'danger' : ''}`}>
                {rejected ? <XCircle size={24} /> : unconfirmed ? <MailWarning size={24} /> : <Clock3 size={24} />}
              </div>
              <span className="auth-eyebrow">{request.organization_name}</span>
              <h2>
                {rejected
                  ? L('Το αίτημα δεν εγκρίθηκε', 'Request not approved')
                  : unconfirmed
                    ? L('Επιβεβαιώστε το email σας', 'Confirm your email')
                    : L('Αναμονή έγκρισης', 'Awaiting approval')}
              </h2>
              <p>
                {rejected
                  ? L(
                      'Ο διαχειριστής του νοσοκομείου απέρριψε το αίτημα πρόσβασης.',
                      'The hospital administrator declined the access request.',
                    )
                  : unconfirmed
                    ? L(
                        'Ανοίξτε τον σύνδεσμο επιβεβαίωσης που στάλθηκε στο email σας.',
                        'Open the confirmation link sent to your email.',
                      )
                    : L(
                        'Το αίτημά σας στάλθηκε στον διαχειριστή του νοσοκομείου. Θα λάβετε email με το όνομα χρήστη σας μόλις εγκριθεί.',
                        'Your request was sent to the hospital administrator. You will get an email with your username once approved.',
                      )}
              </p>
              <dl className="pending-access-details">
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
