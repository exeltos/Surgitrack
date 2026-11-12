import {useEffect, useState} from 'react';
import {Save} from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import {loadPlatformContact, savePlatformContact, type PlatformContact} from '../../data/cloud/platformContact';

/** Studio → Settings: the contact a trial hospital sees when its trial ends and it locks. */
export default function PlatformContactSettings({L}: {L: (el: string, en: string) => string}) {
  const [contact, setContact] = useState<PlatformContact>({});
  const [status, setStatus] = useState('');
  useEffect(() => {
    void loadPlatformContact().then(setContact);
  }, []);
  const set = (key: keyof PlatformContact, value: string) => {
    setStatus('');
    setContact(c => ({...c, [key]: value}));
  };
  const save = async () => {
    try {
      await savePlatformContact(contact);
      setStatus(L('Αποθηκεύτηκε.', 'Saved.'));
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
  };
  const field = (key: keyof PlatformContact, label: string, hint?: string, type = 'text') => (
    <label>
      {label}
      <div className="studio-setting-input">
        <input type={type} value={contact[key] || ''} onChange={e => set(key, e.target.value)} />
      </div>
      {hint && <small>{hint}</small>}
    </label>
  );
  return (
    <section className="platform-contact">
      {field(
        'name',
        L('Επικοινωνία δοκιμών: όνομα ή εταιρεία', 'Trial contact: name or company'),
        L(
          'Όταν λήξει η δοκιμαστική περίοδος ενός νοσοκομείου, οι χρήστες του βλέπουν αυτά τα στοιχεία για να επικοινωνήσουν μαζί σας.',
          'When a hospital’s trial ends, its users see these details to contact you.',
        ),
      )}
      {field('email', L('Επικοινωνία δοκιμών: email', 'Trial contact: email'), undefined, 'email')}
      {field('phone', L('Επικοινωνία δοκιμών: τηλέφωνο', 'Trial contact: phone'))}
      <footer className="platform-contact-save">
        {status && <small className="platform-contact-status">{status}</small>}
        <AppButton variant="primary" icon={<Save size={15} />} onClick={() => void save()}>
          {L('Αποθήκευση', 'Save')}
        </AppButton>
      </footer>
    </section>
  );
}
