import {useMemo} from 'react';
import {Link} from 'react-router-dom';
import {Gauge, Home, Layers3, Sparkles, Wrench} from 'lucide-react';
import {expiryAlerts, expiryStatus, formatExpiry, sterileExpiryList} from '../../core/sterileExpiry';
import {movementStamp} from '../../core/movementTime';
import {undoneIds} from '../../core/movementUndo';
import {presetPath} from '../../core/listMemory';
import PageHeader from '../../components/ui/PageHeader';
import {useSurgi} from '../../store/SurgiStore';
import {tr, trData} from '../../i18n';
import {isDispatch} from './departmentStatus';
import TodayBand from '../../components/layout/TodayBand';
import {statusLabel} from '../../components/ui/statusLabel';

/** Every state the department counts as «Σε αποστείρωση». */
const IN_STERILIZATION_STATES: string[] = [
  'PENDING_STERILIZATION',
  'IN_WASHING',
  'IN_PREPARATION',
  'IN_PACKAGING',
  'IN_STERILIZATION',
  'AWAITING_RELEASE',
  'IN_STORAGE',
];

const pathOf = (kind: 'SET' | 'TOOL', id: string) => (kind === 'SET' ? `/sets/${id}` : `/tools/${id}`);

/**
 * The department's home after signing in: each thing once. «Σήμερα» (the first thing to do, the open issues, the worn
 * ones, this week), then what the department has ready to use (with its expiry), where its equipment is in
 * Sterilization (stage by stage, what waits to be picked up first) and its most used Sets and instruments.
 */
