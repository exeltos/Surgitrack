import {useEffect, useMemo, useState} from 'react';
import {Link} from 'react-router-dom';
import {Activity, ArrowRight, History, Layers3, PackageCheck, TriangleAlert} from 'lucide-react';
import {expiryAlerts, formatExpiry, sterileExpiryList} from '../../core/sterileExpiry';
import PageHeader from '../../components/ui/PageHeader';
import {useSurgi} from '../../store/SurgiStore';
import {workflowStageState} from '../../core/workflow';
import {useLibraries} from '../../core/LibraryStore';
import {useAppPreferences} from '../../core/AppPreferences';
import {demoDepartments} from '../../config/demoRoles';
import {ACCESS_REQUESTS_CHANGED, countPendingAccessRequests, managedHospitalId} from '../../data/cloud/accessRequests';
import type {AssetState} from '../../types/domain';
import {trData} from '../../i18n';
import {presetPath} from '../../core/listMemory';
import {belowMinimum, minimumRows} from '../../core/stockMinimums';
import {useHasModule} from '../../data/cloud/modulesContext';
import {movementStamp} from '../../core/movementTime';
import {movementText} from '../../core/movementText';
import PromoCards from '../../components/layout/PromoCards';

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

/**
 * The hospital admin's home: the whole hospital at a glance — where the sets and instruments
 * are, what each department holds, what is stuck, and the latest movements.
 */
const DEPARTMENTS_SHOWN = 8;

