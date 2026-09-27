import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {getRuntimeDataMode} from '../../config/dataMode';
import {
  currentDemoView,
  demoDepartments,
  demoSessionUser,
  viewAsSessionUser,
  type DemoView,
} from '../../config/demoRoles';
import {useAppPreferences} from '../../core/AppPreferences';
import {useLibraries} from '../../core/LibraryStore';
import {canViewAs, getRealIdentity, sessionUserFor} from '../../data/cloud/identity';
import {supabase} from '../../lib/supabase';
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
  const pickHospital = !isDemo && !!real?.platform;
  const pickRole = isDemo || (canViewAs(real) && (!real?.platform || !!activeOrganization));
  const [hospitals, setHospitals] = useState<Array<{id: string; name: string}>>([]);

  useEffect(() => {
    if (!pickHospital) return;
    void supabase
      .from('organizations')
      .select('id,name')
      .eq('is_demo', false)
      .eq('active', true)
      .order('name')
      .then(({data}) => setHospitals(data || []));
  }, [pickHospital]);

  const changeView = (view: DemoView) => {
    if (isDemo) switchIdentity(demoSessionUser(view, departments));
    else if (real && view === 'ADMIN') switchIdentity(sessionUserFor(real));
    else if (real) switchIdentity(viewAsSessionUser(view, departments, real));
    navigate('/');
  };

  // A different hospital means different data: reload so its records are loaded.
  const changeHospital = (id: string) => {
    if (id) sessionStorage.setItem(ACTIVE_ORGANIZATION_KEY, id);
    else sessionStorage.removeItem(ACTIVE_ORGANIZATION_KEY);
    sessionStorage.removeItem('surgitrack-session-user');
    sessionStorage.setItem('surgitrack-demo-role', 'ADMIN');
    window.location.hash = id ? '#/' : '#/studio';
    window.location.reload();
  };

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
          value={currentDemoView(role, currentUser, departments)}
          onChange={e => changeView(e.target.value as DemoView)}
          title={L('Προβολή ως ρόλος ή τμήμα', 'View as role or department')}
          aria-label={L('Προβολή ως', 'View as')}
        >
          <option value="ADMIN">Admin</option>
          <option value="STERILIZATION">{L('Αποστείρωση', 'Sterilization')}</option>
          <optgroup label={L('Τμήματα', 'Departments')}>
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
