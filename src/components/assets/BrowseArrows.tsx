import {useEffect} from 'react';
import {ChevronLeft, ChevronRight} from 'lucide-react';
import {useGuardedNavigate} from '../../app/UnsavedChanges';
import {browsePosition} from '../../core/browseList';
import {tr} from '../../i18n';

/**
 * Previous / next record of the list the card was opened from, also with Alt+← / Alt+→.
 * Browsing replaces the history entry, so «Πίσω στη λίστα» still returns to the list.
 */
export default function BrowseArrows({base, id}: {base: '/sets' | '/tools'; id: string}) {
  const navigate = useGuardedNavigate();
  const place = browsePosition(base, id);
  const previous = place?.previous;
  const next = place?.next;

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      const to = event.key === 'ArrowLeft' ? previous : event.key === 'ArrowRight' ? next : undefined;
      if (!to) return;
      event.preventDefault();
      navigate(to, {replace: true});
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [navigate, previous, next]);

  if (!place) return null;
  return (
    <div className="browse-arrows" role="group" aria-label={tr('Περιήγηση στη λίστα')}>
      <button
        type="button"
        className="icon-btn"
        disabled={!previous}
        title={tr('Προηγούμενο (Alt+←)')}
        aria-label={tr('Προηγούμενο')}
        onClick={() => previous && navigate(previous, {replace: true})}
      >
        <ChevronLeft size={18} />
      </button>
      <span>{tr('{0} από {1}', place.position, place.total)}</span>
      <button
        type="button"
        className="icon-btn"
        disabled={!next}
        title={tr('Επόμενο (Alt+→)')}
        aria-label={tr('Επόμενο')}
        onClick={() => next && navigate(next, {replace: true})}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
