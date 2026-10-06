import {useEffect, useMemo, useState} from 'react';
import {Link} from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Boxes,
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
import {statusLabel} from '../../components/ui/statusLabel';
import {useSurgi} from '../../store/SurgiStore';
import {useLibraries} from '../../core/LibraryStore';
import {useAppPreferences} from '../../core/AppPreferences';
import {demoDepartments} from '../../config/demoRoles';
import {ACCESS_REQUESTS_CHANGED, countPendingAccessRequests, managedHospitalId} from '../../data/cloud/accessRequests';
import type {AssetState} from '../../types/domain';
import {trData} from '../../i18n';
import {presetPath} from '../../core/listMemory';
import {belowMinimum, minimumRows} from '../../core/stockMinimums';

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
  const {sets, tools, retiredTools, issues, movements, lifecycleAlerts, purchaseOrders} = useSurgi();
  const {departments, systemSettings} = useLibraries();
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
  const lowStock = useMemo(
    () => belowMinimum(minimumRows([...tools, ...retiredTools], purchaseOrders, systemSettings.stockMinimums)),
    [tools, retiredTools, purchaseOrders, systemSettings.stockMinimums],
  );
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

  const shortSets = sets.filter(x => x.actual < x.expected).length;
  const kpis = [
    {
      icon: Layers3,
      label: L('Σετ', 'Sets'),
      value: sets.length,
      to: presetPath('/sets'),
      note: shortSets ? L(`${shortSets} με έλλειψη`, `${shortSets} incomplete`) : undefined,
      warn: false,
    },
    {
      icon: Wrench,
      label: L('Εργαλεία', 'Instruments'),
      value: tools.length,
      to: presetPath('/tools'),
      note: L(
        `${tools.filter(t => t.mode === 'STOCK').length} στο Απόθεμα`,
        `${tools.filter(t => t.mode === 'STOCK').length} in Stock`,
      ),
      warn: false,
    },
    {icon: Sparkles, label: L('Σε αποστείρωση', 'In sterilization'), value: inProcess.length, to: '/sterilization'},
    {
      icon: PackageCheck,
      label: L('Για παραλαβή', 'Ready for pickup'),
      value: ready.length,
      to: '/sterilization?queue=READY',
    },
    {
      icon: TriangleAlert,
      label: L('Εκκρεμότητες', 'Open issues'),
      value: openIssues.length,
      to: presetPath('/issues', {status: 'OPEN'}),
      warn: openIssues.length > 0,
    },
    {
      icon: Gauge,
      label: L('Κοντά στο όριο', 'Near usage limit'),
      value: lifecycleAlerts.length,
      to: presetPath('/tools', {usage: 'LOW'}),
      warn: lifecycleAlerts.length > 0,
    },
  ];

  // Where every unit of equipment is: Sets and standalone instruments by state, plus the instruments in Stock.
  const stockTools = tools.filter(t => t.mode === 'STOCK');
  const location = [
    {
      key: 'dept',
      label: L('Στα τμήματα', 'In departments'),
      n: tracked.filter(a => a.state === 'IN_DEPARTMENT').length,
    },
    {key: 'process', label: L('Στην Αποστείρωση', 'In sterilization'), n: inProcess.length},
    {key: 'ready', label: L('Έτοιμα για παραλαβή', 'Ready for pickup'), n: ready.length},
    {key: 'stock', label: L('Σε Απόθεμα', 'In stock'), n: stockTools.length},
    {key: 'lost', label: L('Service / απολεσθέντα', 'Service / lost'), n: lost.length},
  ];
  const locationTotal = location.reduce((sum, x) => sum + x.n, 0);
  // Movements per day over the last 14 days.
  const perDay = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Array.from({length: 14}, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (13 - i));
      return {day: d, n: 0};
    });
    for (const m of movements) {
      const stamp = movementStamp(m.at);
      if (!stamp) continue;
      const d = new Date(stamp);
      d.setHours(0, 0, 0, 0);
      const slot = days.find(x => x.day.getTime() === d.getTime());
      if (slot) slot.n++;
    }
    return days;
  }, [movements]);
  const perDayMax = Math.max(1, ...perDay.map(x => x.n));
  const perDayTotal = perDay.reduce((sum, x) => sum + x.n, 0);
  const deptMax = Math.max(1, ...byDepartment.map(d => d.total));
  const dayLabel = (d: Date) =>
    d.toLocaleDateString(lang === 'el' ? 'el-GR' : 'en-GB', {day: 'numeric', month: 'short'});

  return (
    <div className="hospital-overview dash">
      <PageHeader
        eyebrow={L('ΠΙΝΑΚΑΣ ΕΛΕΓΧΟΥ', 'DASHBOARD')}
        title={L('Επισκόπηση', 'Overview')}
        description={L(
          'Πού βρίσκεται ο εξοπλισμός, τι κινείται και τι χρειάζεται προσοχή.',
          'Where the equipment is, what is moving and what needs attention.',
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
              {L('Εγκρίνετε ή απορρίψτε από «Χρήστες & Τμήματα».', 'Approve or reject in “Users & departments”.')}
            </small>
          </span>
          <ArrowRight size={16} />
        </Link>
      )}

      <div className="dash-kpis">
        {kpis.map(k => (
          <Link key={k.label} to={k.to} className={`dash-kpi${k.warn ? ' warn' : ''}`}>
            <span className="dash-kpi-label">
              <k.icon size={15} />
              {k.label}
            </span>
            <strong>{k.value}</strong>
            {k.note && <small>{k.note}</small>}
          </Link>
        ))}
      </div>

      <div className="dash-grid">
        <section className="dash-card dash-flow">
          <header>
            <div>
              <b>{L('Ροή Αποστείρωσης', 'Sterilization flow')}</b>
              <small>{L('Πόσα βρίσκονται σε κάθε στάδιο τώρα.', 'How many are at each stage right now.')}</small>
            </div>
            <Activity size={18} />
          </header>
          <div className="dash-bars">
            {pipeline.map(p => (
              <Link
                key={p.state}
                className="dash-bar"
                to={`/sterilization?queue=${QUEUE_OF[p.state]}`}
                title={`${statusLabel(p.state)}: ${p.count}`}
              >
                <span className="dash-bar-name">{statusLabel(p.state)}</span>
                <span className="dash-bar-track">
                  <i style={{width: `${(p.count / pipelineMax) * 100}%`}} />
                </span>
                <strong>{p.count}</strong>
              </Link>
            ))}
          </div>
        </section>

        <section className="dash-card dash-where">
          <header>
            <div>
              <b>{L('Πού βρίσκεται ο εξοπλισμός', 'Where the equipment is')}</b>
              <small>{L('Σετ, μεμονωμένα εργαλεία και Απόθεμα.', 'Sets, standalone instruments and Stock.')}</small>
            </div>
            <Layers3 size={18} />
          </header>
          <div className="dash-stack" role="img" aria-label={location.map(x => `${x.label}: ${x.n}`).join(', ')}>
            {locationTotal === 0 ? (
              <i className="empty" />
            ) : (
              location
                .filter(x => x.n > 0)
                .map(x => (
                  <i key={x.key} className={`seg-${x.key}`} style={{flexGrow: x.n}} title={`${x.label}: ${x.n}`} />
                ))
            )}
          </div>
          <ul className="dash-legend">
            {location.map(x => (
              <li key={x.key}>
                <span className={`dot seg-${x.key}`} />
                <span>{x.label}</span>
                <strong>{x.n}</strong>
                <small>{locationTotal ? `${Math.round((x.n / locationTotal) * 100)}%` : '—'}</small>
              </li>
            ))}
          </ul>
        </section>

        <section className="dash-card dash-depts">
          <header>
            <div>
              <b>{L('Ανά τμήμα', 'By department')}</b>
              <small>
                {L('Σετ και μεμονωμένα εργαλεία κάθε τμήματος.', "Each department's Sets and standalone instruments.")}
              </small>
            </div>
          </header>
          <div className="dash-depts-list">
            {byDepartment.map(d => {
              const other = Math.max(0, d.total - d.atDepartment - d.inProcess - d.ready);
              return (
                <Link
                  key={d.id}
                  className="dash-dept"
                  to={`/overview/department?d=${encodeURIComponent(d.key)}`}
                  title={`${d.name}: ${d.total}`}
                >
                  <span className="dash-dept-name">{d.name}</span>
                  <span className="dash-dept-track">
                    <span className="dash-dept-fill" style={{width: `${(d.total / deptMax) * 100}%`}}>
                      <i className="seg-dept" style={{flexGrow: d.atDepartment}} />
                      <i className="seg-process" style={{flexGrow: d.inProcess}} />
                      <i className="seg-ready" style={{flexGrow: d.ready}} />
                      <i className="seg-other" style={{flexGrow: other}} />
                    </span>
                  </span>
                  <strong>{d.total}</strong>
                  <span
                    className={`dash-pill${d.issues ? ' bad' : ''}`}
                    title={L('Ανοικτές εκκρεμότητες', 'Open issues')}
                  >
                    {d.issues ? (
                      <>
                        <TriangleAlert size={12} /> {d.issues}
                      </>
                    ) : (
                      ''
                    )}
                  </span>
                </Link>
              );
            })}
            {byDepartment.length === 0 && (
              <p className="hospital-empty">{L('Δεν υπάρχουν τμήματα ακόμα.', 'No departments yet.')}</p>
            )}
          </div>
          <footer className="dash-legend-inline">
            <span>
              <span className="dot seg-dept" />
              {L('Στο τμήμα', 'At department')}
            </span>
            <span>
              <span className="dot seg-process" />
              {L('Αποστείρωση', 'Sterilization')}
            </span>
            <span>
              <span className="dot seg-ready" />
              {L('Έτοιμα', 'Ready')}
            </span>
            <span>
              <span className="dot seg-other" />
              {L('Άλλα', 'Other')}
            </span>
          </footer>
        </section>

        <section className="dash-card dash-activity">
          <header>
            <div>
              <b>{L('Κινήσεις 14 ημερών', 'Movements, last 14 days')}</b>
              <small>{L(`${perDayTotal} κινήσεις συνολικά`, `${perDayTotal} movements in total`)}</small>
            </div>
            <Link to="/movements">{L('Ιστορικό', 'History')}</Link>
          </header>
          <div
            className="dash-columns"
            role="img"
            aria-label={perDay.map(x => `${dayLabel(x.day)}: ${x.n}`).join(', ')}
          >
            {perDay.map(x => (
              <span key={x.day.getTime()} className="dash-col" title={`${dayLabel(x.day)}: ${x.n}`}>
                <i style={{height: `${(x.n / perDayMax) * 100}%`}} className={x.n ? '' : 'zero'} />
              </span>
            ))}
          </div>
          <div className="dash-axis">
            <span>{dayLabel(perDay[0].day)}</span>
            <span>{L(`έως ${perDayMax} την ημέρα`, `up to ${perDayMax} a day`)}</span>
            <span>{dayLabel(perDay[perDay.length - 1].day)}</span>
          </div>
        </section>

        <section className="dash-card dash-attention">
          <header>
            <div>
              <b>{L('Χρειάζεται προσοχή', 'Needs attention')}</b>
              <small>
                {L(
                  'Εκκρεμότητες και εργαλεία κοντά στο όριο χρήσεων.',
                  'Issues and instruments near their usage limit.',
                )}
              </small>
            </div>
            <Link to={presetPath('/issues', {status: 'OPEN'})}>{L('Όλες', 'All')}</Link>
          </header>
          <ul className="dash-list">
            {openIssues.slice(0, 5).map(i => (
              <li key={i.id}>
                <TriangleAlert size={15} className="bad" />
                <span>
                  <b>{i.asset}</b>
                  <small>
                    {trData(i.type)} · {trData(i.department)} · {i.created}
                  </small>
                </span>
              </li>
            ))}
            {lowStock.length > 0 && (
              <li>
                <Boxes size={15} className="warn" />
                <Link to="/stock?view=minimums">
                  <b>
                    {L(
                      `${lowStock.length} είδη κάτω από το ελάχιστο απόθεμα`,
                      `${lowStock.length} kinds below their minimum stock`,
                    )}
                  </b>
                  <small>
                    {lowStock
                      .slice(0, 3)
                      .map(r => r.name)
                      .join(' · ')}
                  </small>
                </Link>
              </li>
            )}
            {lifecycleAlerts.slice(0, 3).map(a => (
              <li key={a.id}>
                <Gauge size={15} className="warn" />
                <Link to={a.assetKind === 'SET' ? `/sets/${a.assetId}` : `/tools/${a.assetId}`}>
                  <b>
                    {a.barcode} · {a.name}
                  </b>
                  <small>{L(`απομένουν ${a.remaining} χρήσεις`, `${a.remaining} uses left`)}</small>
                </Link>
              </li>
            ))}
            {openIssues.length === 0 && lifecycleAlerts.length === 0 && lowStock.length === 0 && (
              <li className="ok">
                <PackageCheck size={15} />
                <span>{L('Όλα εντάξει: τίποτα δεν περιμένει.', 'All clear: nothing is waiting.')}</span>
              </li>
            )}
          </ul>
        </section>

        <section className="dash-card dash-latest">
          <header>
            <div>
              <b>{L('Τελευταίες κινήσεις', 'Latest movements')}</b>
              <small>
                {L(
                  'Οι πιο πρόσφατες ενέργειες σε Σετ και εργαλεία.',
                  'The most recent actions on Sets and instruments.',
                )}
              </small>
            </div>
            <Link to="/movements">{L('Όλο το ιστορικό', 'Full history')}</Link>
          </header>
          <ul className="dash-list">
            {latestMovements.slice(0, 6).map(m => (
              <li key={m.id}>
                <History size={15} />
                <span>
                  <b>{m.asset}</b>
                  <small>
                    {trData(m.status)} · {trData(m.from)} → {trData(m.to)} · {m.at}
                  </small>
                </span>
              </li>
            ))}
            {movements.length === 0 && (
              <li className="ok">
                <span>{L('Δεν υπάρχουν κινήσεις ακόμα.', 'No movements yet.')}</span>
              </li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