export default function HospitalOverviewPage() {
  const {sets, tools, retiredTools, issues, movements, lifecycleAlerts, purchaseOrders, processLoads} = useSurgi();
  // An issue or a movement names its Set or instrument as «barcode · name»: its row opens that card.
  const assetPath = (label: string) => {
    const barcode = label.split(' · ')[0].trim().toUpperCase();
    const known = (item: {barcode: string; legacyBarcodes?: string[]}) =>
      item.barcode.toUpperCase() === barcode || !!item.legacyBarcodes?.some(code => code.toUpperCase() === barcode);
    const set = sets.find(known);
    if (set) return `/sets/${set.id}`;
    // A retired instrument has no card to open: its row keeps the list it came from.
    const tool = tools.find(known);
    return tool ? `/tools/${tool.id}` : undefined;
  };
  const {departments, systemSettings, sterilizationWorkflow} = useLibraries();
  const {lang} = useAppPreferences();
  const L = (el: string, en: string) => (lang === 'el' ? el : en);
  const hospitalId = managedHospitalId();
  const [pendingAccess, setPendingAccess] = useState(0);
  // The busiest departments first; the rest behind «+N ακόμη», so the card shows whole rows.
  const [allDepartments, setAllDepartments] = useState(false);

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
  // Kinds below their minimum stock (a module the platform owner gives a hospital).
  const withMinimums = useHasModule('STOCK_MINIMUMS');
  const lowStock = useMemo(
    () =>
      withMinimums
        ? belowMinimum(minimumRows([...tools, ...retiredTools], purchaseOrders, systemSettings.stockMinimums))
        : [],
    [withMinimums, tools, retiredTools, purchaseOrders, systemSettings.stockMinimums],
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
        // A department with no equipment (supplies, biomedical) only takes a row.
        .filter(d => d.total > 0)
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
  // Only the stages this hospital runs (Studio › Sterilization Flow); the sterilizer stage shows what waits
  // to be loaded and what is in the sterilizer now.
  const inSterilizer = new Set(
    processLoads
      .filter(load => load.kind === 'STERILIZATION' && load.status === 'OPEN')
      .flatMap(load => load.items.map(item => item.assetId)),
  );
  const pipeline = sterilizationWorkflow.stages
    .filter(stage => stage.id !== 'DELIVERY')
    .flatMap((stage): Array<{key: string; label: string; queue?: string; count: number}> => {
      const state = workflowStageState[stage.id] as AssetState;
      const here = tracked.filter(a => a.state === state);
      if (!stage.enabled && !here.length) return [];
      if (stage.id !== 'STERILIZATION')
        return [{key: stage.id, label: L(stage.labelEl, stage.labelEn), queue: QUEUE_OF[state], count: here.length}];
      const running = here.filter(a => inSterilizer.has(a.id)).length;
      return [
        {
          key: 'PROCESS',
          label: L(stage.labelEl, stage.labelEn),
          queue: 'PROCESS',
          count: here.length - running,
        },
        {key: 'IN_STERILIZER', label: L('Στον κλίβανο', 'In the sterilizer'), queue: 'IN_STERILIZER', count: running},
      ];
    });
  const pipelineMax = Math.max(1, ...pipeline.map(p => p.count));

  const shortSets = sets.filter(x => x.actual < x.expected).length;
  const expiry = expiryAlerts(sterileExpiryList(sets, tools));
  const expired = expiry.filter(e => e.state === 'EXPIRED').length;
  // What waits for action, most urgent first (the red ones, then the amber): one row per kind, with the count and a
  // few examples, opening the list that holds them.
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
  const triage: Array<{key: string; tone: 'bad' | 'warn'; count: number; title: string; note?: string; to: string}> =
    [];
  if (expiry.length > 0)
    triage.push({
      key: 'expiry',
      tone: expired ? 'bad' : 'warn',
      count: expiry.length,
      title: expired
        ? L(
            `${expired} έληξαν · ${expiry.length - expired} λήγουν σύντομα`,
            `${expired} expired · ${expiry.length - expired} expiring soon`,
          )
        : L(`${expiry.length} λήγουν σύντομα`, `${expiry.length} expiring soon`),
      note: expiry
        .slice(0, 2)
        .map(e => `${e.barcode} (${formatExpiry(e.sterileUntil).slice(0, 5)})`)
        .join(' · '),
      to: '/expiry',
    });
  if (openIssues.length > 0)
    triage.push({
      key: 'issues',
      tone: 'bad',
      count: openIssues.length,
      title: L(
        `${openIssues.length} ${plural(openIssues.length, 'ανοιχτή εκκρεμότητα', 'ανοιχτές εκκρεμότητες')}`,
        `${openIssues.length} open ${plural(openIssues.length, 'issue', 'issues')}`,
      ),
      note: openIssues
        .slice(0, 2)
        .map(i => `${i.asset.split(' · ')[0]} · ${trData(i.type)}`)
        .join(' · '),
      to: presetPath('/issues', {status: 'OPEN'}),
    });
  if (shortSets > 0)
    triage.push({
      key: 'short',
      tone: 'warn',
      count: shortSets,
      title: L(`${shortSets} Σετ με έλλειψη`, `${shortSets} ${plural(shortSets, 'Set', 'Sets')} incomplete`),
      note: sets
        .filter(x => x.actual < x.expected)
        .slice(0, 3)
        .map(x => x.barcode)
        .join(' · '),
      to: presetPath('/sets', {completeness: 'SHORT'}),
    });
  if (lowStock.length > 0)
    triage.push({
      key: 'stock',
      tone: 'warn',
      count: lowStock.length,
      title: L(
        `${lowStock.length} είδη κάτω από το ελάχιστο απόθεμα`,
        `${lowStock.length} kinds below their minimum stock`,
      ),
      note: lowStock
        .slice(0, 3)
        .map(r => r.name)
        .join(' · '),
      to: '/stock?view=minimums',
    });
  // Usage alerts hold Sets and instruments, with a few uses left or none: each kind opens the list that holds exactly
  // those (an instrument with none left is not in «few left», and a Set is not in the instrument list).
  const usageRows = [
    {kind: 'TOOL', none: true, to: presetPath('/tools', {usage: 'EXHAUSTED'})},
    {kind: 'SET', none: true, to: presetPath('/sets', {usage: 'EXHAUSTED'})},
    {kind: 'TOOL', none: false, to: presetPath('/tools', {usage: 'LOW'})},
    {kind: 'SET', none: false, to: presetPath('/sets', {usage: 'LOW'})},
  ] as const;
  for (const row of usageRows) {
    const group = lifecycleAlerts.filter(a => a.assetKind === row.kind && (a.remaining === 0) === row.none);
    if (group.length === 0) continue;
    const tool = row.kind === 'TOOL';
    triage.push({
      key: `limit-${row.kind}-${row.none}`,
      tone: row.none ? 'bad' : 'warn',
      count: group.length,
      title: row.none
        ? L(
            `${group.length} ${tool ? plural(group.length, 'εργαλείο', 'εργαλεία') : plural(group.length, 'Σετ', 'Σετ')} με εξαντλημένες χρήσεις`,
            `${group.length} ${tool ? plural(group.length, 'instrument', 'instruments') : plural(group.length, 'Set', 'Sets')} out of uses`,
          )
        : L(
            `${group.length} ${tool ? plural(group.length, 'εργαλείο', 'εργαλεία') : 'Σετ'} κοντά στο όριο χρήσεων`,
            `${group.length} ${tool ? plural(group.length, 'instrument', 'instruments') : plural(group.length, 'Set', 'Sets')} near the usage limit`,
          ),
      note: group
        .slice(0, 2)
        .map(a => (row.none ? a.barcode : `${a.barcode} · ${L(`απομένουν ${a.remaining}`, `${a.remaining} left`)}`))
        .join(' · '),
      to: row.to,
    });
  }
  triage.sort((a, b) => Number(b.tone === 'bad') - Number(a.tone === 'bad'));
  // People waiting to be let in come first: nobody else can do it for them.
  if (pendingAccess > 0)
    triage.unshift({
      key: 'access',
      tone: 'warn',
      count: pendingAccess,
      title: L(
        `${pendingAccess} ${pendingAccess === 1 ? 'αίτημα πρόσβασης περιμένει' : 'αιτήματα πρόσβασης περιμένουν'} έγκριση`,
        `${pendingAccess} access ${pendingAccess === 1 ? 'request is' : 'requests are'} awaiting approval`,
      ),
      note: L('Χρήστες & Τμήματα', 'Users & departments'),
      to: '/hospital',
    });

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
      />

      <PromoCards />

      <div className="dash-grid">
        <section className="dash-card dash-attention">
          <header>
            <div>
              <b>{L('Χρειάζεται προσοχή', 'Needs attention')}</b>
              <small>
                {L('Ό,τι περιμένει δράση, με σειρά σημασίας.', 'What is waiting for action, most urgent first.')}
              </small>
            </div>
          </header>
          <ul className="dash-list dash-triage" tabIndex={0} aria-label={L('Χρειάζεται προσοχή', 'Needs attention')}>
            {triage.map(item => (
              <li key={item.key} className={item.tone}>
                <Link to={item.to}>
                  <i aria-hidden="true" />
                  <span>
                    <b>{item.title}</b>
                    {item.note && <small>{item.note}</small>}
                  </span>
                  <em>{item.count}</em>
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </li>
            ))}
            {triage.length === 0 && (
              <li className="ok">
                <PackageCheck size={15} />
                <span>{L('Όλα εντάξει: τίποτα δεν περιμένει.', 'All clear: nothing is waiting.')}</span>
              </li>
            )}
          </ul>
        </section>

        <section className="dash-card dash-flow">
          <header>
            <div>
              <b>{L('Ροή Αποστείρωσης', 'Sterilization flow')}</b>
              <small>{L('Πόσα βρίσκονται σε κάθε στάδιο τώρα.', 'How many are at each stage right now.')}</small>
            </div>
            <Activity size={18} />
          </header>
          <div className="dash-bars" tabIndex={0} aria-label={L('Ροή Αποστείρωσης', 'Sterilization flow')}>
            {pipeline.map(p => (
              <Link
                key={p.key}
                className="dash-bar"
                to={`/sterilization?queue=${p.queue}`}
                title={`${p.label}: ${p.count}`}
              >
                {/* The short form fits the card; the full name is in the tooltip. */}
                <span className="dash-bar-name">{p.label}</span>
                <span className="dash-bar-track">
                  <i style={{width: `${(p.count / pipelineMax) * 100}%`}} />
                </span>
                <strong>{p.count}</strong>
              </Link>
            ))}
          </div>
        </section>

        <section className="dash-card dash-equipment">
          <header>
            <div>
              <b>{L('Εξοπλισμός', 'Equipment')}</b>
              <small>
                {L(
                  `${sets.length} Σετ · ${tools.length} εργαλεία (${stockTools.length} στο Απόθεμα)`,
                  `${sets.length} Sets · ${tools.length} instruments (${stockTools.length} in Stock)`,
                )}
              </small>
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
          {/* The legend of the bar is also the legend of the departments below: the same colours. */}
          <ul className="dash-legend-row" aria-label={L('Πού βρίσκεται ο εξοπλισμός', 'Where the equipment is')}>
            {location.map(x => (
              <li key={x.key}>
                <span className={`dot seg-${x.key}`} />
                {x.label} <strong>{x.n}</strong>
              </li>
            ))}
          </ul>
          <div className="dash-depts-list" tabIndex={0} aria-label={L('Ανά τμήμα', 'By department')}>
            {(allDepartments ? byDepartment : byDepartment.slice(0, DEPARTMENTS_SHOWN)).map(d => {
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
                      <i className="seg-lost" style={{flexGrow: other}} />
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
            {byDepartment.length > DEPARTMENTS_SHOWN && (
              <button type="button" className="dash-more" onClick={() => setAllDepartments(v => !v)}>
                {allDepartments
                  ? L('Λιγότερα', 'Fewer')
                  : L(
                      `+${byDepartment.length - DEPARTMENTS_SHOWN} ακόμη`,
                      `+${byDepartment.length - DEPARTMENTS_SHOWN} more`,
                    )}
              </button>
            )}
            {byDepartment.length === 0 && (
              <p className="hospital-empty">{L('Δεν υπάρχουν τμήματα ακόμα.', 'No departments yet.')}</p>
            )}
          </div>
        </section>

        <section className="dash-card dash-activity">
          <header>
            <div>
              <b>{L('Δραστηριότητα', 'Activity')}</b>
              <small>{L('Κινήσεις των τελευταίων 14 ημερών.', 'Movements of the last 14 days.')}</small>
            </div>
            <Link to="/movements">{L('Όλο το ιστορικό', 'Full history')}</Link>
          </header>
          <div className="dash-activity-stats">
            {[
              [L('Σήμερα', 'Today'), perDay[perDay.length - 1].n],
              [L('7 ημέρες', '7 days'), perDay.slice(-7).reduce((sum, x) => sum + x.n, 0)],
              [L('14 ημέρες', '14 days'), perDayTotal],
            ].map(([label, n]) => (
              <Link key={String(label)} to="/movements">
                <b>{n}</b>
                <small>{label}</small>
              </Link>
            ))}
          </div>
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
            <span>{dayLabel(perDay[perDay.length - 1].day)}</span>
          </div>
          <ul className="dash-list" tabIndex={0} aria-label={L('Τελευταίες κινήσεις', 'Latest movements')}>
            {latestMovements.slice(0, 4).map(m => (
              <li key={m.id}>
                <History size={15} />
                <Link to={assetPath(m.asset) || '/movements'}>
                  <b>{m.asset}</b>
                  <small>
                    {movementText(m.status)} · {trData(m.from)} → {trData(m.to)} · {m.at}
                  </small>
                </Link>
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
