import {useMemo} from 'react';
import {Link} from 'react-router-dom';
import {
  Activity,
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
import {movementsPerDay, statusCard} from './departmentStatus';
import {useAppPreferences} from '../../core/AppPreferences';
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
 * The department's home after signing in: its Sets and standalone instruments at a glance — where they
 * are, how busy the department has been, what is waiting (pickup, expiry, issues), its latest movements
 * and its most used Sets.
 */
export default function DepartmentHomePage() {
  const {sets, tools, issues, movements, lifecycleAlerts, currentUser} = useSurgi();
  const {lang} = useAppPreferences();
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

  // Where the department's Sets and standalone instruments are now.
  const where = [
    {key: 'dept', label: tr('Στο τμήμα'), n: atDepartment.value},
    {key: 'process', label: tr('Σε αποστείρωση'), n: inSterilization.value},
    {key: 'ready', label: tr('Για παραλαβή'), n: readyStatus.value},
    {
      key: 'lost',
      label: tr('Service / απολεσθέντα'),
      n: tracked.filter(a => a.state === 'SERVICE' || a.state === 'LOST').length,
    },
  ];
  const whereTotal = where.reduce((sum, x) => sum + x.n, 0);
  const perDay = useMemo(() => movementsPerDay(movements, dept, new Date()), [movements, dept]);
  const perDayMax = Math.max(1, ...perDay.map(x => x.sent + x.received));
  const sentTotal = perDay.reduce((sum, x) => sum + x.sent, 0);
  const receivedTotal = perDay.reduce((sum, x) => sum + x.received, 0);
  const dayLabel = (d: Date) =>
    d.toLocaleDateString(lang === 'el' ? 'el-GR' : 'en-GB', {day: 'numeric', month: 'short'});
  const mostUsed = [...departmentSets]
    .filter(s => (s.uses || 0) > 0)
    .sort((a, b) => (b.uses || 0) - (a.uses || 0))
    .slice(0, 5);
  const mostUsedMax = Math.max(1, ...mostUsed.map(s => s.uses || 0));

  const kpis = [
    {
      icon: Layers3,
      label: tr('Σετ'),
      value: departmentSets.length,
      to: presetPath('/department'),
      note: undefined as string | undefined,
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
      ...atDepartment,
    },
    {
      icon: Sparkles,
      label: tr('Σε αποστείρωση'),
      ...inSterilization,
    },
    {
      icon: PackageCheck,
      label: tr('Για παραλαβή'),
      ...readyStatus,
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
            {k.note && <small>{k.note}</small>}
          </Link>
        ))}
      </div>

      <div className="dash-grid">
        <section className="dash-card dash-where">
          <header>
            <div>
              <b>{tr('Πού βρίσκεται ο εξοπλισμός')}</b>
              <small>{tr('Τα Σετ και τα μεμονωμένα εργαλεία του τμήματος τώρα.')}</small>
            </div>
            <Layers3 size={18} />
          </header>
          <div className="dash-stack" role="img" aria-label={where.map(x => `${x.label}: ${x.n}`).join(', ')}>
            {whereTotal === 0 ? (
              <i className="empty" />
            ) : (
              where
                .filter(x => x.n > 0)
                .map(x => (
                  <i key={x.key} className={`seg-${x.key}`} style={{flexGrow: x.n}} title={`${x.label}: ${x.n}`} />
                ))
            )}
          </div>
          <ul className="dash-legend" tabIndex={0} aria-label={tr('Πού βρίσκεται ο εξοπλισμός')}>
            {where.map(x => (
              <li key={x.key}>
                <span className={`dot seg-${x.key}`} />
                <span>{x.label}</span>
                <strong>{x.n}</strong>
                <small>{whereTotal ? `${Math.round((x.n / whereTotal) * 100)}%` : '—'}</small>
              </li>
            ))}
          </ul>
        </section>

        <section className="dash-card dash-activity">
          <header>
            <div>
              <b>{tr('Κινήσεις 14 ημερών')}</b>
              <small>{tr('Αποστολές στην Αποστείρωση και παραλαβές στο τμήμα, ανά ημέρα.')}</small>
            </div>
            <Activity size={18} />
          </header>
          <div className="dash-activity-stats">
            {[
              [tr('Αποστολές'), sentTotal],
              [tr('Παραλαβές'), receivedTotal],
              [tr('Σήμερα'), perDay[perDay.length - 1].sent + perDay[perDay.length - 1].received],
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
            aria-label={perDay
              .map(x => tr('{0}: {1} αποστολές, {2} παραλαβές', dayLabel(x.day), x.sent, x.received))
              .join(', ')}
          >
            {perDay.map(x => (
              <span
                key={x.day.getTime()}
                className="dash-col stacked"
                title={tr('{0}: {1} αποστολές, {2} παραλαβές', dayLabel(x.day), x.sent, x.received)}
              >
                {x.sent + x.received === 0 ? (
                  <i className="zero" />
                ) : (
                  <>
                    {x.received > 0 && (
                      <i className="seg-ready" style={{height: `${(x.received / perDayMax) * 100}%`}} />
                    )}
                    {x.sent > 0 && <i className="seg-dept" style={{height: `${(x.sent / perDayMax) * 100}%`}} />}
                  </>
                )}
              </span>
            ))}
          </div>
          <div className="dash-axis">
            <span>{dayLabel(perDay[0].day)}</span>
            <span className="dash-legend-inline">
              <span>
                <span className="dot seg-dept" />
                {tr('Αποστολές')}
              </span>
              <span>
                <span className="dot seg-ready" />
                {tr('Παραλαβές')}
              </span>
            </span>
            <span>{dayLabel(perDay[perDay.length - 1].day)}</span>
          </div>
        </section>

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
                    {movementText(m.status)} · {trData(m.from)} → {trData(m.to)} · {m.at}
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
              <b>{tr('Πιο πολυχρησιμοποιημένα Σετ')}</b>
              <small>{tr('Τα Σετ του τμήματος με τις περισσότερες χρήσεις.')}</small>
            </div>
            <Gauge size={18} />
          </header>
          <div className="dash-bars" tabIndex={0} aria-label={tr('Πιο πολυχρησιμοποιημένα Σετ')}>
            {mostUsed.map(s => (
              <Link key={s.id} className="dash-bar" to={`/sets/${s.id}`} title={`${s.name}: ${s.uses || 0}`}>
                <span className="dash-bar-name">{s.name}</span>
                <span className="dash-bar-track">
                  <i style={{width: `${((s.uses || 0) / mostUsedMax) * 100}%`}} />
                </span>
                <strong>{s.uses || 0}</strong>
              </Link>
            ))}
            {mostUsed.length === 0 && <p className="hospital-empty">{tr('Καμία χρήση ακόμα.')}</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
