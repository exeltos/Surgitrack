import {useEffect, useState} from 'react';
import {Megaphone, Save, X} from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import {loadMaintenanceNotice, saveMaintenanceNotice} from '../../data/cloud/platformContact';

/** A datetime-local value for a moment, in the browser's time zone. */
const localInput = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Studio → Settings: a notice every user sees at the top of the app until the time given. */
export default function MaintenanceNoticeSettings({L}: {L: (el: string, en: string) => string}) {
  const [message, setMessage] = useState('');
  const [until, setUntil] = useState('');
  const [status, setStatus] = useState('');
  useEffect(() => {
    void loadMaintenanceNotice().then(n => {
      setMessage(n?.message || '');
      setUntil(localInput(n?.until));
    });
  }, []);
  const save = async (clear = false) => {
    try {
      await saveMaintenanceNotice(clear ? null : {message, until: until ? new Date(until).toISOString() : undefined});
      if (clear) {
        setMessage('');
        setUntil('');
      }
      setStatus(clear ? L('Η ειδοποίηση αφαιρέθηκε.', 'The notice was removed.') : L('Αποθηκεύτηκε.', 'Saved.'));
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <section className="platform-contact maintenance-notice-settings">
      <header>
        <Megaphone />
        <div>
          <h3>{L('Ειδοποίηση προς όλους τους χρήστες', 'Notice to every user')}</h3>
          <p>
            {L(
              'Π.χ. «Συντήρηση την Κυριακή 22:00–23:00». Εμφανίζεται πάνω στην εφαρμογή σε όλα τα νοσοκομεία μέχρι την ώρα που ορίζετε.',
              'E.g. "Maintenance on Sunday 22:00–23:00". Shown at the top of the app in every hospital until the time you set.',
            )}
          </p>
        </div>
      </header>
      <div className="platform-contact-fields">
        <label className="maintenance-message">
          {L('Μήνυμα', 'Message')}
          <input
            value={message}
            maxLength={300}
            onChange={e => (setStatus(''), setMessage(e.target.value))}
            placeholder={L('Συντήρηση την Κυριακή 22:00–23:00', 'Maintenance on Sunday 22:00–23:00')}
          />
        </label>
        <label>
          {L('Εμφάνιση μέχρι', 'Show until')}
          <input type="datetime-local" value={until} onChange={e => (setStatus(''), setUntil(e.target.value))} />
        </label>
        <AppButton variant="primary" icon={<Save size={15} />} disabled={!message.trim()} onClick={() => void save()}>
          {L('Αποθήκευση', 'Save')}
        </AppButton>
        <AppButton icon={<X size={15} />} onClick={() => void save(true)}>
          {L('Αφαίρεση', 'Remove')}
        </AppButton>
      </div>
      {status && <small className="platform-contact-status">{status}</small>}
    </section>
  );
}
