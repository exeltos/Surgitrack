import {useMemo, useState, type ReactNode} from 'react';
import {Link} from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  Clock,
  Flame,
  Hourglass,
  Layers3,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
  Timer,
  Undo2,
  Users,
  Wrench,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import {useSurgi} from '../../store/SurgiStore';
import PageHeader from '../../components/ui/PageHeader';
import {useAppPreferences} from '../../core/AppPreferences';
import {sterileExpiryList} from '../../core/sterileExpiry';
import {movementStamp} from '../../core/movementTime';
import {trData} from '../../i18n';
import {
  equipmentLoad,
  issueCounts,
  liveMovements,
  quality,
  sinceDays,
  turnaround,
  usage,
  workload,
} from './indicatorsModel';

type Tab = 'LOAD' | 'TURNAROUND' | 'USE' | 'QUALITY';

/**
 * One figure of a tab: its icon on a light tint, what it counts, the figure, and a line that places it («σε 30
 * ημέρες», «9 ανοιχτές»). A problem shows in its colour; one that opens its list is a link, with an arrow.
 */
function Fact({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  to,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'bad' | 'warn' | 'good';
  to?: string;
}) {
  const body = (
    <>
      <span className="ind-fact-icon" aria-hidden="true">
        <Icon size={16} />
      </span>
      <span className="ind-fact-text">
        <span className="ind-fact-label">{label}</span>
        <strong className="ind-fact-value">{value}</strong>
        {sub && <span className="ind-fact-sub">{sub}</span>}
      </span>
      {to && <ChevronRight className="ind-fact-go" size={16} aria-hidden="true" />}
    </>
  );
  const className = `ind-fact${tone ? ` ${tone}` : ''}`;
  return to ? (
    <Link className={className} to={to}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
const PERIODS = [7, 30, 90] as const;

/**
 * Indicators (the admin, the Sterilization supervisor, the platform owner): how the work spreads over the hours and
 * the days, how long a round takes per department, who uses what and for which operations, and the quality —
 * failed cycles, issues, losses and expiries — over the last 7, 30 or 90 days.
 */
export default function IndicatorsPage() {
  const {movements, processLoads, issues, sets, tools, can} = useSurgi();
  const {lang} = useAppPreferences();
  const L = (el: string, en: string) => (lang === 'el' ? el : en);
  const locale = lang === 'el' ? 'el-GR' : 'en-GB';
  const [tab, setTab] = useState<Tab>('LOAD');
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const since = sinceDays(days);

  const live = useMemo(() => liveMovements(movements, since), [movements, since]);
  const load = useMemo(() => workload(live, since, days), [live, since, days]);
  const equipment = useMemo(() => equipmentLoad(processLoads, since), [processLoads, since]);
  // Each barcode, earlier ones too, to its asset's current one.
  const assetOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const x of [...sets, ...tools])
      for (const b of [x.barcode, ...(x.legacyBarcodes || [])]) map.set(b.toUpperCase(), x.barcode.toUpperCase());
    return map;
  }, [sets, tools]);
  const rounds = useMemo(() => turnaround(movements, since, b => assetOf.get(b) || b), [movements, since, assetOf]);
  // Whether a barcode is a Set's: today's Sets (earlier barcodes too), any record that said so (a Set deleted since
  // keeps its history), and, for one neither knows nor any instrument holds, the S… of a Set's barcode.
  const isSet = useMemo(() => {
    const codes = (list: ReadonlyArray<{barcode: string; legacyBarcodes?: string[]}>) =>
      list.flatMap(x => [x.barcode, ...(x.legacyBarcodes || [])]).map(b => b.toUpperCase());
    const setCodes = new Set([
      ...codes(sets),
      ...movements.filter(m => m.assetKind === 'SET').map(m => m.asset.split(' · ')[0].trim().toUpperCase()),
    ]);
    const toolCodes = new Set(codes(tools));
    return (b: string) => setCodes.has(b) || (!toolCodes.has(b) && /^S/i.test(b));
  }, [sets, tools, movements]);
  const use = useMemo(() => usage(live, since, isSet), [live, since, isSet]);
  // The loads report, where the cycles, the failed and the recalled ones are listed.
  const LOADS = '/reports?report=loads';
  const canReports = can('reports.view');
  const showTools = use.tools.length > 0 || use.departments.some(d => d.tools > 0);
  const showPatients = use.departments.some(d => d.patients !== d.uses);
  // With no instrument used on its own, the Sets are the uses: said once.
  const showSets = use.departments.some(d => d.sets !== d.uses);
  const q = useMemo(() => quality(processLoads, since), [processLoads, since]);
  const problems = useMemo(() => issueCounts(issues, since), [issues, since]);

  // Monday … Sunday, short and long, in the user's language.
  const weekday = (d: number, style: 'short' | 'long') => {
    const monday = new Date(2026, 0, 5 + d);
    return monday.toLocaleDateString(locale, {weekday: style});
  };
  const hourSpan = (h: number) => `${String(h).padStart(2, '0')}:00–${String((h + 1) % 24).padStart(2, '0')}:00`;
  const hoursText = (h: number) =>
    h < 48
      ? Math.round(h) === 1
        ? L('1 ώρα', '1 hour')
        : L(`${Math.round(h)} ώρες`, `${Math.round(h)} hours`)
      : L(`${(h / 24).toFixed(1).replace('.', ',')} ημέρες`, `${(h / 24).toFixed(1)} days`);
  const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '—');
  // «την Πέμπτη», «το Σάββατο»: the day with its article, for «Συχνότερα την Πέμπτη».
  const onDay = (d: number) => {
    const name = weekday(d, 'long');
    return lang === 'el' ? `${d === 5 ? 'το' : 'την'} ${name}` : `on ${name}`;
  };
  // A slower or quicker department than the usual turnaround: «+3 ώρες», «−2 ώρες».
  const diffText = (h: number) => {
    const n = Math.round(h);
    if (!n) return L('όσο ο συνήθης', 'as usual');
    return `${n > 0 ? '+' : '−'}${hoursText(Math.abs(n))}`;
  };
  const inDays = L(`σε ${days} ημέρες`, `in ${days} days`);

  const tabs: Array<{id: Tab; label: string; icon: typeof Clock}> = [
    {id: 'LOAD', label: L('Φόρτος', 'Workload'), icon: Flame},
    {id: 'TURNAROUND', label: L('Χρόνος κύκλου', 'Turnaround'), icon: Clock},
    {id: 'USE', label: L('Χρήση', 'Use'), icon: Users},
    {id: 'QUALITY', label: L('Ποιότητα & απώλειες', 'Quality & losses'), icon: ShieldCheck},
  ];

  const NONE = L('Χωρίς τμήμα', 'No department');
  // Losses and expiries now, per department: instruments lost, sterile items already expired.
  // Declaring an instrument lost clears its department; its loss issue keeps the one that lost it: the latest such
  // issue (issues come newest first, so on the same time the first one met stays).
  const lossDepartment = new Map<string, {department: string; stamp: number}>();
  for (const i of issues) {
    if (i.type !== 'Απώλεια') continue;
    // Recorded under the barcode it had then: a barcode reissued since still names the same instrument.
    const raw = i.asset.split(' · ')[0].trim().toUpperCase();
    const code = assetOf.get(raw) || raw;
    const stamp = movementStamp(i.created);
    if (stamp > (lossDepartment.get(code)?.stamp ?? -1)) lossDepartment.set(code, {department: i.department, stamp});
  }
  const lost = tools
    .filter(t => t.state === 'LOST')
    .map(t => ({...t, department: t.department || lossDepartment.get(t.barcode.toUpperCase())?.department}));
  const expiredNow = sterileExpiryList(sets, tools).filter(e => e.state === 'EXPIRED');
  const perDepartment = (items: ReadonlyArray<{department?: string}>) => {
    const map = new Map<string, number>();
    for (const i of items) map.set(i.department || NONE, (map.get(i.department || NONE) || 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  };

  const Bar = ({value, max}: {value: number; max: number}) => (
    <span className="ind-bar" aria-hidden="true">
      <i style={{width: `${max ? (value / max) * 100 : 0}%`}} />
    </span>
  );

  return (
    <div className="indicators">
      <PageHeader eyebrow={L('Ανάλυση', 'Analysis')} title={L('Δείκτες', 'Indicators')} />
      <div className="ind-head">
        <div className="name-check-tabs trace-tabs" role="tablist" aria-label={L('Δείκτες', 'Indicators')}>
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? 'active' : ''}
              onClick={() => setTab(t.id)}
            >
              <t.icon size={16} aria-hidden="true" /> {t.label}
            </button>
          ))}
        </div>
        <div className="ind-period" role="group" aria-label={L('Περίοδος', 'Period')}>
          {PERIODS.map(p => (
            <button key={p} type="button" aria-pressed={days === p} onClick={() => setDays(p)}>
              {L(`${p} ημέρες`, `${p} days`)}
            </button>
          ))}
        </div>
      </div>

      {tab === 'LOAD' && (
        <>
          <div className="ind-facts">
            <Fact icon={Activity} label={L('Κινήσεις', 'Movements')} value={load.total} sub={inDays} />
            <Fact
              icon={CalendarDays}
              label={L('Μέσος όρος ανά ημέρα', 'Average per day')}
              value={load.perDay.toFixed(1).replace('.', lang === 'el' ? ',' : '.')}
              sub={L('κινήσεις', 'movements')}
            />
            <Fact
              icon={Clock}
              label={L('Πιο φορτωμένη ώρα', 'Busiest hour')}
              value={load.peakHour === undefined ? '—' : hourSpan(load.peakHour)}
            />
            <Fact
              icon={Flame}
              label={L('Πιο φορτωμένη ημέρα', 'Busiest day')}
              value={
                <span className="ind-cap">{load.peakDay === undefined ? '—' : weekday(load.peakDay, 'long')}</span>
              }
            />
          </div>

          <section className="ind-section" aria-labelledby="ind-heat">
            <h2 id="ind-heat">{L('Φόρτος ανά ημέρα και ώρα', 'Load by day and hour')}</h2>
            <p className="ind-note">
              {L(
                'Οι κινήσεις κάθε ώρας της εβδομάδας· όσο πιο σκούρο, τόσο περισσότερη δουλειά.',
                'The movements of each hour of the week; the darker, the busier.',
              )}
            </p>
            <div className="ind-heat-wrap" tabIndex={0} role="region" aria-label={L('Φόρτος ανά ώρα', 'Load by hour')}>
              <table className="ind-heat">
                <thead>
                  <tr>
                    <th>
                      <span className="visually-hidden">{L('Ημέρα', 'Day')}</span>
                    </th>
                    {load.byHour.map((_, h) => (
                      <th key={h} scope="col">
                        {h % 3 === 0 ? String(h).padStart(2, '0') : <span className="visually-hidden">{h}</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {load.grid.map((row, d) => (
                    <tr key={d}>
                      <th scope="row" className="ind-cap">
                        {weekday(d, 'short')}
                      </th>
                      {row.map((n, h) => (
                        <td
                          key={h}
                          title={`${weekday(d, 'long')} ${hourSpan(h)}: ${n}`}
                          style={{opacity: n ? 0.15 + 0.85 * (n / Math.max(1, load.max)) : undefined}}
                          className={n ? 'on' : undefined}
                        >
                          <span className="visually-hidden">{n}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {load.max > 0 && (
              <p className="ind-legend" aria-hidden="true">
                <span>{L('Λιγότερο', 'Less')}</span>
                {[0.15, 0.36, 0.58, 0.79, 1].map(o => (
                  <i key={o} style={{opacity: o}} />
                ))}
                <span>{L('Περισσότερο', 'More')}</span>
                <span className="ind-legend-max">
                  · {L(`έως ${load.max} κινήσεις την ώρα`, `up to ${load.max} movements an hour`)}
                </span>
              </p>
            )}
          </section>

          <section className="ind-section" aria-labelledby="ind-eq">
            <h2 id="ind-eq">{L('Κλίβανοι και πλυντήρια', 'Sterilizers and washers')}</h2>
            <ul className="ind-rows" aria-labelledby="ind-eq">
              {equipment.map(e => (
                <li key={e.name}>
                  <b>{e.name}</b>
                  <Bar value={e.cycles} max={equipment[0]?.cycles || 1} />
                  <strong>
                    {e.cycles} <small>{e.cycles === 1 ? L('κύκλος', 'cycle') : L('κύκλοι', 'cycles')}</small>
                  </strong>
                  <small>
                    {L('Συχνότερα', 'Most often')} {onDay(e.peakDay)}
                    {e.failed > 0 && (
                      <em className="ind-bad">
                        {' · '}
                        {e.failed === 1
                          ? L('1 ανεπιτυχής', '1 failed')
                          : L(`${e.failed} ανεπιτυχείς`, `${e.failed} failed`)}
                      </em>
                    )}
                  </small>
                </li>
              ))}
              {equipment.length === 0 && (
                <li className="ind-empty">{L('Κανένας κύκλος στην περίοδο.', 'No cycles in the period.')}</li>
              )}
            </ul>
          </section>
        </>
      )}

      {tab === 'TURNAROUND' && (
        <>
          <div className="ind-facts">
            <Fact
              icon={Timer}
              label={L('Συνήθης χρόνος επιστροφής', 'Typical turnaround')}
              value={rounds.overall.rounds ? hoursText(rounds.overall.median) : '—'}
              sub={L('από την αποστολή ως την επιστροφή', 'from dispatch until back')}
            />
            <Fact
              icon={Hourglass}
              label={L('Το 90% επιστρέφει σε', '90% are back within')}
              value={rounds.overall.rounds ? hoursText(rounds.overall.p90) : '—'}
            />
            <Fact
              icon={RefreshCcw}
              label={L('Ολοκληρωμένοι κύκλοι', 'Completed cycles')}
              value={rounds.overall.rounds}
              sub={inDays}
            />
          </div>
          <section className="ind-section" aria-labelledby="ind-turn">
            <h2 id="ind-turn">{L('Ανά τμήμα', 'By department')}</h2>
            <p className="ind-note">
              {L(
                'Από την αποστολή του τμήματος στην Αποστείρωση ως την επιστροφή στο τμήμα· πρώτα τα πιο αργά, με τη διαφορά από τον συνήθη χρόνο.',
                'From the department’s dispatch to Sterilization until it is back; the slowest first, with the difference from the usual time.',
              )}
            </p>
            <ul className="ind-rows" aria-labelledby="ind-turn">
              {rounds.departments.map(d => (
                <li key={d.department}>
                  <b>{trData(d.department)}</b>
                  <Bar value={d.median} max={rounds.departments[0]?.median || 1} />
                  <strong>
                    {hoursText(d.median)}{' '}
                    <em
                      className={`ind-diff ${d.median - rounds.overall.median >= 1 ? 'up' : d.median - rounds.overall.median <= -1 ? 'down' : ''}`}
                    >
                      {diffText(d.median - rounds.overall.median)}
                    </em>
                  </strong>
                  <small>
                    {L('το 90% σε', '90% within')} {hoursText(d.p90)} · {L(`${d.rounds} κύκλοι`, `${d.rounds} cycles`)}
                  </small>
                </li>
              ))}
              {rounds.departments.length === 0 && (
                <li className="ind-empty">
                  {L('Κανένας ολοκληρωμένος κύκλος στην περίοδο.', 'No completed cycle in the period.')}
                </li>
              )}
            </ul>
          </section>
        </>
      )}

      {tab === 'USE' && (
        <>
          {/* Instruments used one by one, patients told apart from uses: shown only when they say something. */}
          <div className="ind-facts">
            <Fact
              icon={Users}
              label={L('Χρήσεις σε ασθενή', 'Uses on a patient')}
              value={use.departments.reduce((n, d) => n + d.uses, 0)}
              sub={inDays}
            />
            {showSets && (
              <Fact icon={Layers3} label={L('Σετ', 'Sets')} value={use.departments.reduce((n, d) => n + d.sets, 0)} />
            )}
            {showTools && (
              <Fact
                icon={Wrench}
                label={L('Εργαλεία', 'Instruments')}
                value={use.departments.reduce((n, d) => n + d.tools, 0)}
              />
            )}
          </div>
          <section className="ind-section" aria-labelledby="ind-use">
            <h2 id="ind-use">{L('Ανά τμήμα', 'By department')}</h2>
            {use.departments.length && !showPatients && !showSets && !showTools ? (
              // Only the uses to say: a list as the others.
              <ul className="ind-rows" aria-labelledby="ind-use">
                {use.departments.map(d => (
                  <li key={d.department}>
                    <b>{trData(d.department)}</b>
                    <Bar value={d.uses} max={use.departments[0]?.uses || 1} />
                    <strong>
                      {d.uses} <small>{d.uses === 1 ? L('χρήση', 'use') : L('χρήσεις', 'uses')}</small>
                    </strong>
                  </li>
                ))}
              </ul>
            ) : use.departments.length ? (
              <div className="ind-table-wrap" role="region" tabIndex={0} aria-labelledby="ind-use">
                <table className="ind-table">
                  <thead>
                    <tr>
                      <th scope="col">{L('Τμήμα', 'Department')}</th>
                      <th scope="col">{L('Χρήσεις', 'Uses')}</th>
                      {showPatients && <th scope="col">{L('Ασθενείς', 'Patients')}</th>}
                      {showSets && <th scope="col">{L('Σετ', 'Sets')}</th>}
                      {showTools && <th scope="col">{L('Εργαλεία', 'Instruments')}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {use.departments.map(d => (
                      <tr key={d.department}>
                        <th scope="row">{trData(d.department)}</th>
                        <td>
                          <span className="ind-cell-bar">
                            <strong>{d.uses}</strong>
                            <Bar value={d.uses} max={use.departments[0]?.uses || 1} />
                          </span>
                        </td>
                        {showPatients && <td>{d.patients}</td>}
                        {showSets && <td>{d.sets}</td>}
                        {showTools && <td>{d.tools}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="ind-note">
                {L('Καμία χρήση σε ασθενή στην περίοδο.', 'No use on a patient in the period.')}
              </p>
            )}
          </section>
          <div className={showTools ? 'ind-columns' : undefined}>
            {(
              [
                ['sets', L('Σετ που χρησιμοποιήθηκαν περισσότερο', 'Most used Sets'), use.sets],
                ...(showTools
                  ? ([
                      ['tools', L('Εργαλεία που χρησιμοποιήθηκαν περισσότερο', 'Most used instruments'), use.tools],
                    ] as const)
                  : []),
              ] as const
            ).map(([key, title, list]) => (
              <section key={key} className="ind-section" aria-labelledby={`ind-${key}`}>
                <h2 id={`ind-${key}`}>{title}</h2>
                <ol className={`ind-rows${showTools ? '' : ' ind-rows-two'}`} aria-labelledby={`ind-${key}`}>
                  {list.map(k => (
                    <li key={k.name}>
                      <b>{k.name}</b>
                      <Bar value={k.uses} max={list[0]?.uses || 1} />
                      <strong>
                        {k.uses} <small>{k.uses === 1 ? L('χρήση', 'use') : L('χρήσεις', 'uses')}</small>
                      </strong>
                      <small>{k.departments.map(d => trData(d)).join(' · ')}</small>
                    </li>
                  ))}
                  {list.length === 0 && <li className="ind-empty">—</li>}
                </ol>
              </section>
            ))}
          </div>
        </>
      )}

      {tab === 'QUALITY' && (
        <>
          <div className="ind-facts">
            <Fact
              icon={Flame}
              label={L('Κύκλοι αποστείρωσης', 'Sterilization cycles')}
              value={q.cycles}
              sub={inDays}
              to={canReports ? LOADS : undefined}
            />
            <Fact
              icon={XCircle}
              label={L('Ανεπιτυχείς', 'Failed')}
              value={q.failed}
              sub={L(`${pct(q.failed, q.cycles)} των κύκλων`, `${pct(q.failed, q.cycles)} of the cycles`)}
              tone={q.failed ? 'bad' : 'good'}
              to={canReports ? LOADS : undefined}
            />
            <Fact
              icon={RotateCcw}
              label={L('Επανεπεξεργασία', 'Reprocessed')}
              value={q.reprocess}
              tone={q.reprocess ? 'warn' : undefined}
              to={canReports ? LOADS : undefined}
            />
            <Fact
              icon={Undo2}
              label={L('Ανακλήσεις', 'Recalls')}
              value={q.recalled}
              tone={q.recalled ? 'bad' : undefined}
              to={canReports ? LOADS : undefined}
            />
            <Fact
              icon={AlertTriangle}
              label={L('Εκκρεμότητες', 'Issues')}
              value={problems.total}
              sub={L(`${problems.open} ανοιχτές`, `${problems.open} open`)}
              tone={problems.open ? 'warn' : undefined}
              to={can('issue.view') ? '/issues' : undefined}
            />
          </div>
          <div className="ind-columns ind-columns-three">
            <section className="ind-section" aria-labelledby="ind-types">
              <h2 id="ind-types">{L('Εκκρεμότητες ανά είδος', 'Issues by kind')}</h2>
              <ul className="ind-rows" aria-labelledby="ind-types">
                {problems.byType.map(t => (
                  <li key={t.name}>
                    <b>{trData(t.name)}</b>
                    <Bar value={t.n} max={problems.byType[0]?.n || 1} />
                    <strong>{t.n}</strong>
                  </li>
                ))}
                {problems.total === 0 && (
                  <li className="ind-empty">{L('Καμία εκκρεμότητα στην περίοδο.', 'No issue in the period.')}</li>
                )}
              </ul>
            </section>
            <section className="ind-section" aria-labelledby="ind-depts">
              <h2 id="ind-depts">{L('Εκκρεμότητες ανά τμήμα', 'Issues by department')}</h2>
              <ul className="ind-rows" aria-labelledby="ind-depts">
                {problems.byDepartment.map(t => (
                  <li key={t.name}>
                    <b>{trData(t.name)}</b>
                    <Bar value={t.n} max={problems.byDepartment[0]?.n || 1} />
                    <strong>{t.n}</strong>
                  </li>
                ))}
                {problems.total === 0 && <li className="ind-empty">—</li>}
              </ul>
            </section>
            <section className="ind-section" aria-labelledby="ind-loss">
              <h2 id="ind-loss">{L('Απώλειες και λήξεις τώρα', 'Losses and expiries now')}</h2>
              <p className="ind-note">
                {L(
                  `${lost.length} ${lost.length === 1 ? 'εργαλείο' : 'εργαλεία'} σε απώλεια · ${expiredNow.length} ${expiredNow.length === 1 ? 'αποστειρωμένο έχει' : 'αποστειρωμένα έχουν'} λήξει.`,
                  `${lost.length} instruments lost · ${expiredNow.length} sterile items expired.`,
                )}
              </p>
              <ul className="ind-rows" aria-labelledby="ind-loss">
                {perDepartment([...lost, ...expiredNow]).map(([department, n]) => (
                  <li key={department}>
                    <b>{trData(department)}</b>
                    <Bar value={n} max={perDepartment([...lost, ...expiredNow])[0]?.[1] || 1} />
                    <strong>{n}</strong>
                    <small>
                      {L('απώλειες', 'lost')} {lost.filter(t => (t.department || NONE) === department).length} ·{' '}
                      {L('λήξεις', 'expired')} {expiredNow.filter(e => (e.department || NONE) === department).length}
                    </small>
                  </li>
                ))}
                {lost.length + expiredNow.length === 0 && (
                  <li className="ind-empty">{L('Καμία απώλεια ή λήξη.', 'Nothing lost or expired.')}</li>
                )}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
