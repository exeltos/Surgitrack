import {useCallback, useEffect, useState, type ReactNode} from 'react';
import {supabase} from '../../lib/supabase';
import {demoAdminRepository} from '../adminRepositories/demoRepository';
import {demoSurgiRepository} from '../repositories/demoRepository';
import {getRuntimeDataMode} from '../../config/dataMode';
import type {LibraryItem} from '../../core/libraries';
import {getCloudOrganizationId, loadAppRecords, seedAppRecords, type CloudRecords} from './appRecords';
import {productionOrganizationFor, resolveIdentity} from './identity';
import {translateToEnglish} from '../../core/glossary';
import Spinner from '../../components/ui/Spinner';

export type CloudWorkspace = {
  organizationId: string;
  organizationName: string;
  records: CloudRecords;
  /** Real hospitals keep their departments in Studio (the departments table): the source of truth. */
  departments?: LibraryItem[];
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
    processLoads: store.processLoads || [],
    receipts: store.receipts || [],
    deliveries: store.deliveries || [],
    library: [library],
  } as Partial<CloudRecords>);
};

const exitWorkspace = () => {
  sessionStorage.removeItem('surgitrack-data-mode');
  sessionStorage.removeItem('surgitrack-demo-role');
  sessionStorage.removeItem('surgitrack-session-user');
  sessionStorage.removeItem('surgitrack-active-organization');
  sessionStorage.removeItem('surgitrack-view-as');
  window.location.hash = '#/studio';
  window.location.reload();
};

/**
 * Loads the working hospital's records before the stores mount: the demo hospital in Demo,
 * otherwise the user's own hospital (or the one the platform admin picked in the header).
 * Without a session or a hospital the app runs on its local, empty data (Studio only).
 */
export default function CloudWorkspaceGate({children}: {children: (workspace: CloudWorkspace | null) => ReactNode}) {
  const [workspace, setWorkspace] = useState<CloudWorkspace | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'local' | 'error'>('loading');
  const [error, setError] = useState('');
  const lang = localStorage.getItem('surgitrack-lang') === 'en' ? 'en' : 'el';

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const result = await resolveIdentity();
      if (result.status !== 'ok') {
        setStatus('local');
        return;
      }
      const demo = getRuntimeDataMode() === 'DEMO';
      const organizationId = demo ? getCloudOrganizationId() : productionOrganizationFor(result.identity);
      if (!organizationId) {
        setStatus('local');
        return;
      }
      const {data: org, error: orgError} = await supabase
        .from('organizations')
        .select('name,is_demo')
        .eq('id', organizationId)
        .single();
      if (orgError) throw orgError;
      // Demo work only ever lands in demo hospitals and real work only in real ones, so a stale
      // tab or a mode switch can never write sample data into a real hospital (or the reverse).
      if (org.is_demo !== demo)
        throw new Error(
          demo
            ? lang === 'el'
              ? 'Ο οργανισμός δεν είναι Demo νοσοκομείο.'
              : 'This organization is not a Demo hospital.'
            : lang === 'el'
              ? 'Ο οργανισμός είναι Demo νοσοκομείο.'
              : 'This organization is a Demo hospital.',
        );
      let records = await loadAppRecords(organizationId);
      if (demo && !records.library.length) {
        await seedDemoOrganization(organizationId);
        records = await loadAppRecords(organizationId);
      }
      let departments: LibraryItem[] | undefined;
      if (!demo) {
        const {data: rows, error: departmentsError} = await supabase
          .from('departments')
          .select('id,name,code,active')
          .eq('organization_id', organizationId)
          .order('name');
        if (departmentsError) throw departmentsError;
        departments = rows
          .filter(row => row.active)
          .map(row => ({
            id: row.id,
            code: row.code || undefined,
            el: row.name,
            en: translateToEnglish(row.name) || row.name,
          }));
      }
      setWorkspace({organizationId, organizationName: org.name, records, departments});
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : String((e as {message?: string})?.message || e));
      setStatus('error');
    }
  }, [lang]);

  useEffect(() => {
    void load();
  }, [load]);

  if (status === 'local') return <>{children(null)}</>;
  if (status === 'ready' && workspace) return <>{children(workspace)}</>;
  if (status === 'loading')
    return <Spinner fullScreen label={lang === 'el' ? 'Φόρτωση δεδομένων…' : 'Loading data…'} />;
  return (
    <div className="cloud-gate">
      <>
        <strong>{lang === 'el' ? 'Δεν ήταν δυνατή η φόρτωση των δεδομένων.' : 'The data could not be loaded.'}</strong>
        <small>{error}</small>
        <div>
          <button onClick={() => void load()}>{lang === 'el' ? 'Δοκιμή ξανά' : 'Try again'}</button>
          <button onClick={exitWorkspace}>
            {lang === 'el' ? 'Επιστροφή στη Διαχείριση' : 'Back to Platform Admin'}
          </button>
        </div>
      </>
    </div>
  );
}
