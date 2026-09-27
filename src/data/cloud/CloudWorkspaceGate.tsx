import {useCallback, useEffect, useState, type ReactNode} from 'react';
import {supabase} from '../../lib/supabase';
import {demoAdminRepository} from '../adminRepositories/demoRepository';
import {demoSurgiRepository} from '../repositories/demoRepository';
import {loadAppRecords, seedAppRecords, type CloudRecords} from './appRecords';

export type CloudWorkspace = {
  organizationId: string;
  records: CloudRecords;
};

/** A demo organization starts with the built-in sample hospital the first time it is opened. */
const seedDemoOrganization = async (organizationId: string) => {
  const store = demoSurgiRepository.getInitialData();
  const library = {...demoAdminRepository.getInitialData(), id: 'state'};
  // The library document is written last: its presence marks a completed seed.
  await seedAppRecords(organizationId, {
    sets: store.sets,
    tools: store.tools,
    movements: store.movements,
    issues: store.issues,
    library: [library],
  } as Partial<CloudRecords>);
};

const exitWorkspace = () => {
  sessionStorage.removeItem('surgitrack-data-mode');
  sessionStorage.removeItem('surgitrack-demo-role');
  sessionStorage.removeItem('surgitrack-session-user');
  sessionStorage.removeItem('surgitrack-active-organization');
  window.location.hash = '#/studio';
  window.location.reload();
};

/**
 * Loads the organization's records before the stores mount. Without a cloud organization
 * (or without a signed-in session) the app runs on its local data as before.
 */
export default function CloudWorkspaceGate({
  organizationId,
  children,
}: {
  organizationId?: string;
  children: (workspace: CloudWorkspace | null) => ReactNode;
}) {
  const [workspace, setWorkspace] = useState<CloudWorkspace | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'local' | 'error'>(organizationId ? 'loading' : 'local');
  const [error, setError] = useState('');
  const lang = localStorage.getItem('surgitrack-lang') === 'en' ? 'en' : 'el';

  const load = useCallback(async () => {
    if (!organizationId) return;
    setStatus('loading');
    try {
      const {data: session} = await supabase.auth.getSession();
      if (!session.session) {
        setStatus('local');
        return;
      }
      // Only demo organizations use the cloud workspace for now. A stale tab may still hold a real
      // hospital's id, so refuse anything that is not a demo before any write can happen.
      const {data: org, error: orgError} = await supabase
        .from('organizations')
        .select('is_demo')
        .eq('id', organizationId)
        .single();
      if (orgError) throw orgError;
      if (!org.is_demo)
        throw new Error(
          lang === 'el' ? 'Ο οργανισμός δεν είναι Demo νοσοκομείο.' : 'This organization is not a Demo hospital.',
        );
      let records = await loadAppRecords(organizationId);
      if (!records.library.length) {
        await seedDemoOrganization(organizationId);
        records = await loadAppRecords(organizationId);
      }
      setWorkspace({organizationId, records});
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : String((e as {message?: string})?.message || e));
      setStatus('error');
    }
  }, [organizationId, lang]);

  useEffect(() => {
    void load();
  }, [load]);

  if (status === 'local') return <>{children(null)}</>;
  if (status === 'ready' && workspace) return <>{children(workspace)}</>;
  return (
    <div className="cloud-gate">
      {status === 'loading' ? (
        <p>{lang === 'el' ? 'Φόρτωση δεδομένων…' : 'Loading data…'}</p>
      ) : (
        <>
          <strong>
            {lang === 'el' ? 'Δεν ήταν δυνατή η φόρτωση των δεδομένων.' : 'The data could not be loaded.'}
          </strong>
          <small>{error}</small>
          <div>
            <button onClick={() => void load()}>{lang === 'el' ? 'Δοκιμή ξανά' : 'Try again'}</button>
            <button onClick={exitWorkspace}>
              {lang === 'el' ? 'Επιστροφή στη Διαχείριση' : 'Back to Platform Admin'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
