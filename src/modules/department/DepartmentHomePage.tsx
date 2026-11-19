import {useMemo} from 'react';
import {Link} from 'react-router-dom';
import {CalendarClock, Gauge, Layers3, PackageCheck, TriangleAlert, Wrench} from 'lucide-react';
import {expiryAlerts, formatExpiry, sterileExpiryList} from '../../core/sterileExpiry';
import {movementStamp} from '../../core/movementTime';
import {presetPath} from '../../core/listMemory';
import PageHeader from '../../components/ui/PageHeader';
import {useSurgi} from '../../store/SurgiStore';
import {tr, trData} from '../../i18n';
import {isDispatch, statusCard} from './departmentStatus';
import TodayBand from '../../components/layout/TodayBand';
import {movementText} from '../../core/movementText';

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

/**
 * The department's home after signing in: only what a department acts on — today («Σήμερα»: what is here, what is
 * away, what waits to be picked up, the first thing to do and this week), what needs attention and the latest
 * movements.
 */
export default function DepartmentHomePage() {
  const {sets, tools, issues, movements, lifecycleAlerts, currentUser} = useSurgi();
  const dept = currentUser.department;

  const departmentSets = useMemo(() => sets.filter(item => item.department === dept), [sets, dept]);
  const departmentTools = useMemo(() => tools.filter(item => item.department === dept), [tools, dept]);
  const standalone = departmentTools.filter(item => item.mode === 'STANDALONE');
  // Sets and standalone instruments move on their own; a Set's instruments travel with it.
  const tracked = [...departmentSets, ...standalone];
  const ready = tracked.filter(a => a.state === 'READY_FOR_PICKUP');
  const byStatus = (statusFilter: string, match: (state: string) => boolean) =>
    statusCard(departmentSets, standalone, statusFilter, match);
  const atDepartment = byStatus('IN_DEPARTMENT', state => state === 'IN_DEPARTMENT');
  const inSterilization = byStatus('STERILIZATION', state => IN_STERILIZATION_STATES.includes(state));
  const readyStatus = byStatus('READY', state => state === 'READY_FOR_PICKUP');
  const openIssues = issues.filter(issue => issue.department === dept && issue.status === 'OPEN');
  const sterile = sterileExpiryList(departmentSets, departmentTools);
  const expiry = expiryAlerts(sterile);
  const expired = expiry.filter(e => e.state === 'EXPIRED').length;
  const ownIds = new Set([...departmentSets, ...departmentTools].map(a => a.id));
  const nearLimit = lifecycleAlerts.filter(a => ownIds.has(a.assetId));

  // An issue or a movement names its Set or instrument as «barcode · name»: its row opens that card.
  const byBarcode = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of departmentSets) map.set(s.barcode.toUpperCase(), `/sets/${s.id}`);
    for (const t of departmentTools) map.set(t.barcode.toUpperCase(), `/tools/${t.id}`);
    return map;
  }, [departmentSets, departmentTools]);
  const assetPath = (label: string) => byBarcode.get(label.split(' · ')[0].trim().toUpperCase());

  const latestMovements = useMemo(
    () =>
      movements
        .filter(m => byBarcode.has(m.asset.split(' · ')[0].trim().toUpperCase()) || m.from === dept || m.to === dept)
        .map((m, index) => ({m, index, stamp: movementStamp(m.at)}))
        .sort((a, b) => b.stamp - a.stamp || a.index - b.index)
        .slice(0, 15)
        .map(x => x.m),
    [movements, byBarcode, dept],
  );

  // The most used Sets and instruments (in a Set or on their own), the busiest first.
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
    .filter(a => a.uses > 0)
    .sort((a, b) => b.uses - a.uses)
    .slice(0, 10);
  const mostUsedMax = Math.max(1, ...mostUsed.map(a => a.uses));

  // Today, for the band at the top: what is here, what is away, what waits to be picked up, what is open.
  const issuesPath = presetPath('/issues', {status: 'OPEN', department: dept});
  const counts = [
    {n: atDepartment.value, label: tr('Στο τμήμα'), to: atDepartment.to},
    {n: inSterilization.value, label: tr('Σε αποστείρωση'), to: inSterilization.to},
    {n: readyStatus.value, label: tr('Για παραλαβή'), to: readyStatus.to},
    {n: openIssues.length, label: tr('Εκκρεμότητες'), to: issuesPath},
  ];
  // The first thing to do: pick up what is ready, then what expires, then the issues, then the worn ones.
  const next = ready.length
    ? {title: tr('{0} έτοιμα για παραλαβή από την Αποστείρωση', ready.length), to: readyStatus.to}
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
          ? {title: tr('{0} κοντά στο όριο χρήσεων', nearLimit.length), to: presetPath('/department/tools')}
          : undefined;
  const weekEvents = useMemo(
    () => movements.filter(m => isDispatch(m, dept) || m.to === dept).map(m => m.at),
    [movements, dept],
  );
  const allClear = !ready.length && !expiry.length && !openIssues.length && !nearLimit.length;

  return (
    <div className="department-home dash">
      <PageHeader
        eyebrow={tr('Αρχική τμήματος')}
        title={trData(dept)}
        description={tr('Ο εξοπλισμός του τμήματος με μια ματιά: τι είναι πού και τι περιμένει.')}
      />

      <TodayBand
        counts={counts}
        next={next}
        events={weekEvents}
        eventsLabel={n => tr('{0} κινήσεις', n)}
        expiries={sterile}
      />

      <div className="dash-grid">
        <section className="dash-card dash-attention">
          <header>
            <div>
              <b>{tr('Χρειάζεται προσοχή')}</b>
              <small>{tr('Ό,τι περιμένει το τμήμα τώρα.')}</small>
            </div>
            <TriangleAlert size={18} />
          </header>
          <ul className="dash-list" tabIndex={0} aria-label={tr('Χρειάζεται προσοχή')}>
            {ready.length > 0 && (
              <li>
                <PackageCheck size={15} className="warn" />
                <Link to={readyStatus.to}>
                  <b>{tr('{0} έτοιμα για παραλαβή από την Αποστείρωση', ready.length)}</b>
                  <small>
                    {ready
                      .slice(0, 3)
                      .map(a => `${a.barcode} · ${a.name}`)
                      .join(' · ')}
                  </small>
                </Link>
              </li>
            )}
            {expiry.length > 0 && (
              <li>
                <CalendarClock size={15} className={expired ? 'bad' : 'warn'} />
                <Link to="/expiry">
                  <b>
                    {expired
                      ? tr('{0} έληξαν · {1} λήγουν σύντομα', expired, expiry.length - expired)
                      : tr('{0} λήγουν σύντομα', expiry.length)}
                  </b>
                  <small>
                    {expiry
                      .slice(0, 3)
                      .map(e => `${e.barcode} · ${formatExpiry(e.sterileUntil)}`)
                      .join(' · ')}
                  </small>
                </Link>
              </li>
            )}
            {openIssues.slice(0, 5).map(i => (
              <li key={i.id}>
                <TriangleAlert size={15} className="bad" />
                <Link to={assetPath(i.asset) || issuesPath}>
                  <b>{i.asset}</b>
                  <small>
                    {trData(i.type)} · {i.created}
                  </small>
                </Link>
              </li>
            ))}
            {nearLimit.slice(0, 3).map(a => (
              <li key={a.id}>
                <Gauge size={15} className="warn" />
                <Link to={a.assetKind === 'SET' ? `/sets/${a.assetId}` : `/tools/${a.assetId}`}>
                  <b>
                    {a.barcode} · {a.name}
                  </b>
                  <small>{tr('απομένουν {0} χρήσεις', a.remaining)}</small>
                </Link>
              </li>
            ))}
            {allClear && (
              <li className="ok">
                <PackageCheck size={15} />
                <span>{tr('Όλα εντάξει: τίποτα δεν περιμένει.')}</span>
              </li>
            )}
          </ul>
        </section>

        <section className="dash-card dash-latest">
          <header>
            <div>
              <b>{tr('Τελευταίες κινήσεις')}</b>
              <small>{tr('Οι πιο πρόσφατες κινήσεις των Σετ και εργαλείων του τμήματος.')}</small>
            </div>
            <Link to="/movements">{tr('Όλο το ιστορικό')}</Link>
          </header>
          <ul className="dash-list" tabIndex={0} aria-label={tr('Τελευταίες κινήσεις')}>
            {latestMovements.map(m => (
              <li key={m.id} className="dash-movement">
                <Link to={assetPath(m.asset) || '/movements'}>
                  <b>{m.asset}</b>
                  <small>
                    {movementText(m.status)} · {m.at}
                  </small>
                  <small>
                    {trData(m.from)} → {trData(m.to)}
                  </small>
                </Link>
              </li>
            ))}
            {latestMovements.length === 0 && (
              <li className="ok">
                <span>{tr('Δεν υπάρχουν κινήσεις ακόμα.')}</span>
              </li>
            )}
          </ul>
        </section>
        <section className="dash-card dash-most-used">
          <header>
            <div>
              <b>{tr('Πιο πολυχρησιμοποιημένα')}</b>
              <small>{tr('Τα Σετ και τα εργαλεία του τμήματος με τις περισσότερες χρήσεις.')}</small>
            </div>
            <Gauge size={18} />
          </header>
          <ul className="dash-list dash-used" tabIndex={0} aria-label={tr('Πιο πολυχρησιμοποιημένα')}>
            {mostUsed.map(a => (
              <li key={a.id}>
                {a.kind === 'SET' ? <Layers3 size={15} aria-hidden="true" /> : <Wrench size={15} aria-hidden="true" />}
                <Link to={a.kind === 'SET' ? `/sets/${a.id}` : `/tools/${a.id}`} title={`${a.name}: ${a.uses}`}>
                  <b>{a.name}</b>
                  <small>{a.barcode}</small>
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
