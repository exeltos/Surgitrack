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
    <section
      className="platform-contact"
      title={L(
        'Όταν λήξει η δοκιμαστική περίοδος ενός νοσοκομείου, οι χρήστες του βλέπουν αυτά τα στοιχεία για να επικοινωνήσουν μαζί σας.',
        'When a hospital’s trial ends, its users see these details to contact you.',
      )}
    >
      <div className="platform-contact-line">
        <h3>
          <Phone size={18} />
          {L('Επικοινωνία δοκιμών', 'Trial contact')}
        </h3>
        <input
          aria-label={L('Όνομα ή εταιρεία', 'Name or company')}
          placeholder={L('Όνομα ή εταιρεία', 'Name or company')}
          value={contact.name || ''}
          onChange={e => set('name', e.target.value)}
        />
        <input
          className="wide"
          type="email"
          aria-label="Email"
          placeholder="Email"
          value={contact.email || ''}
          onChange={e => set('email', e.target.value)}
        />
        <input
          aria-label={L('Τηλέφωνο', 'Phone')}
          placeholder={L('Τηλέφωνο', 'Phone')}
          value={contact.phone || ''}
          onChange={e => set('phone', e.target.value)}
        />
        <AppButton variant="primary" icon={<Save size={15} />} onClick={() => void save()}>
          {L('Αποθήκευση', 'Save')}
        </AppButton>
      </div>
      {status && <small className="platform-contact-status">{status}</small>}
    </section>
  );
}