export default function DepartmentHomePage() {
  const {sets, tools, issues, movements, lifecycleAlerts, currentUser} = useSurgi();
  const dept = currentUser.department;

  const departmentSets = useMemo(() => sets.filter(item => item.department === dept), [sets, dept]);
  const departmentTools = useMemo(() => tools.filter(item => item.department === dept), [tools, dept]);
  // Sets and standalone instruments move on their own; a Set's instruments travel with it.
  const tracked = useMemo(
    () => [
      ...departmentSets.map(a => ({...a, kind: 'SET' as const})),
      ...departmentTools.filter(t => t.mode === 'STANDALONE').map(a => ({...a, kind: 'TOOL' as const})),
    ],
    [departmentSets, departmentTools],
  );
  const openIssues = issues.filter(issue => issue.department === dept && issue.status === 'OPEN');
  const sterile = sterileExpiryList(departmentSets, departmentTools);
  const expiry = expiryAlerts(sterile);
  const expired = expiry.filter(e => e.state === 'EXPIRED').length;
  const ownIds = new Set([...departmentSets, ...departmentTools].map(a => a.id));
  const nearLimit = lifecycleAlerts.filter(a => ownIds.has(a.assetId));

  // When each Set or instrument last moved to where it is, by barcode: how long it has been at its stage. Only real
  // moves count (from one place to another, not undone): a record kept in place, such as a correction of its uses, is
  // not one.
  const lastMoved = useMemo(() => {
    const map = new Map<string, {at: string; stamp: number}>();
    // An undo and the move it cancelled are no move either.
    const undone = undoneIds(movements);
    for (const m of movements) {
      if (m.from === m.to || m.undoes || undone.has(m.id)) continue;
      const code = m.asset.split(' · ')[0].trim().toUpperCase();
      const stamp = movementStamp(m.at);
      if (stamp && stamp > (map.get(code)?.stamp ?? 0)) map.set(code, {at: m.at, stamp});
    }
    return map;
  }, [movements]);

  // Ready to use: in the department, the soonest expiry first (expired ones on top).
  const available = tracked
    .filter(a => a.state === 'IN_DEPARTMENT')
    .map(a => ({a, status: a.sterileUntil ? expiryStatus(a.sterileUntil, a.shelfLifeMonths) : undefined}))
    .sort((x, y) => (x.status?.daysLeft ?? Infinity) - (y.status?.daysLeft ?? Infinity));
  // Away in Sterilization: what waits to be picked up first, then by stage, the longest there first.
  const away = tracked
    .filter(a => a.state === 'READY_FOR_PICKUP' || IN_STERILIZATION_STATES.includes(a.state))
    .map(a => ({a, moved: lastMoved.get(a.barcode.toUpperCase())}))
    .sort(
      (x, y) =>
        Number(y.a.state === 'READY_FOR_PICKUP') - Number(x.a.state === 'READY_FOR_PICKUP') ||
        IN_STERILIZATION_STATES.indexOf(y.a.state) - IN_STERILIZATION_STATES.indexOf(x.a.state) ||
        (x.moved?.stamp ?? 0) - (y.moved?.stamp ?? 0),
    );
  const ready = away.filter(x => x.a.state === 'READY_FOR_PICKUP');

  // Uses: the worn ones first (with the uses they have left), then the most used Sets and instruments (in a Set or on
  // their own), the busiest first.
  const leftOf = new Map(nearLimit.map(a => [a.assetId, a.remaining]));
  const mostUsed = [
    ...departmentSets.map(s => ({id: s.id, kind: 'SET' as const, barcode: s.barcode, name: s.name, uses: s.uses || 0})),
    ...departmentTools.map(t => ({
      id: t.id,
      kind: 'TOOL' as const,
      barcode: t.barcode,
      name: t.name,
      uses: t.uses || 0,
    })),
  ]
    .filter(a => a.uses > 0 || leftOf.has(a.id))
    .sort((a, b) => Number(leftOf.has(b.id)) - Number(leftOf.has(a.id)) || b.uses - a.uses)
    .slice(0, Math.max(10, leftOf.size));
  const mostUsedMax = Math.max(1, ...mostUsed.map(a => a.uses));

  // «Σήμερα»: what the columns below do not count — the open issues and what expires soon; the first thing to do.
  const issuesPath = presetPath('/issues', {status: 'OPEN', department: dept});
  const counts = [
    {n: openIssues.length, label: tr('Εκκρεμότητες'), to: issuesPath},
    {n: expiry.length, label: tr('Λήγουν σύντομα'), to: '/expiry'},
  ];
  const next = ready.length
    ? {
        title: tr('{0} έτοιμα για παραλαβή από την Αποστείρωση', ready.length),
        // Sets first; only instruments ready opens the instruments' list (the Sets' one would be empty).
        to: presetPath(ready.some(x => x.a.kind === 'SET') ? '/department' : '/department/tools', {
          statusFilter: 'READY',
        }),
      }
    : expiry.length
      ? {
          title: expired
            ? tr('{0} έληξαν · {1} λήγουν σύντομα', expired, expiry.length - expired)
            : tr('{0} λήγουν σύντομα', expiry.length),
          to: '/expiry',
        }
      : openIssues.length
        ? {title: tr('{0} ανοιχτές εκκρεμότητες', openIssues.length), to: issuesPath}
        : nearLimit.length
          ? {
              title: tr('{0} κοντά στο όριο χρήσεων', nearLimit.length),
              to: pathOf(nearLimit[0].assetKind === 'SET' ? 'SET' : 'TOOL', nearLimit[0].assetId),
            }
          : undefined;
  const weekEvents = useMemo(
    () => movements.filter(m => isDispatch(m, dept) || m.to === dept).map(m => m.at),
    [movements, dept],
  );
  const kindIcon = (kind: 'SET' | 'TOOL') =>
    kind === 'SET' ? <Layers3 size={15} aria-hidden="true" /> : <Wrench size={15} aria-hidden="true" />;

  return (
    <div className="department-home dash">
      <PageHeader eyebrow={tr('Αρχική τμήματος')} title={trData(dept)} />

      <TodayBand
        counts={counts}
        next={next}
        events={weekEvents}
        eventsLabel={n => tr('{0} κινήσεις', n)}
        expiries={sterile}
      />

      <div className="dash-grid">
        <section className="dash-card dash-available">
          <header>
            <div>
              <b>
                {tr('Διαθέσιμα στο τμήμα')} <em className="dash-count">{available.length}</em>
              </b>
              <small>{tr('Έτοιμα για χρήση, πρώτα όσα λήγουν νωρίτερα.')}</small>
            </div>
            <Home size={18} />
          </header>
          <ul className="dash-list dash-items" tabIndex={0} aria-label={tr('Διαθέσιμα στο τμήμα')}>
            {available.map(({a, status}) => (
              <li key={a.id}>
                {kindIcon(a.kind)}
                <Link to={pathOf(a.kind, a.id)}>
                  <b>{a.name}</b>
                  <small>{a.barcode}</small>
                </Link>
                <span
                  className={`dash-item-note${status && status.state !== 'OK' ? ` ${status.state.toLowerCase()}` : ''}`}
                >
                  {!a.sterileUntil
                    ? '—'
                    : status?.state === 'EXPIRED'
                      ? tr('Έληξε')
                      : tr('έως {0}', formatExpiry(a.sterileUntil))}
                </span>
              </li>
            ))}
            {available.length === 0 && (
              <li className="ok">
                <span>{tr('Τίποτα στο τμήμα αυτή τη στιγμή.')}</span>
              </li>
            )}
          </ul>
        </section>

        <section className="dash-card dash-away">
          <header>
            <div>
              <b>
                {tr('Στην Αποστείρωση')} <em className="dash-count">{away.length}</em>
              </b>
              <small>{tr('Πού βρίσκεται το καθένα· πρώτα όσα περιμένουν παραλαβή.')}</small>
            </div>
            <Sparkles size={18} />
          </header>
          <ul className="dash-list dash-items" tabIndex={0} aria-label={tr('Στην Αποστείρωση')}>
            {away.map(({a, moved}) => (
              <li key={a.id}>
                {kindIcon(a.kind)}
                <Link to={pathOf(a.kind, a.id)}>
                  <b>{a.name}</b>
                  <small>
                    {a.barcode}
                    {moved && ` · ${tr('από {0}', moved.at)}`}
                  </small>
                </Link>
                <span className={`dash-item-note${a.state === 'READY_FOR_PICKUP' ? ' ready' : ''}`}>
                  {statusLabel(a.state)}
                </span>
              </li>
            ))}
            {away.length === 0 && (
              <li className="ok">
                <span>{tr('Τίποτα στην Αποστείρωση.')}</span>
              </li>
            )}
          </ul>
        </section>

        <section className="dash-card dash-most-used">
          <header>
            <div>
              <b>{tr('Χρήσεις')}</b>
              <small>{tr('Πρώτα όσα πλησιάζουν το όριο χρήσεων, μετά τα πιο πολυχρησιμοποιημένα.')}</small>
            </div>
            <Gauge size={18} />
          </header>
          <ul className="dash-list dash-used" tabIndex={0} aria-label={tr('Χρήσεις')}>
            {mostUsed.map(a => (
              <li key={a.id}>
                {a.kind === 'SET' ? <Layers3 size={15} aria-hidden="true" /> : <Wrench size={15} aria-hidden="true" />}
                <Link to={a.kind === 'SET' ? `/sets/${a.id}` : `/tools/${a.id}`} title={`${a.name}: ${a.uses}`}>
                  <b>{a.name}</b>
                  <small>
                    {a.barcode}
                    {leftOf.has(a.id) && (
                      <span className="dash-item-note expiring">
                        {' '}
                        · {tr('απομένουν {0} χρήσεις', leftOf.get(a.id))}
                      </span>
                    )}
                  </small>
                  <span className="dash-used-track" aria-hidden="true">
                    <i style={{width: `${(a.uses / mostUsedMax) * 100}%`}} />
                  </span>
                </Link>
                <strong>{a.uses}</strong>
              </li>
            ))}
            {mostUsed.length === 0 && (
              <li className="ok">
                <span>{tr('Καμία χρήση ακόμα.')}</span>
              </li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
