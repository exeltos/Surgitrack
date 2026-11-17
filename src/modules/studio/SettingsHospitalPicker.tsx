import {useEffect, useState} from 'react';
import {supabase} from '../../lib/supabase';
import {tr} from '../../i18n';
import {activeHospitalId, switchHospital} from '../../data/cloud/hospitalSwitch';

/**
 * Whose settings the platform owner is looking at, at the top of Settings: the template new hospitals start from,
 * or one hospital. Choosing a hospital opens it (its data loads) on its Settings; the template leaves it.
 */
export default function SettingsHospitalPicker() {
  const [hospitals, setHospitals] = useState<Array<{id: string; name: string}>>([]);
  const current = activeHospitalId();
  useEffect(() => {
    let live = true;
    void supabase
      .from('organizations')
      .select('id,name,active')
      .eq('is_demo', false)
      .order('name')
      .then(({data}) => {
        if (live)
          setHospitals(((data || []) as Array<{id: string; name: string; active: boolean}>).filter(h => h.active));
      });
    return () => {
      live = false;
    };
  }, []);
  return (
    <label className="settings-hospital-picker">
      <span>{tr('Ρυθμίσεις για')}</span>
      <select value={current} onChange={e => switchHospital(e.target.value, '#/studio?tab=system')}>
        <option value="">{tr('Πρότυπο νέων νοσοκομείων')}</option>
        {/* The open hospital stays listed even before the list arrives. */}
        {current && !hospitals.some(h => h.id === current) && (
          <option value={current}>{tr('Τρέχον νοσοκομείο')}</option>
        )}
        {hospitals.map(h => (
          <option key={h.id} value={h.id}>
            {h.name}
          </option>
        ))}
      </select>
    </label>
  );
}
