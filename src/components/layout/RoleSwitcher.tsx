import {useEffect, useState} from 'react';
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
import {actingAsPlatformOwner, canViewAs, getRealIdentity, sessionUserFor} from '../../data/cloud/identity';
import {supabase} from '../../lib/supabase';
import {switchHospital} from '../../data/cloud/hospitalSwitch';
import {useSurgi} from '../../store/SurgiStore';

const ACTIVE_ORGANIZATION_KEY = 'surgitrack-active-organization';

/**
 * Header pickers for seeing the app as someone else sees it.
 * - Demo: any role or library department of the demo hospital.
 * - Hospital admin: Admin, Sterilization or any department of their hospital (real data).
 * - Platform admin: first a hospital, then a role or department in it (real data).
 */
export default function RoleSwitcher() {
  const {role, currentUser, switchIdentity} = useSurgi();
  const {departments} = useLibraries();
  const {lang} = useAppPreferences();
  const navigate = useNavigate();
  const isDemo = getRuntimeDataMode() === 'DEMO';
  const real = getRealIdentity();
  const activeOrganization = sessionStorage.getItem(ACTIVE_ORGANIZATION_KEY) || '';
  // Viewing a hospital as one of its roles hides the other hospitals, as for that role; picking
  // "Owner" brings the hospital picker back.
  const pickHospital = !isDemo && !!real?.platform && (!activeOrganization || actingAsPlatformOwner());
  const pickRole = isDemo || (canViewAs(real) && (!real?.platform || !!activeOrganization));
  const [hospitals, setHospitals] = useState<Array<{id: string; name: string}>>([]);

  useEffect(() => {
    if (!pickHospital) return;
    void supabase
      .from('organizations')
      .select('id,name')
      // Real hospitals, and the prospects' evaluation Demos the owner may enter to help.
      .or('is_demo.eq.false,evaluation.eq.true')
      .eq('active', true)
      .order('name')
      .then(({data}) => setHospitals(data || []));
  }, [pickHospital]);

  // The owner inside a hospital can work as themselves or see it exactly as its administrator does.
  const ownerInHospital = !isDemo && !!real?.platform;
  const changeView = (view: DemoView | 'OWNER') => {
    if (isDemo) switchIdentity(demoSessionUser(view as DemoView, departments));
    else if (real && (view === 'OWNER' || (view === 'ADMIN' && !real.platform))) switchIdentity(sessionUserFor(real));
    else if (real) switchIdentity(viewAsSessionUser(view as DemoView, departments, real));
    navigate('/');
  };
  const currentView =
    ownerInHospital && role === 'ADMIN' && !currentUser.viewAs
      ? 'OWNER'
      : currentDemoView(role, currentUser, departments);

  // A different hospital means different data: reload so its records are loaded.
  const changeHospital = (id: string) => switchHospital(id, id ? '#/' : '#/studio');

  if (!pickHospital && !pickRole) return null;
  const L = (el: string, en: string) => (lang === 'el' ? el : en);
  return (
    <div className="role-switch">
      {pickHospital && (
        <select
          value={activeOrganization}
          onChange={e => changeHospital(e.target.value)}
          title={L('Νοσοκομείο εργασίας', 'Working hospital')}
          aria-label={L('Νοσοκομείο', 'Hospital')}
        >
          <option value="">{L('— Μόνο Studio —', '— Studio only —')}</option>
          {hospitals.map(h => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
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
