import {useState} from 'react';
import {X} from 'lucide-react';
import {type Organization} from '../../core/LibraryStore';
import AppButton from '../../components/ui/AppButton';
import {tr} from '../../i18n';
import {TRIAL_LENGTHS, trialEndAfter, trialEndDate, trialEndOn} from '../../core/trial';

export default function OrganizationEditor({
  organization,
  onClose,
  onSave,
}: {
  organization?: Organization;
  onClose: () => void;
  onSave: (data: Omit<Organization, 'id'>, hospitalAdmin?: {name: string; email: string}) => void;
}) {
  const [name, setName] = useState(organization?.name || '');
  const [code, setCode] = useState(organization?.code || '');
  // Active and Demo access are switched on the hospital's card; a new hospital starts active, without Demo.
  const active = organization?.active ?? true;
  const demoEnabled = organization?.demoEnabled ?? false;
  const [plan, setPlan] = useState<'STANDARD' | 'TRIAL'>(organization?.plan || 'STANDARD');
  const [endDate, setEndDate] = useState(trialEndDate(organization?.trialEndsAt) || trialEndDate(trialEndAfter(30)));
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const emailOk = !adminEmail.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail.trim());
  const adminOk = !!organization || (adminName.trim() && adminEmail.trim() && emailOk);
  const ready = name.trim() && (!organization || code.trim()) && adminOk && (plan === 'STANDARD' || endDate);
  return (
    <div className="studio-drawer-backdrop" onMouseDown={e => e.currentTarget === e.target && onClose()}>
      <aside className="studio-drawer">
        <header>
          <div>
            <span className="eyebrow">{tr('ΝΟΣΟΚΟΜΕΙΟ')}</span>
            <h2>{organization ? tr('Επεξεργασία νοσοκομείου') : tr('Νέο νοσοκομείο')}</h2>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </header>
        <div className="studio-drawer-form">
          <label>
            {tr('Ονομασία')}
            <input autoFocus value={name} onChange={e => setName(e.target.value)} />
          </label>
          {organization ? (
            <label>
              {tr('Κωδικός')}
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} />
            </label>
          ) : (
            <small className="studio-field-hint">{tr('Ο κωδικός του νοσοκομείου δημιουργείται αυτόματα.')}</small>
          )}
          <fieldset className="studio-plan">
            <legend>{tr('Χρήση')}</legend>
            <label className={plan === 'STANDARD' ? 'active' : ''}>
              <input type="radio" name="plan" checked={plan === 'STANDARD'} onChange={() => setPlan('STANDARD')} />
              <span>
                <b>{tr('Κανονική χρήση')}</b>
                <small>{tr('Χωρίς λήξη.')}</small>
              </span>
            </label>
            <label className={plan === 'TRIAL' ? 'active' : ''}>
              <input type="radio" name="plan" checked={plan === 'TRIAL'} onChange={() => setPlan('TRIAL')} />
              <span>
                <b>{tr('Δοκιμαστική περίοδος')}</b>
                <small>{tr('Μετά τη λήξη το νοσοκομείο κλειδώνει μέχρι να το ανανεώσετε.')}</small>
              </span>
            </label>
          </fieldset>
          {plan === 'TRIAL' && (
            <div className="studio-trial-length">
              <span>{tr('Διάρκεια')}</span>
              <div>
                {TRIAL_LENGTHS.map(days => (
                  <button
                    key={days}
                    type="button"
                    className={endDate === trialEndDate(trialEndAfter(days)) ? 'active' : ''}
                    onClick={() => setEndDate(trialEndDate(trialEndAfter(days)))}
                  >
                    {tr('{0} ημέρες', days)}
                  </button>
                ))}
              </div>
              <label>
                {tr('Λήγει στις')}
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </label>
            </div>
          )}
          {!organization && (
            <div className="studio-admin-invite">
              <b>{tr('Διαχειριστής νοσοκομείου')}</b>
              <small>
                {tr(
                  'Λαμβάνει email με το όνομα χρήστη του και κουμπί «Αποδοχή και ορισμός κωδικού», και στήνει το νοσοκομείο.',
                )}
              </small>
              <label>
                {tr('Ονοματεπώνυμο')}
                <input value={adminName} onChange={e => setAdminName(e.target.value)} />
              </label>
              <label>
                Email
                <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} />
                {!emailOk && <small className="studio-field-error">{tr('Μη έγκυρο email.')}</small>}
              </label>
            </div>
          )}
        </div>
        <footer>
          <AppButton onClick={onClose}>{tr('Ακύρωση')}</AppButton>
          <AppButton
            variant="primary"
            disabled={!ready}
            onClick={() =>
              onSave(
                {
                  name: name.trim(),
                  code: code.trim(),
                  active,
                  demoEnabled,
                  plan,
                  trialEndsAt: plan === 'TRIAL' ? trialEndOn(endDate) : undefined,
                },
                organization ? undefined : {name: adminName.trim(), email: adminEmail.trim().toLowerCase()},
              )
            }
          >
            {organization ? tr('Αποθήκευση') : tr('Δημιουργία και πρόσκληση')}
          </AppButton>
        </footer>
      </aside>
    </div>
  );
}
