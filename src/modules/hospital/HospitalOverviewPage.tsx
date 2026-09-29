import {useEffect, useMemo, useState} from 'react';
import {Link} from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Gauge,
  History,
  Layers3,
  PackageCheck,
  Sparkles,
  TriangleAlert,
  UserPlus,
  Wrench,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import {useSurgi} from '../../store/SurgiStore';
import {useLibraries} from '../../core/LibraryStore';
import {useAppPreferences} from '../../core/AppPreferences';
import {demoDepartments} from '../../config/demoRoles';
import {ACCESS_REQUESTS_CHANGED, countPendingAccessRequests, managedHospitalId} from '../../data/cloud/accessRequests';
import type {AssetState} from '../../types/domain';
import {trData} from '../../i18n';
import {presetPath} from '../../core/listMemory';

/** Where an item is in the sterilization cycle, in process order. */
const PROCESS_STATES: AssetState[] = [
  'PENDING_STERILIZATION',
  'IN_WASHING',
  'IN_PREPARATION',
  'IN_PACKAGING',
  'IN_STERILIZATION',
  'AWAITING_RELEASE',
  'IN_STORAGE',
];

/** The Sterilization workspace tab that shows items in each state. */
const QUEUE_OF: Partial<Record<AssetState, string>> = {
  PENDING_STERILIZATION: 'INCOMING',
  IN_WASHING: 'WASHING',
  IN_PREPARATION: 'PREP',
  IN_PACKAGING: 'PACKAGING',
  IN_STERILIZATION: 'PROCESS',
  AWAITING_RELEASE: 'RELEASE',
  IN_STORAGE: 'STORAGE',
  READY_FOR_PICKUP: 'READY',
};

const movementStamp = (at: string) => {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?:\s*(π\.?μ\.?|μ\.?μ\.?|am|pm))?/i.exec(at.trim());
  if (!m) return 0;
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  let hour = Number(m[4]) % 12;
  const suffix = (m[6] || '').toLowerCase();
  if (!suffix) hour = Number(m[4]);
  else if (suffix.startsWith('μ') || suffix === 'pm') hour += 12;
  return new Date(year, Number(m[2]) - 1, Number(m[1]), hour, Number(m[5])).getTime();
};

/**
 * The hospital admin's home: the whole hospital at a glance — where the sets and instruments
 * are, what each department holds, what is stuck, and the latest movements.
 */
