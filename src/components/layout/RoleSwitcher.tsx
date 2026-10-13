import {useEffect, useState} from 'react';
import {Building2, X} from 'lucide-react';
import {useNavigate} from 'react-router-dom';
import {getRuntimeDataMode} from '../../config/dataMode';
import {
  currentDemoView,
  demoDepartments,
  demoSessionUser,
  hospitalRoleNames,
  viewAsSessionUser,
  type DemoView,
} from '../../config/demoRoles';
import {useAppPreferences} from '../../core/AppPreferences';
import {useLibraries} from '../../core/LibraryStore';
import {canViewAs, getRealIdentity, sessionUserFor} from '../../data/cloud/identity';
import {supabase} from '../../lib/supabase';
import {switchHospital} from '../../data/cloud/hospitalSwitch';
import {useSurgi} from '../../store/SurgiStore';

const ACTIVE_ORGANIZATION_KEY = 'surgitrack-active-organization';

/**
 * Header pickers for seeing the app as someone else sees it.
 * - Demo: any role or library department of the demo hospital.
 * - Hospital admin: Admin, Sterilization or any department of their hospital (real data).
 * - Platform admin inside a hospital (entered from Studio → Νοσοκομεία): the hospital's name with the way back
 *   to Studio, then a role or department in it (real data).
 */
/** `home`: where a new role opens (the full app's home, or the phone app's stations). */
export default function RoleSwitcher({home = '/'}: {home?: string} = {}) {
  const {role, currentUser, switchIdentity} = useSurgi();
  const {departments} = useLibraries();
  const {lang} = useAppPreferences();
  const navigate = useNavigate();
  const isDemo = getRuntimeDataMode() === 'DEMO';
  const real = getRealIdentity();
  const activeOrganization = sessionStorage.getItem(ACTIVE_ORGANIZATION_KEY) || '';
  // The owner inside a hospital: its name and the way back to Studio (hospitals are entered from Studio →
  // Νοσοκομεία, so Studio itself needs no hospital picker).
  const inHospital = !isDemo && !!real?.platform && !!activeOrganization;
  const pickRole = isDemo || (canViewAs(real) && (!real?.platform || !!activeOrganization));
  const [hospitalName, setHospitalName] = useState('');

  useEffect(() => {
    if (!inHospital) return;
    void supabase
      .from('organizations')
      .select('name')
      .eq('id', activeOrganization)
      .maybeSingle()
      .then(({data}) => setHospitalName(data?.name || ''));
  }, [inHospital, activeOrganization]);

  // The owner inside a hospital can work as themselves or see it exactly as its administrator does.
  const ownerInHospital = !isDemo && !!real?.platform;
  const changeView = (view: DemoView | 'OWNER') => {
    if (isDemo) switchIdentity(demoSessionUser(view as DemoView, departments));
    else if (real && (view === 'OWNER' || (view === 'ADMIN' && !real.platform))) switchIdentity(sessionUserFor(real));
    else if (real) switchIdentity(viewAsSessionUser(view as DemoView, departments, real));
    navigate(home);
  };
  const currentView =
    ownerInHospital && role === 'ADMIN' && !currentUser.viewAs
      ? 'OWNER'
      : currentDemoView(role, currentUser, departments);

  if (!inHospital && !pickRole) return null;
  const L = (el: string, en: string) => (lang === 'el' ? el : en);
  return (
    <div className="role-switch">
      {inHospital && (
        <span className="role-switch-hospital">
          <Building2 size={15} aria-hidden="true" />
          <b title={hospitalName}>{hospitalName || L('Νοσοκομείο', 'Hospital')}</b>
          <button
            type="button"
            onClick={() => switchHospital('')}
            title={L('Επιστροφή στο Studio', 'Back to Studio')}
            aria-label={L('Επιστροφή στο Studio', 'Back to Studio')}
          >
            <X size={14} />
            <span>{L('Studio', 'Studio')}</span>
          </button>
        </span>
      )}
      {pickRole && (
        <select
          value={currentView}
          onChange={e => changeView(e.target.value as DemoView | 'OWNER')}
          title={L('Προβολή ως ρόλος ή τμήμα', 'View as role or department')}
          aria-label={L('Προβολή ως', 'View as')}
        >
          {ownerInHospital && <option value="OWNER">{L('Owner (εσείς)', 'Owner (you)')}</option>}
          {(['ADMIN', 'STERILIZATION_SUPERVISOR', 'STERILIZATION', 'VIEWER'] as const).map(kind => (
            <option key={kind} value={kind}>
              {L(hospitalRoleNames[kind].el, hospitalRoleNames[kind].en)}
            </option>
          ))}
          <optgroup label={L('Χρήστης Τμήματος', 'Department user')}>
            {demoDepartments(departments).map(d => (
              <option key={d.id} value={`DEPARTMENT:${d.id}`}>
                {lang === 'el' ? d.el : d.en}
              </option>
            ))}
          </optgroup>
        </select>
      )}
    </div>
  );
}
