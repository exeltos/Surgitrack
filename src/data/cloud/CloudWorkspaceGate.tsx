import {useCallback, useEffect, useState, type ReactNode} from 'react';
import {supabase} from '../../lib/supabase';
import {getRuntimeDataMode} from '../../config/dataMode';
import type {LibraryItem} from '../../core/libraries';
import {
  getCloudOrganizationId,
  loadAppRecords,
  STORE_COLLECTIONS,
  type CloudCollection,
  type CloudRecords,
} from './appRecords';
import {readCache, setCacheOwner, setRestored} from './localCache';
import {setCutoff} from './historyWindow';
import {productionOrganizationFor, resolveIdentity} from './identity';
import {translateToEnglish} from '../../core/glossary';
import Spinner from '../../components/ui/Spinner';
import {trialState, type HospitalPlan, type TrialState} from '../../core/trial';
import {loadPlatformContact, type PlatformContact} from './platformContact';
import {TrialContext} from './trialContext';
import {EvaluationDemoContext, type EvaluationDemo} from './demoContext';
import {formatDate} from '../../core/displayDate';
import {seedDemoOrganization} from './demoSeed';

export type CloudWorkspace = {
  organizationId: string;
  organizationName: string;
  records: CloudRecords;
  /** Real hospitals keep their departments in Studio (the departments table): the source of truth. */
  departments?: LibraryItem[];
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
  const [status, setStatus] = useState<'loading' | 'ready' | 'local' | 'error' | 'locked'>('loading');
  const [trial, setTrial] = useState<TrialState | null>(null);
  const [evaluationDemo, setEvaluationDemo] = useState<EvaluationDemo | null>(null);
  const [lock, setLock] = useState<{
    hospital: string;
    endsAt?: string;
    evaluation: boolean;
    contact: PlatformContact;
  }>();
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
        .select('name,is_demo,evaluation,plan,trial_ends_at')
        .eq('id', organizationId)
        .single();
      if (orgError) throw orgError;
      // Demo work only ever lands in demo hospitals and real work only in real ones, so a stale
      // tab or a mode switch can never write sample data into a real hospital (or the reverse).
      // A prospect's evaluation Demo is the exception: real accounts work in it, outside Demo mode.
      const evaluation = org.is_demo && !!org.evaluation && !demo;
      if (org.is_demo !== demo && !evaluation)
        throw new Error(
          demo
            ? lang === 'el'
              ? 'Ο οργανισμός δεν είναι Demo νοσοκομείο.'
              : 'This organization is not a Demo hospital.'
            : lang === 'el'
              ? 'Ο οργανισμός είναι Demo νοσοκομείο.'
              : 'This organization is a Demo hospital.',
        );
      const plan = trialState(org.plan as HospitalPlan, org.trial_ends_at || undefined);
      // A trial that has ended locks the hospital for everyone but the platform owner (the
      // database refuses its data too); the owner still gets in, to extend it or switch it.
      if (plan.ended && !result.identity.platform) {
        setLock({hospital: org.name, endsAt: plan.endsAt, evaluation, contact: await loadPlatformContact()});
        setStatus('locked');
        return;
      }
      setTrial(plan.plan === 'TRIAL' ? plan : null);
      setEvaluationDemo(
        evaluation ? {organizationId, hospitalName: org.name, endsAt: org.trial_ends_at || undefined} : null,
      );
      // This device's copy (less than a day old) opens the hospital at once; the sync then fetches only
      // what changed since, and sends what was left unsaved when the page closed.
      const owner = {userId: result.identity.id, organizationId};
      setCacheOwner(owner);
      const collections: CloudCollection[] = [...STORE_COLLECTIONS, 'library'];
      const copy = await readCache(owner, collections);
      const fromCopy = collections.every(collection => copy[collection]);
      let records: CloudRecords;
      if (fromCopy) {
        records = Object.fromEntries(collections.map(c => [c, copy[c]!.items])) as unknown as CloudRecords;
        collections.forEach(c => setCutoff(c, copy[c]!.cutoff));
        setRestored(organizationId, copy);
      } else records = await loadAppRecords(organizationId);
      // An empty Demo is filled on entry; an evaluation Demo only by the platform owner (Studio fills
      // it before the prospect is invited), so the prospect never records the sample history.
      if ((demo || (evaluation && result.identity.platform)) && !records.library.length) {
        await seedDemoOrganization(organizationId, {evaluation});
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

  // A tab left open past the trial's end reloads then, so it locks without waiting for a refresh
  // (and picks up an extension the owner made meanwhile). Timers cap at ~24 days, so a later end
  // only re-arms the timer.
  const [rearm, setRearm] = useState(0);
  useEffect(() => {
    if (!trial?.endsAt || trial.ended) return;
    const left = Date.parse(trial.endsAt) - Date.now() + 1000;
    const cap = 2 ** 31 - 1;
    const timer = window.setTimeout(
      () => (left > cap ? setRearm(n => n + 1) : void load()),
      Math.min(Math.max(left, 0), cap),
    );
    return () => window.clearTimeout(timer);
  }, [trial, load, rearm]);

  if (status === 'local') return <>{children(null)}</>;
  if (status === 'ready' && workspace)
    return (
      <TrialContext.Provider value={trial}>
        <EvaluationDemoContext.Provider value={evaluationDemo}>{children(workspace)}</EvaluationDemoContext.Provider>
      </TrialContext.Provider>
    );
  if (status === 'locked' && lock) return <TrialLocked lang={lang} {...lock} />;
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

/** What the users of a hospital see once its trial has ended. */
function TrialLocked({
  lang,
  hospital,
  endsAt,
  evaluation,
  contact,
}: {
  lang: 'el' | 'en';
  hospital: string;
  endsAt?: string;
  evaluation: boolean;
  contact: PlatformContact;
}) {
  const L = (el: string, en: string) => (lang === 'el' ? el : en);
  const date = endsAt ? formatDate(endsAt) : '';
  const signOut = async () => {
    await supabase.auth.signOut();
    sessionStorage.removeItem('surgitrack-active-organization');
    window.location.hash = '#/';
    window.location.reload();
  };
  return (
    <div className="cloud-gate trial-locked" role="alert">
      <strong>
        {evaluation
          ? L('Το Demo αξιολόγησης έληξε', 'The evaluation Demo has ended')
          : L('Η δοκιμαστική περίοδος έληξε', 'The trial period has ended')}
      </strong>
      <p>
        {evaluation
          ? L(
              `Το Demo «${hospital}» έληξε${date ? ` στις ${date}` : ''}. Ευχαριστούμε που δοκιμάσατε το SurgiTrack. Για παράταση ή για να αποκτήσετε την εφαρμογή, επικοινωνήστε μαζί μας.`,
              `The Demo “${hospital}” ended${date ? ` on ${date}` : ''}. Thank you for trying SurgiTrack. For an extension, or to get the application, contact us.`,
            )
          : L(
              `Η δοκιμαστική περίοδος του «${hospital}» έληξε${date ? ` στις ${date}` : ''}. Τα δεδομένα σας είναι ασφαλή και διατηρούνται. Για να συνεχίσετε, επικοινωνήστε με τον διαχειριστή του SurgiTrack.`,
              `The trial period of “${hospital}” ended${date ? ` on ${date}` : ''}. Your data is safe and kept. To continue, contact the SurgiTrack administrator.`,
            )}
      </p>
      {(contact.name || contact.email || contact.phone) && (
        <dl className="trial-contact">
          {contact.name && (
            <>
              <dt>{L('Επικοινωνία', 'Contact')}</dt>
              <dd>{contact.name}</dd>
            </>
          )}
          {contact.email && (
            <>
              <dt>Email</dt>
              <dd>
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
              </dd>
            </>
          )}
          {contact.phone && (
            <>
              <dt>{L('Τηλέφωνο', 'Phone')}</dt>
              <dd>
                <a href={`tel:${contact.phone.replace(/\s+/g, '')}`}>{contact.phone}</a>
              </dd>
            </>
          )}
        </dl>
      )}
      <div>
        <button onClick={() => void signOut()}>{L('Αποσύνδεση', 'Sign out')}</button>
      </div>
    </div>
  );
}
