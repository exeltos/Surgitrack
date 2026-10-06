import {Compass} from 'lucide-react';
import {Link} from 'react-router-dom';
import EmptyState from '../components/ui/EmptyState';
import {tr} from '../i18n';

/** An address that leads nowhere: say so, and offer the way back. */
export default function NotFoundPage() {
  return (
    <EmptyState
      icon={<Compass size={22} />}
      title={tr('Η σελίδα δεν βρέθηκε')}
      description={tr('Ο σύνδεσμος δεν υπάρχει ή δεν έχεις πρόσβαση σε αυτή τη σελίδα.')}
      actions={
        <Link className="app-button app-button-primary app-button-md" to="/">
          {tr('Αρχική σελίδα')}
        </Link>
      }
    />
  );
}
