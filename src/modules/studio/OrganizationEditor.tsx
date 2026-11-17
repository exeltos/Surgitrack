import {useState} from 'react';
import {type Organization} from '../../core/LibraryStore';
import AppButton from '../../components/ui/AppButton';
import {tr} from '../../i18n';
import {trialEndOn} from '../../core/trial';
import OrganizationFields from './OrganizationFields';
import {organizationForm, type OrganizationForm} from './organizationForm';

export default function OrganizationEditor({
  organization,
  onClose,
  onSave,
}: {
  organization?: Organization;
  onClose: () => void;
  onSave: (data: Omit<Organization, 'id'>, hospitalAdmin?: {name: string; email: string}) => void;
}) {
  const [form, setForm] = useState<OrganizationForm>(() => organizationForm(organization));
  const {name, code, plan, endDate, modules} = form;
  // Active and Demo access are switched on the hospital's card; a new hospital starts active, without Demo.
  const active = organization?.active ?? true;
  const demoEnabled = organization?.demoEnabled ?? false;
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
            <span className="eyebrow">{tr('Νοσοκομείο')}</span>
            <h2>{organization ? tr('Επεξεργασία νοσοκομείου') : tr('Νέο νοσοκομείο')}</h2>
          </div>
        </header>
        <div className="studio-drawer-form">
          <OrganizationFields
            autoFocus
            isNew={!organization}
            value={form}
            onChange={patch => setForm(f => ({...f, ...patch}))}
          />
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
                  modules,
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
