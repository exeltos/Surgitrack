import {useEffect, useState} from 'react';
import {RefreshCw} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import AppButton from '../../components/ui/AppButton';
import HospitalPeople from './HospitalPeople';
import {supabase} from '../../lib/supabase';
import {useAppPreferences} from '../../core/AppPreferences';
import {getRuntimeDataMode} from '../../config/dataMode';
import {managedHospitalId} from '../../data/cloud/accessRequests';

/**
 * Hospital administration for the hospital's own admin (or the platform admin working in it):
 * its users (invitations, signups to approve) and its departments.
 */
export default function HospitalAdminPage() {
  const {lang} = useAppPreferences();
  const L = (gr: string, en: string) => (lang === 'el' ? gr : en);
  const organizationId = managedHospitalId();
  const demo = getRuntimeDataMode() === 'DEMO';
  const [hospital, setHospital] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (demo || !organizationId) return;
    void supabase
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .single()
      .then(({data}) => data && setHospital(data.name));
  }, [organizationId, demo]);

  if (!organizationId && !demo)
    return (
      <div className="hospital-admin">
        <PageHeader
          title={L('Διαχείριση νοσοκομείου', 'Hospital administration')}
          description={L(
            'Διαθέσιμο μόνο για τον διαχειριστή ενός πραγματικού νοσοκομείου.',
            'Available only to the administrator of a real hospital.',
          )}
        />
      </div>
    );

  return (
    <div className="hospital-admin">
      <PageHeader
        eyebrow={L('ΧΡΗΣΤΕΣ & ΤΜΗΜΑΤΑ', 'USERS & DEPARTMENTS')}
        title={(demo ? L('Demo νοσοκομείο', 'Demo hospital') : hospital) || L('Νοσοκομείο', 'Hospital')}
        description={L(
          'Χρήστες, προσκλήσεις και τμήματα του νοσοκομείου.',
          "The hospital's users, invitations and departments.",
        )}
        actions={
          <AppButton onClick={() => setRefreshKey(k => k + 1)} icon={<RefreshCw size={15} />}>
            {L('Ανανέωση', 'Refresh')}
          </AppButton>
        }
      />
      <HospitalPeople organizationId={organizationId} refreshKey={refreshKey} />
    </div>
  );
}
