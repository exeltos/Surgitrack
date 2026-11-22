import {ArrowLeft} from 'lucide-react';
import {Link, useNavigate} from 'react-router-dom';
import {backLabelFor, previousPath} from '../../core/backTarget';
import {tr} from '../../i18n';

/**
 * «Πίσω»: returns to wherever the user came from inside the app (a list, a Set, Traceability, the overview), so it
 * opens as it was left, and says which («Πίσω στην Ιχνηλάτηση»); a record opened directly falls back to its own list.
 */
export default function BackLink({fallback, className}: {fallback: string; className?: string}) {
  const navigate = useNavigate();
  const index = (window.history.state as {idx?: number} | null)?.idx ?? 0;
  const before = index > 0 ? previousPath() : undefined;
  return (
    <Link
      to={fallback}
      className={className}
      onClick={e => {
        if (index > 0) {
          e.preventDefault();
          navigate(-1);
        }
      }}
    >
      <ArrowLeft size={18} /> {tr(backLabelFor(index > 0 ? before : fallback))}
    </Link>
  );
}
