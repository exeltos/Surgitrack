import type {ReactNode} from 'react';
import {ShieldAlert} from 'lucide-react';
import {Link} from 'react-router-dom';
import type {Permission} from '../../core/permissions';
import {roleHomePath} from '../../core/permissions';
import {useSurgi} from '../../store/SurgiStore';
import {useAppPreferences} from '../../core/AppPreferences';

export default function ProtectedRoute({permission, children}: {permission: Permission; children: ReactNode}) {
  const {can, role} = useSurgi();
  const {lang} = useAppPreferences();
  if (can(permission)) return <>{children}</>;
  return (
    <div className="empty access-denied">
      <ShieldAlert size={34} />
      <strong>
        {lang === 'el' ? 'Δεν υπάρχει πρόσβαση σε αυτή την ενότητα.' : 'You do not have access to this section.'}
      </strong>
      <span>
        {lang === 'el'
          ? 'Ο ενεργός ρόλος δεν διαθέτει το απαιτούμενο δικαίωμα. Η σελίδα δεν φορτώθηκε.'
          : 'The active role does not have the required permission. The page was not loaded.'}
      </span>
      <Link className="primary-link" to={roleHomePath(role)}>
        {lang === 'el' ? 'Επιστροφή στον χώρο εργασίας' : 'Back to workspace'}
      </Link>
    </div>
  );
}
