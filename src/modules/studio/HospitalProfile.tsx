import {useEffect, useState} from 'react';
import AppButton from '../../components/ui/AppButton';
import {tr} from '../../i18n';
import {useLibraries, type Organization} from '../../core/LibraryStore';
import type {HospitalDetails} from '../../core/libraryTypes';
import {trialEndOn} from '../../core/trial';
import {getRealIdentity, productionOrganizationFor} from '../../data/cloud/identity';
import {getCloudOrganizationId} from '../../data/cloud/appRecords';
import {loadHospital, saveHospital} from '../../data/cloud/hospitalProfile';
import {announceHospitalChange} from '../../data/cloud/modulesContext';
import {tellUser} from '../../components/ui/confirmService';
import OrganizationFields from './OrganizationFields';
import {organizationForm, type OrganizationForm} from './organizationForm';

/**
 * Settings → Hospital: everything about the open hospital in one place, in the same form as Studio → Hospitals.
 * The platform owner changes its name, code, use and modules here without leaving it; its admin sees them and keeps
 * the hospital's own details (address, phone, email, contact person).
 */
export default function HospitalProfile({actor}: {actor: string}) {
  const libs = useLibraries();
  const demo = libs.dataMode === 'DEMO';
  const real = getRealIdentity();
  // The owner (or local development, signed in as no one); a hospital's admin sees the owner's part read-only.
  const owner = !real || !!real.platform;
  const [org, setOrg] = useState<Organization>();
  const [form, setForm] = useState<OrganizationForm>(() => organizationForm());
  const [details, setDetails] = useState<HospitalDetails>(libs.systemSettings.hospitalDetails || {});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    const pick = async () => {
      if (demo) {
        const id = getCloudOrganizationId();
        return libs.organizations.find(o => o.id === id) || libs.organizations[0];
      }
      const id = real ? productionOrganizationFor(real) : undefined;
      return id ? await loadHospital(id) : libs.organizations[0];
    };
    void pick().then(found => {
      if (!alive || !found) return;
      setOrg(found);
      setForm(organizationForm(found));
    });
    return () => {
      alive = false;
    };
    // Once per opening: the form then holds what is being edited.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setDetail = (key: keyof HospitalDetails, value: string) => setDetails(d => ({...d, [key]: value}));
  const ready = !!form.name.trim() && !!form.code.trim() && (form.plan === 'STANDARD' || !!form.endDate);

  const save = async () => {
    setSaving(true);
    try {
      libs.updateSystemSettings(
        {
          hospitalDetails: Object.fromEntries(
            Object.entries(details).map(([k, v]) => [k, (v || '').trim() || undefined]),
          ) as HospitalDetails,
        },
        actor,
      );
      if (owner && org) {
        const data = {
          name: form.name.trim(),
          code: form.code.trim(),
          plan: form.plan,
          trialEndsAt: form.plan === 'TRIAL' ? trialEndOn(form.endDate) : undefined,
          modules: form.modules,
        };
        if (demo || !real) libs.updateOrganization(org.id, data);
        else {
          const error = await saveHospital(org, data);
          if (error) {
            await tellUser(tr('Δεν αποθηκεύτηκε'), error);
            return;
          }
        }
        setOrg({...org, ...data});
        announceHospitalChange({modules: data.modules, plan: data.plan, trialEndsAt: data.trialEndsAt});
      }
      await tellUser(tr('Αποθηκεύτηκε'), tr('Τα στοιχεία του νοσοκομείου αποθηκεύτηκαν.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="hospital-profile">
      <div className="studio-drawer-form">
        {org ? (
          <OrganizationFields value={form} readOnly={!owner} onChange={patch => setForm(f => ({...f, ...patch}))} />
        ) : (
          <small className="studio-field-hint">{tr('Φόρτωση…')}</small>
        )}
        {!owner && (
          <small className="studio-field-hint">
            {tr('Ονομασία, χρήση και ενότητες αλλάζουν από τον διαχειριστή της πλατφόρμας.')}
          </small>
        )}
        <fieldset className="hospital-details">
          <legend>{tr('Στοιχεία επικοινωνίας')}</legend>
          <label>
            {tr('Διεύθυνση')}
            <input value={details.address || ''} onChange={e => setDetail('address', e.target.value)} />
          </label>
          <label>
            {tr('Τηλέφωνο')}
            <input type="tel" value={details.phone || ''} onChange={e => setDetail('phone', e.target.value)} />
          </label>
          <label>
            Email
            <input type="email" value={details.email || ''} onChange={e => setDetail('email', e.target.value)} />
          </label>
          <label>
            {tr('Υπεύθυνος επικοινωνίας')}
            <input value={details.contactName || ''} onChange={e => setDetail('contactName', e.target.value)} />
          </label>
        </fieldset>
      </div>
      <footer>
        <AppButton variant="primary" disabled={saving || (owner && !!org && !ready)} onClick={() => void save()}>
          {tr('Αποθήκευση')}
        </AppButton>
      </footer>
    </section>
  );
}
