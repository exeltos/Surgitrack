import {useEffect, useState} from 'react';
import {Megaphone, X} from 'lucide-react';
import {getRuntimeDataMode} from '../../config/dataMode';
import {loadActiveNotices, type PlatformNotice} from '../../data/cloud/platformNotices';
import {tr} from '../../i18n';

const DISMISSED = 'surgitrack-notices-dismissed';
const REFRESH_MS = 5 * 60_000;

const readDismissed = (): string[] => {
  try {
    return JSON.parse(sessionStorage.getItem(DISMISSED) || '[]') as string[];
  } catch {
    return [];
  }
};

/** The platform owner's notices to every user (Studio → Ειδοποιήσεις), while they run; each user can hide one. */
export default function MaintenanceStrip() {
  const [notices, setNotices] = useState<PlatformNotice[]>([]);
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);
  useEffect(() => {
    if (getRuntimeDataMode() !== 'PRODUCTION') return;
    let live = true;
    const load = () => void loadActiveNotices().then(list => live && setNotices(list));
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, []);
  const shown = notices.filter(notice => !dismissed.includes(notice.id));
  if (!shown.length) return null;
  const hide = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      sessionStorage.setItem(DISMISSED, JSON.stringify(next));
    } catch {
      // Private mode: hidden until the page reloads.
    }
  };
  return (
    <>
      {shown.map(notice => (
        <div key={notice.id} className="trial-strip maintenance-strip" role="status">
          <Megaphone size={16} aria-hidden="true" />
          <span>{notice.message}</span>
          <button
            type="button"
            className="icon-button"
            onClick={() => hide(notice.id)}
            aria-label={tr('Απόκρυψη ειδοποίησης')}
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </>
  );
}
