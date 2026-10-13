import {useEffect, useState} from 'react';
import {Building2, ChevronRight, FlaskConical} from 'lucide-react';
import {tellUser} from '../../components/ui/confirmService';
import {enterPlatformDemo} from '../../data/cloud/platformDemo';
import {switchHospital} from '../../data/cloud/hospitalSwitch';
import {tr} from '../../i18n';
import {supabase} from '../../lib/supabase';
import {SCAN_PATH} from './scanApp';

type Hospital = {id: string; name: string; active: boolean};

/**
 * The platform owner's way in, on the phone: the Demo, or one of the hospitals (entered as in Studio →
 * Νοσοκομεία, but straight onto its scanning stations).
 */
export default function OwnerEntry() {
  const [hospitals, setHospitals] = useState<Hospital[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    void supabase
      .from('organizations')
      .select('id,name,active')
      .eq('is_demo', false)
      .order('name')
      .then(({data, error: loadError}) => {
        if (!live) return;
        if (loadError) setError(tr('Δεν ήταν δυνατή η φόρτωση των νοσοκομείων.'));
        setHospitals((data || []) as Hospital[]);
      });
    return () => {
      live = false;
    };
  }, []);
  const enterDemo = () => {
    setBusy(true);
    void enterPlatformDemo('ADMIN', undefined, `#${SCAN_PATH}`).then(failure => {
      if (failure === undefined) return;
      setBusy(false);
      void tellUser(tr('Είσοδος Demo'), failure || tr('Δεν ήταν δυνατή η είσοδος στο Demo.'));
    });
  };

  return (
    <nav className="scan-stations" aria-label={tr('Είσοδος')}>
      <button type="button" className="scan-station demo" disabled={busy} onClick={enterDemo}>
        <span className="scan-station-icon">
          <FlaskConical size={26} />
        </span>
        <span>
          <b>{tr('Demo')}</b>
          <small>{tr('Δοκιμαστικό νοσοκομείο, για δοκιμές')}</small>
        </span>
        <ChevronRight size={20} />
      </button>
      <h2 className="scan-section">{tr('Νοσοκομεία')}</h2>
      {error && <p className="scan-empty">{error}</p>}
      {hospitals === null ? (
        <p className="scan-empty">{tr('Φόρτωση…')}</p>
      ) : hospitals.length ? (
        hospitals.map(hospital => (
          <button
            key={hospital.id}
            type="button"
            className="scan-station hospital"
            disabled={busy || !hospital.active}
            onClick={() => {
              setBusy(true);
              switchHospital(hospital.id, `#${SCAN_PATH}`);
            }}
          >
            <span className="scan-station-icon">
              <Building2 size={26} />
            </span>
            <span>
              <b>{hospital.name}</b>
              <small>{hospital.active ? tr('Είσοδος στο νοσοκομείο') : tr('Ανενεργό')}</small>
            </span>
            <ChevronRight size={20} />
          </button>
        ))
      ) : (
        !error && <p className="scan-empty">{tr('Δεν υπάρχουν νοσοκομεία ακόμα.')}</p>
      )}
    </nav>
  );
}
