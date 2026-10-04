import {useEffect, useState} from 'react';
import {Phone, Save} from 'lucide-react';
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
  return (
    <section className="platform-contact">
      <header>
        <Phone />
        <div>
          <h3>{L('Επικοινωνία για δοκιμαστικά νοσοκομεία', 'Contact for trial hospitals')}</h3>
          <p>
            {L(
              'Όταν λήξει η δοκιμαστική περίοδος ενός νοσοκομείου, οι χρήστες του βλέπουν αυτά τα στοιχεία για να επικοινωνήσουν μαζί σας.',
              'When a hospital’s trial ends, its users see these details to contact you.',
            )}
          </p>
        </div>
      </header>
      <div className="platform-contact-fields">
        <label>
          {L('Όνομα ή εταιρεία', 'Name or company')}
          <input value={contact.name || ''} onChange={e => set('name', e.target.value)} />
        </label>
        <label>
          Email
          <input type="email" value={contact.email || ''} onChange={e => set('email', e.target.value)} />
        </label>
        <label>
          {L('Τηλέφωνο', 'Phone')}
          <input value={contact.phone || ''} onChange={e => set('phone', e.target.value)} />
        </label>
        <AppButton variant="primary" icon={<Save size={15} />} onClick={() => void save()}>
          {L('Αποθήκευση', 'Save')}
        </AppButton>
      </div>
      {status && <small className="platform-contact-status">{status}</small>}
    </section>
  );
}
