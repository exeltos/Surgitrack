import {UserCheck, X} from 'lucide-react';
import AppButton from '../../../components/ui/AppButton';
import SignupLinkCard from '../SignupLinkCard';
import type {PeopleState} from './usePeople';

export default function SignupLinkDrawer({s}: {s: PeopleState}) {
  const {L, linkOpen, organizationId, refreshKey, setLinkOpen, showError} = s;
  return (
    <>
      {linkOpen && organizationId && (
        <div className="studio-drawer-backdrop" onMouseDown={e => e.currentTarget === e.target && setLinkOpen(false)}>
          <aside className="studio-drawer">
            <header>
              <div>
                <span className="eyebrow">{L('ΠΡΟΣΚΛΗΣΗ', 'INVITATION')}</span>
                <h2>{L('Σύνδεσμος εγγραφής', 'Signup link')}</h2>
              </div>
              <button onClick={() => setLinkOpen(false)} aria-label={L('Κλείσιμο', 'Close')}>
                <X />
              </button>
            </header>
            <div className="studio-drawer-form">
              <SignupLinkCard organizationId={organizationId} onError={showError} refreshKey={refreshKey} />
              <div className="studio-form-note">
                <UserCheck size={16} />
                <span>
                  {L(
                    'Όποιος εγγραφεί με τον σύνδεσμο εμφανίζεται στους Χρήστες ως αίτημα. Τον εγκρίνετε επιλέγοντας ρόλο και τμήμα.',
                    'Whoever signs up with the link shows under Users as a request. You approve them by picking a role and department.',
                  )}
                </span>
              </div>
            </div>
            <footer>
              <AppButton onClick={() => setLinkOpen(false)}>{L('Κλείσιμο', 'Close')}</AppButton>
            </footer>
          </aside>
        </div>
      )}
    </>
  );
}