export default function HospitalOverviewPage() {
  const {sets, tools, issues, movements, lifecycleAlerts} = useSurgi();
  const {departments} = useLibraries();
  const {lang} = useAppPreferences();
  const L = (el: string, en: string) => (lang === 'el' ? el : en);
  const hospitalId = managedHospitalId();
  const [pendingAccess, setPendingAccess] = useState(0);

  useEffect(() => {
    if (!hospitalId) return;
    const refresh = () => void countPendingAccessRequests(hospitalId).then(setPendingAccess);
    refresh();
    window.addEventListener(ACCESS_REQUESTS_CHANGED, refresh);
    return () => window.removeEventListener(ACCESS_REQUESTS_CHANGED, refresh);
  }, [hospitalId]);

  // Sets and standalone instruments move through the cycle; set members travel with their set.
  const tracked = useMemo(() => [...sets, ...tools.filter(t => t.mode === 'STANDALONE')], [sets, tools]);
  const inProcess = tracked.filter(a => PROCESS_STATES.includes(a.state));
  const ready = tracked.filter(a => a.state === 'READY_FOR_PICKUP');
  const openIssues = issues.filter(i => i.status === 'OPEN');
  const lost = tracked.filter(a => a.state === 'LOST' || a.state === 'SERVICE');

  const byDepartment = useMemo(
    () =>
      demoDepartments(departments)
        .map(d => {
          const mine = tracked.filter(a => a.department === d.el);
          return {
            id: d.id,
            key: d.el,
            name: lang === 'el' ? d.el : d.en,
            total: mine.length,
            atDepartment: mine.filter(a => a.state === 'IN_DEPARTMENT').length,
            inProcess: mine.filter(a => PROCESS_STATES.includes(a.state)).length,
            ready: mine.filter(a => a.state === 'READY_FOR_PICKUP').length,
            issues: openIssues.filter(i => i.department === d.el).length,
          };
        })
        .sort((a, b) => b.total - a.total),
    [departments, tracked, openIssues, lang],
  );
  // Movement times are Greek-locale strings ("14/08/2026 09:28" or "14/8/26, 9:28 π.μ."); newest
  // first, keeping the stored order for anything unparseable.
  const latestMovements = useMemo(
    () =>
      movements
        .map((m, index) => ({m, index, stamp: movementStamp(m.at)}))
        .sort((a, b) => b.stamp - a.stamp || a.index - b.index)
        .slice(0, 8)
        .map(x => x.m),
    [movements],
  );
  const pipeline = PROCESS_STATES.map(state => ({state, count: tracked.filter(a => a.state === state).length}));
  const pipelineMax = Math.max(1, ...pipeline.map(p => p.count));

  const kpis = [
    {icon: Layers3, label: L('Σετ', 'Sets'), value: sets.length, to: presetPath('/sets')},
    {icon: Wrench, label: L('Εργαλεία', 'Instruments'), value: tools.length, to: presetPath('/tools')},
    {icon: Sparkles, label: L('Στην Αποστείρωση', 'In sterilization'), value: inProcess.length, to: '/sterilization'},
    {
      icon: PackageCheck,
      label: L('Έτοιμα για παραλαβή', 'Ready for pickup'),
      value: ready.length,
      to: '/sterilization?queue=READY',
    },
    {
      icon: TriangleAlert,
      label: L('Ανοικτές εκκρεμότητες', 'Open issues'),
      value: openIssues.length,
      to: presetPath('/issues', {status: 'OPEN'}),
      warn: openIssues.length > 0,
    },
    {
      icon: Gauge,
      label: L('Κοντά στο όριο χρήσεων', 'Near usage limit'),
      value: lifecycleAlerts.length,
      to: presetPath('/tools', {usage: 'LOW'}),
      warn: lifecycleAlerts.length > 0,
    },
  ];

  return (
    <div className="hospital-overview">
      <PageHeader
        eyebrow={L('ΕΠΙΣΚΟΠΗΣΗ ΝΟΣΟΚΟΜΕΙΟΥ', 'HOSPITAL OVERVIEW')}
        title={L('Επισκόπηση', 'Overview')}
        description={L(
          'Όλο το νοσοκομείο με μια ματιά: πού βρίσκονται τα Σετ και τα εργαλεία, τι έχει κάθε τμήμα, τι εκκρεμεί.',
          'The whole hospital at a glance: where sets and instruments are, what each department holds, what is pending.',
        )}
        actions={
          <div className="overview-links">
            <Link className="app-button app-button-secondary app-button-md" to="/reports">
              {L('Αναφορές', 'Reports')}
            </Link>
            <Link className="app-button app-button-secondary app-button-md" to="/movements">
              <History size={15} />
              {L('Ιστορικό', 'History')}
            </Link>
          </div>
        }
      />

      {pendingAccess > 0 && (
        <Link className="overview-alert" to="/hospital">
          <UserPlus size={18} />
          <span>
            <b>
              {L(
                `${pendingAccess} ${pendingAccess === 1 ? 'αίτημα πρόσβασης περιμένει' : 'αιτήματα πρόσβασης περιμένουν'} έγκριση`,
                `${pendingAccess} access ${pendingAccess === 1 ? 'request is' : 'requests are'} awaiting approval`,
              )}
            </b>
            <small>
              {L(
                'Εγκρίνετε ή απορρίψτε από τη Διαχείριση νοσοκομείου.',
                'Approve or reject in Hospital administration.',
              )}
            </small>
          </span>
          <ArrowRight size={16} />
        </Link>
      )}

      <div className="overview-kpis">
        {kpis.map(k => (
          <Link key={k.label} to={k.to} className={k.warn ? 'warn' : ''}>
            <k.icon size={18} />
            <span>{k.label}</span>
            <strong>{k.value}</strong>
          </Link>
        ))}
      </div>

      <div className="overview-grid">
        <section className="hospital-card overview-departments">
          <header>
            <div>
              <b>{L('Ανά τμήμα', 'By department')}</b>
              <small>
                {L('Σετ και μεμονωμένα εργαλεία κάθε τμήματος.', "Each department's sets and standalone instruments.")}
              </small>
            </div>
          </header>
          <div className="overview-table">
            <div className="overview-row head">
              <span>{L('Τμήμα', 'Department')}</span>
              <span>{L('Σύνολο', 'Total')}</span>
              <span>{L('Στο τμήμα', 'At department')}</span>
              <span>{L('Αποστείρωση', 'Sterilization')}</span>
              <span>{L('Έτοιμα', 'Ready')}</span>
              <span>{L('Εκκρεμότητες', 'Issues')}</span>
            </div>
            {byDepartment.map(d => (
              <div key={d.id} className="overview-row">
                <Link className="overview-name" to={presetPath('/sets', {department: d.key})}>
                  {d.name}
                </Link>
                <span>{d.total}</span>
                <span>{d.atDepartment}</span>
                <span>{d.inProcess}</span>
                <span className={d.ready ? 'good' : ''}>{d.ready}</span>
                <span className={d.issues ? 'bad' : ''}>{d.issues}</span>
              </div>
            ))}
            {byDepartment.length === 0 && (
              <p className="hospital-empty">{L('Δεν υπάρχουν τμήματα ακόμα.', 'No departments yet.')}</p>
            )}
          </div>
        </section>

        <section className="hospital-card overview-pipeline">
          <header>
            <div>
              <b>{L('Ροή Αποστείρωσης', 'Sterilization flow')}</b>
              <small>{L('Πόσα βρίσκονται σε κάθε στάδιο τώρα.', 'How many are at each stage right now.')}</small>
            </div>
            <Activity size={18} />
          </header>
          {pipeline.map(p => (
            <Link key={p.state} className="overview-bar" to={`/sterilization?queue=${QUEUE_OF[p.state]}`}>
              <StatusBadge value={p.state} />
              <div>
                <i style={{width: `${(p.count / pipelineMax) * 100}%`}} />
              </div>
              <strong>{p.count}</strong>
            </Link>
          ))}
          {lost.length > 0 && (
            <small className="overview-lost">
              {L(`Σε service ή απολεσθέντα: ${lost.length}`, `In service or lost: ${lost.length}`)}
            </small>
          )}
        </section>

        <section className="hospital-card overview-movements">
          <header>
            <div>
              <b>{L('Τελευταίες κινήσεις', 'Latest movements')}</b>
              <small>
                {L(
                  'Οι πιο πρόσφατες ενέργειες σε Σετ και εργαλεία.',
                  'The most recent actions on sets and instruments.',
                )}
              </small>
            </div>
            <Link to="/movements">{L('Όλο το ιστορικό', 'Full history')}</Link>
          </header>
          {latestMovements.map(m => (
            <div key={m.id} className="overview-line">
              <span>
                <b>{m.asset}</b>
                <small>
                  {trData(m.from)} → {trData(m.to)}
                </small>
              </span>
              <span>
                <b>{trData(m.status)}</b>
                <small>
                  {m.at} · {trData(m.by)}
                </small>
              </span>
            </div>
          ))}
          {movements.length === 0 && (
            <p className="hospital-empty">{L('Δεν υπάρχουν κινήσεις ακόμα.', 'No movements yet.')}</p>
          )}
        </section>

        <section className="hospital-card overview-issues">
          <header>
            <div>
              <b>{L('Ανοικτές εκκρεμότητες', 'Open issues')}</b>
              <small>
                {L('Ελλείψεις, φθορές και βλάβες προς διαχείριση.', 'Missing, damaged or faulty items to handle.')}
              </small>
            </div>
            <Link to={presetPath('/issues', {status: 'OPEN'})}>{L('Όλες', 'All')}</Link>
          </header>
          {openIssues.slice(0, 6).map(i => (
            <div key={i.id} className="overview-line">
              <span>
                <b>{i.asset}</b>
                <small>{trData(i.department)}</small>
              </span>
              <span>
                <b className="bad">{trData(i.type)}</b>
                <small>{i.created}</small>
              </span>
            </div>
          ))}
          {openIssues.length === 0 && (
            <p className="hospital-empty">{L('Δεν υπάρχουν ανοικτές εκκρεμότητες.', 'No open issues.')}</p>
          )}
          {lifecycleAlerts.length > 0 && (
            <div className="overview-usage">
              <b>{L('Κοντά στο όριο χρήσεων', 'Near usage limit')}</b>
              {lifecycleAlerts.slice(0, 4).map(a => (
                <span key={a.id}>
                  {a.barcode} · {a.name} — {L(`απομένουν ${a.remaining}`, `${a.remaining} left`)}
                </span>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
