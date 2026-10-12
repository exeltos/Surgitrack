import {useEffect, useState} from 'react';
import {X} from 'lucide-react';
import {useGuardedNavigate} from '../../app/UnsavedChanges';
import {loadDemoEvents, type DemoEvent} from '../../data/cloud/demoEvents';
import {getRealIdentity} from '../../data/cloud/identity';
import {tr} from '../../i18n';

const seenKey = (userId: string) => `surgitrack-owner-demo-seen:${userId}`;
const readSeen = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeSeen = (key: string, at: string) => {
  try {
    localStorage.setItem(key, at);
  } catch {
    // Private mode: the next visit just starts from then.
  }
};

/**
 * The platform owner hears, in a pop-up that stays until closed, when a prospect finishes signing up in an
 * evaluation Demo or sends its final evaluation. Checked every minute while the owner is signed in; the
 * first visit on a device starts from then, so nothing old pops up.
 */
export default function OwnerDemoAlerts() {
  const navigate = useGuardedNavigate();
  const [events, setEvents] = useState<DemoEvent[]>([]);
  const userId = getRealIdentity()?.id;
  useEffect(() => {
    if (!userId) return;
    const key = seenKey(userId);
    let stopped = false;
    const check = async () => {
      const since = readSeen(key);
      if (!since) {
        writeSeen(key, new Date().toISOString());
        return;
      }
      try {
        const found = await loadDemoEvents(since);
        if (stopped || !found.length) return;
        writeSeen(key, found[found.length - 1].at);
        setEvents(current => [...current, ...found.filter(e => !current.some(c => c.id === e.id))]);
      } catch {
        // Offline or a failed read: tried again on the next check.
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), 60_000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [userId]);
  if (!events.length) return null;
  const shown = events.slice(-4);
  return (
    <div className="toast owner-demo-toast" role="status">
      <strong>{tr('Demo αξιολόγησης')}</strong>
      <ul>
        {shown.map(e => (
          <li key={e.id}>
            {e.kind === 'SIGNED_UP'
              ? tr('{0} ολοκλήρωσε την εγγραφή στο «{1}».', e.name, e.hospitalName)
              : tr('{0} ολοκλήρωσε την αξιολόγηση στο «{1}».', e.name, e.hospitalName)}
            {e.kind === 'EVALUATED' && e.nps !== null && e.nps !== undefined && (
              <small>{tr('Σύσταση {0}/10', e.nps)}</small>
            )}
          </li>
        ))}
      </ul>
      {events.length > shown.length && <small>{tr('+{0} ακόμη', events.length - shown.length)}</small>}
      <button
        type="button"
        className="toast-undo"
        onClick={() => {
          setEvents([]);
          navigate('/studio?tab=demos');
        }}
      >
        {tr('Άνοιγμα Demo')}
      </button>
      <button onClick={() => setEvents([])} aria-label={tr('Κλείσιμο')}>
        <X size={16} />
      </button>
    </div>
  );
}
