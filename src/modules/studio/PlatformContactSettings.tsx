import {useEffect, useState} from 'react';
import {
  loadPlatformContact,
  loadPublicContact,
  savePlatformContact,
  savePublicContact,
  type PublicContact,
} from '../../data/cloud/platformContact';

type Fields = PublicContact;

/** A contact saved as soon as a field is left, like every other setting: no separate button. */
function ContactSettings({
  L,
  title,
  hint,
  load,
  save,
  website,
}: {
  L: (el: string, en: string) => string;
  title: string;
  hint: string;
  load: () => Promise<Fields>;
  save: (contact: Fields) => Promise<void>;
  website?: boolean;
}) {
  const [contact, setContact] = useState<Fields>({});
  const [status, setStatus] = useState('');
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    void load().then(setContact);
  }, [load]);
  const set = (key: keyof Fields, value: string) => {
    setStatus('');
    setDirty(true);
    setContact(c => ({...c, [key]: value}));
  };
  const store = async () => {
    if (!dirty) return;
    setDirty(false);
    try {
      await save(contact);
      setStatus(L('Αποθηκεύτηκε', 'Saved'));
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
  };
  // Each field keeps its name above it, so an emptied field still says what goes in it.
  const field = (key: keyof Fields, label: string, type = 'text') => (
    <label className="platform-contact-field">
      <span>{label}</span>
      <input
        type={type}
        value={contact[key] || ''}
        onChange={e => set(key, e.target.value)}
        onBlur={() => void store()}
      />
    </label>
  );
  return (
    <div className="studio-setting-row platform-contact">
      <span>{title}</span>
      <small>
        {hint}
        {status && <b className="platform-contact-status"> {status}</b>}
      </small>
      <div className="platform-contact-fields">
        {field('name', L('Όνομα ή εταιρεία', 'Name or company'))}
        {field('email', 'Email', 'email')}
        {field('phone', L('Τηλέφωνο', 'Phone'), 'tel')}
        {website && field('website', L('Ιστοσελίδα', 'Website'), 'url')}
      </div>
    </div>
  );
}

/** Studio → Settings: the contact a trial hospital sees when its trial ends and it locks. */
export default function PlatformContactSettings({L}: {L: (el: string, en: string) => string}) {
  return (
    <ContactSettings
      L={L}
      title={L('Επικοινωνία δοκιμών', 'Trial contact')}
      hint={L(
        'Όταν λήξει η δοκιμαστική περίοδος ενός νοσοκομείου, οι χρήστες του βλέπουν αυτά τα στοιχεία για να επικοινωνήσουν μαζί σας.',
        'When a hospital’s trial ends, its users see these details to contact you.',
      )}
      load={loadPlatformContact}
      save={savePlatformContact}
    />
  );
}

/** Studio → Settings: the company on the public first page («Ας μιλήσουμε» and «Ζητήστε παρουσίαση»). */
export function PublicContactSettings({L}: {L: (el: string, en: string) => string}) {
  return (
    <ContactSettings
      L={L}
      title={L('Επικοινωνία στη σελίδα παρουσίασης', 'Contact on the public page')}
      hint={L(
        'Η πρώτη σελίδα του www.surgitrack.eu, πριν τη σύνδεση, δείχνει αυτά τα στοιχεία σε όποιον τη βλέπει.',
        'The first page of www.surgitrack.eu, before sign-in, shows these details to every visitor.',
      )}
      load={loadPublicContact}
      save={savePublicContact}
      website
    />
  );
}
