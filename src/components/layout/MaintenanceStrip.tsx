import {useEffect, useState} from 'react';
import {Megaphone, X} from 'lucide-react';
import {getRuntimeDataMode} from '../../config/dataMode';
import {loadMaintenanceNotice, maintenanceActive, type MaintenanceNotice} from '../../data/cloud/platformContact';
import {tr} from '../../i18n';

const DISMISSED = 'surgitrack-notice-dismissed';
const REFRESH_MS = 5 * 60_000;

/** The platform owner's notice to every user (Studio → Settings), until its time; each user can hide it. */
export default function MaintenanceStrip() {
  const [notice, setNotice] = useState<MaintenanceNotice | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISSED) || '';
    } catch {
      return '';
    }
  });
  useEffect(() => {
    if (getRuntimeDataMode() !== 'PRODUCTION') return;
    let live = true;
    const load = () => void loadMaintenanceNotice().then(n => live && setNotice(n));
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, []);
  if (!notice || !maintenanceActive(notice) || dismissed === notice.message) return null;
  const hide = () => {
    setDismissed(notice.message);
    try {
      sessionStorage.setItem(DISMISSED, notice.message);
    } catch {
      // Private mode: hidden until the page reloads.
    }
  };
  return (
    <div className="trial-strip maintenance-strip" role="status">
      <Megaphone size={16} aria-hidden="true" />
      <span>{notice.message}</span>
      <button type="button" className="icon-button" onClick={hide} aria-label={tr('Απόκρυψη ειδοποίησης')}>
        <X size={15} />
      </button>
    </div>
  );
}
