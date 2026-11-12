import {useEffect, useState} from 'react';
import {loadPlatformContact, savePlatformContact, type PlatformContact} from '../../data/cloud/platformContact';

/** Studio → Settings: the contact a trial hospital sees when its trial ends and it locks. */
export default function PlatformContactSettings({L}: {L: (el: string, en: string) => string}) {
  const [contact, setContact] = useState<PlatformContact>({});
  const [status, setStatus] = useState('');
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    void loadPlatformContact().then(setContact);
  }, []);
  const set = (key: keyof PlatformContact, value: string) => {
    setStatus('');
    setDirty(true);
    setContact(c => ({...c, [key]: value}));
  };
  // Saved as soon as a field is left, like every other setting: no separate button.
  const save = async () => {
    if (!dirty) return;
    setDirty(false);
    try {
      await savePlatformContact(contact);
      setStatus(L('Αποθηκεύτηκε', 'Saved'));
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
  };
  const field = (key: keyof PlatformContact, label: string, type = 'text') => (
    <input
      type={type}
      aria-label={label}
      placeholder={label}
      value={contact[key] || ''}
      onChange={e => set(key, e.target.value)}
      onBlur={() => void save()}
    />
  );
  return (
    <div className="studio-setting-row platform-contact">
      <span>{L('Επικοινωνία δοκιμών', 'Trial contact')}</span>
      <small>
        {L(
          'Όταν λήξει η δοκιμαστική περίοδος ενός νοσοκομείου, οι χρήστες του βλέπουν αυτά τα στοιχεία για να επικοινωνήσουν μαζί σας.',
          'When a hospital’s trial ends, its users see these details to contact you.',
        )}
        {status && <b className="platform-contact-status"> {status}</b>}
      </small>
      <div className="platform-contact-fields">
        {field('name', L('Όνομα ή εταιρεία', 'Name or company'))}
        {field('email', 'Email', 'email')}
        {field('phone', L('Τηλέφωνο', 'Phone'), 'tel')}
      </div>
    </div>
  );
}
