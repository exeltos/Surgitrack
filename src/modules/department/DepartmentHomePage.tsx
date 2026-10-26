import {useMemo} from 'react';
import {Link} from 'react-router-dom';
import {
  CalendarClock,
  Gauge,
  History,
  Home,
  Layers3,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Wrench,
} from 'lucide-react';
import {expiryAlerts, formatExpiry, sterileExpiryList} from '../../core/sterileExpiry';
import {movementStamp} from '../../core/movementTime';
import {presetPath} from '../../core/listMemory';
import PageHeader from '../../components/ui/PageHeader';
import {useSurgi} from '../../store/SurgiStore';
import {tr, trData} from '../../i18n';

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
 * The department's home after signing in: its Sets and standalone instruments at a glance — where they
 * are, what is waiting to be picked up, what expires, its open issues and its latest movements.
 */
export default function DepartmentHomePage() {
  const {sets, tools, issues, movements, lifecycleAlerts, currentUser} = useSurgi();
  const dept = currentUser.department;

  const departmentSets = useMemo(() => sets.filter(item => item.department === dept), [sets, dept]);
  const departmentTools = useMemo(() => tools.filter(item => item.department === dept), [tools, dept]);
  const standalone = departmentTools.filter(item => item.mode === 'STANDALONE');
  // Sets and standalone instruments move on their own; a Set's instruments travel with it.
  const tracked = [...departmentSets, ...standalone];
  const atDepartment = tracked.filter(a => a.state === 'IN_DEPARTMENT').length;
  const inSterilization = tracked.filter(a => IN_STERILIZATION_STATES.includes(a.state)).length;
  const ready = tracked.filter(a => a.state === 'READY_FOR_PICKUP');
  const openIssues = issues.filter(issue => issue.department === dept && issue.status === 'OPEN');
  const expiry = expiryAlerts(sterileExpiryList(departmentSets, departmentTools));
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
        .slice(0, 6)
        .map(x => x.m),
    [movements, byBarcode, dept],
  );

  const kpis = [
    {
      icon: Layers3,
      label: tr('Σετ'),
      value: departmentSets.length,
      to: presetPath('/department'),
    },
    {
      icon: Wrench,
      label: tr('Μεμονωμένα'),
      value: standalone.length,
      to: presetPath('/department/tools'),
    },
    {
      icon: Home,
      label: tr('Στο τμήμα'),
      value: atDepartment,
      to: presetPath('/department', {statusFilter: 'IN_DEPARTMENT'}),
    },
    {
      icon: Sparkles,
      label: tr('Σε αποστείρωση'),
      value: inSterilization,
      to: presetPath('/department', {statusFilter: 'STERILIZATION'}),
    },
    {
      icon: PackageCheck,
      label: tr('Για παραλαβή'),
      value: ready.length,
      to: presetPath('/department', {statusFilter: 'READY'}),
      warn: ready.length > 0,
    },
    {
      icon: TriangleAlert,
      label: tr('Εκκρεμότητες'),
      value: openIssues.length,
      to: presetPath('/issues', {status: 'OPEN', department: dept}),
      warn: openIssues.length > 0,
    },
  ];
  const allClear = !ready.length && !expiry.length && !openIssues.length && !nearLimit.length;

  return (
    <div className="department-home dash">
      <PageHeader
        eyebrow={tr('ΑΡΧΙΚΗ ΤΜΗΜΑΤΟΣ')}
        title={trData(dept)}
        description={tr('Ο εξοπλισμός του τμήματος με μια ματιά: τι είναι πού και τι περιμένει.')}
        actions={
          <div className="department-user-sign">
            <ShieldCheck size={18} />
            <span>{tr('Συνδεδεμένος χρήστης')}</span>
            <strong>{trData(currentUser.name)}</strong>
          </div>
        }
      />

      <div className="dash-kpis">
        {kpis.map(k => (
          <Link key={k.label} to={k.to} className={`dash-kpi${k.warn ? ' warn' : ''}`}>
            <span className="dash-kpi-label">
              <k.icon size={15} />
              {k.label}
            </span>
            <strong>{k.value}</strong>
          </Link>
        ))}
      </div>

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
                <Link to={presetPath('/department', {statusFilter: 'READY'})}>
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
                <Link to={assetPath(i.asset) || presetPath('/issues', {status: 'OPEN', department: dept})}>
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
              <li key={m.id}>
                <History size={15} />
                <Link to={assetPath(m.asset) || '/movements'}>
                  <b>{m.asset}</b>
                  <small>
                    {trData(m.status)} · {trData(m.from)} → {trData(m.to)} · {m.at}
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
      </div>
    </div>
  );
}
