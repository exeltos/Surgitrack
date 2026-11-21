import {useMemo, useState, type ReactNode} from 'react';
import {Link} from 'react-router-dom';
import {ChevronRight, Clock, Flame, ShieldCheck, Users} from 'lucide-react';
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
 * One figure of a tab, low: what it counts on top, then the figure with its comparison or a short note on the same
 * line. A strip down its left says how it stands (a problem red, a warning amber, good green); one that opens its list
 * is a link, with an arrow.
 */
function Fact({
  label,
  value,
  sub,
  tone,
  to,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'bad' | 'warn' | 'good';
  to?: string;
}) {
  const body = (
    <>
      <span className="ind-fact-label">
        {label}
        {to && <ChevronRight className="ind-fact-go" size={14} aria-hidden="true" />}
      </span>
      <span className="ind-fact-line">
        <strong className="ind-fact-value">{value}</strong>
        {sub && <span className="ind-fact-sub">{sub}</span>}
      </span>
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
  // The period before this one, for the comparison on each figure: the counts of twice the period less this one's.
  const since2 = sinceDays(days * 2);
  const before = useMemo(() => {
    const live2 = liveMovements(movements, since2);
    const use2 = usage(live2, since2, isSet);
    const q2 = quality(processLoads, since2);
    const sum = (list: ReadonlyArray<{uses: number}>) => list.reduce((n, d) => n + d.uses, 0);
    return {
      movements: workload(live2, since2, days * 2).total - load.total,
      rounds: turnaround(movements, since2, b => assetOf.get(b) || b).overall.rounds - rounds.overall.rounds,
      uses: sum(use2.departments) - sum(use.departments),
      cycles: q2.cycles - q.cycles,
      failed: q2.failed - q.failed,
      reprocess: q2.reprocess - q.reprocess,
      recalled: q2.recalled - q.recalled,
      issues: issueCounts(issues, since2).total - problems.total,
    };
  }, [movements, since2, isSet, processLoads, days, load, assetOf, rounds, use, q, issues, problems]);

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
  /**
   * The figure against the period before: «↑ 20% από 5», «+1 από 0», «= όπως πριν». `worse` says which way is bad
   * (more failures are; more movements are neither): that way red, the other green.
   */
  const trend = (now: number, then: number, worse?: 'up' | 'down') => {
    if (now === then)
      return (
        <>
          <em className="ind-chip">=</em> {L('όπως πριν', 'as before')}
        </>
      );
    const up = now > then;
    const tone = !worse ? '' : (up ? worse === 'up' : worse === 'down') ? 'bad' : 'good';
    // A share of a few says little («↑ 4000%» from 6): below 5 the difference itself.
    const change =
      then >= 5
        ? `${up ? '↑' : '↓'} ${Math.round((Math.abs(now - then) / then) * 100)}%`
        : `${up ? '+' : '−'}${Math.abs(now - then)}`;
    return (
      <>
        <em className={`ind-chip ${tone}`}>{change}</em> {L(`από ${then}`, `from ${then}`)}
      </>
    );
  };

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
            <Fact label={L('Κινήσεις', 'Movements')} value={load.total} sub={trend(load.total, before.movements)} />
            <Fact
              label={L('Μέσος όρος ανά ημέρα', 'Average per day')}
              value={load.perDay.toFixed(1).replace('.', lang === 'el' ? ',' : '.')}
              sub={L('κινήσεις', 'movements')}
            />
            <Fact
              label={L('Πιο φορτωμένη ώρα', 'Busiest hour')}
              value={load.peakHour === undefined ? '—' : hourSpan(load.peakHour)}
            />
            <Fact
              label={L('Πιο φορτωμένη ημέρα', 'Busiest day')}
              value={
                <span className="ind-cap">{load.peakDay === undefined ? '—' : weekday(load.peakDay, 'long')}</span>
              }
            />
          </div>

          <div className="ind-board ind-board-load">
            <section className="ind-section ind-panel ind-panel-wide" aria-labelledby="ind-heat">
              <h2 id="ind-heat">{L('Φόρτος ανά ημέρα και ώρα', 'Load by day and hour')}</h2>
              <p className="ind-note">
                {L(
                  'Οι κινήσεις κάθε ώρας της εβδομάδας· όσο πιο σκούρο, τόσο περισσότερη δουλειά.',
                  'The movements of each hour of the week; the darker, the busier.',
                )}
              </p>
              <div
                className="ind-heat-wrap"
                tabIndex={0}
                role="region"
                aria-label={L('Φόρτος ανά ώρα', 'Load by hour')}
              >
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

            <section className="ind-section ind-panel" aria-labelledby="ind-eq">
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
          </div>
        </>
      )}

      {tab === 'TURNAROUND' && (
        <>
          <div className="ind-facts">
            <Fact
              label={L('Συνήθης χρόνος επιστροφής', 'Typical turnaround')}
              value={rounds.overall.rounds ? hoursText(rounds.overall.median) : '—'}
              sub={L('από την αποστολή ως την επιστροφή', 'from dispatch until back')}
            />
            <Fact
              label={L('Το 90% επιστρέφει σε', '90% are back within')}
              value={rounds.overall.rounds ? hoursText(rounds.overall.p90) : '—'}
            />
            <Fact
              label={L('Ολοκληρωμένοι κύκλοι', 'Completed cycles')}
              value={rounds.overall.rounds}
              sub={trend(rounds.overall.rounds, before.rounds)}
            />
          </div>
          <div className="ind-board">
            <section className="ind-section ind-panel" aria-labelledby="ind-turn">
              <h2 id="ind-turn">{L('Ανά τμήμα', 'By department')}</h2>
              <p className="ind-note">
                {L(
                  'Από την αποστολή του τμήματος στην Αποστείρωση ως την επιστροφή στο τμήμα· πρώτα τα πιο αργά, με τη διαφορά από τον συνήθη χρόνο.',
                  'From the department’s dispatch to Sterilization until it is back; the slowest first, with the difference from the usual time.',
                )}
              </p>
              <ul
                className={`ind-rows${rounds.departments.length > 6 ? ' ind-rows-two' : ''}`}
                aria-labelledby="ind-turn"
              >
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
                      {L('το 90% σε', '90% within')} {hoursText(d.p90)} ·{' '}
                      {L(`${d.rounds} κύκλοι`, `${d.rounds} cycles`)}
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
          </div>
        </>
      )}

      {tab === 'USE' && (
        <>
          {/* Instruments used one by one, patients told apart from uses: shown only when they say something. */}
          <div className="ind-facts">
            <Fact
              label={L('Χρήσεις σε ασθενή', 'Uses on a patient')}
              value={use.departments.reduce((n, d) => n + d.uses, 0)}
              sub={trend(
                use.departments.reduce((n, d) => n + d.uses, 0),
                before.uses,
              )}
            />
            {showSets && <Fact label={L('Σετ', 'Sets')} value={use.departments.reduce((n, d) => n + d.sets, 0)} />}
            {showTools && (
              <Fact label={L('Εργαλεία', 'Instruments')} value={use.departments.reduce((n, d) => n + d.tools, 0)} />
            )}
          </div>
          <div className="ind-board">
            <section className="ind-section ind-panel" aria-labelledby="ind-use">
              <h2 id="ind-use">{L('Ανά τμήμα', 'By department')}</h2>
              <ul className="ind-rows" aria-labelledby="ind-use">
                {use.departments.map(d => (
                  <li key={d.department}>
                    <b>{trData(d.department)}</b>
                    <Bar value={d.uses} max={use.departments[0]?.uses || 1} />
                    <strong>
                      {d.uses} <small>{d.uses === 1 ? L('χρήση', 'use') : L('χρήσεις', 'uses')}</small>
                    </strong>
                    {/* Only what differs from the uses: patients, Sets, instruments. */}
                    {(showPatients || showSets || showTools) && (
                      <small>
                        {[
                          showPatients && L(`${d.patients} ασθενείς`, `${d.patients} patients`),
                          showSets && L(`${d.sets} Σετ`, `${d.sets} Sets`),
                          showTools && L(`${d.tools} εργαλεία`, `${d.tools} instruments`),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </small>
                    )}
                  </li>
                ))}
                {use.departments.length === 0 && (
                  <li className="ind-empty">
                    {L('Καμία χρήση σε ασθενή στην περίοδο.', 'No use on a patient in the period.')}
                  </li>
                )}
              </ul>
            </section>
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
              <section
                key={key}
                className={`ind-section ind-panel${showTools ? '' : ' ind-panel-wide'}`}
                aria-labelledby={`ind-${key}`}
              >
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
              label={L('Κύκλοι αποστείρωσης', 'Sterilization cycles')}
              value={q.cycles}
              sub={trend(q.cycles, before.cycles)}
              to={canReports ? LOADS : undefined}
            />
            <Fact
              label={L('Ανεπιτυχείς', 'Failed')}
              value={
                <>
                  {q.failed} <small>{pct(q.failed, q.cycles)}</small>
                </>
              }
              sub={trend(q.failed, before.failed, 'up')}
              tone={q.failed ? 'bad' : 'good'}
              to={canReports ? LOADS : undefined}
            />
            <Fact
              label={L('Επανεπεξεργασία', 'Reprocessed')}
              value={q.reprocess}
              sub={trend(q.reprocess, before.reprocess, 'up')}
              tone={q.reprocess ? 'warn' : undefined}
              to={canReports ? LOADS : undefined}
            />
            <Fact
              label={L('Ανακλήσεις', 'Recalls')}
              value={q.recalled}
              sub={trend(q.recalled, before.recalled, 'up')}
              tone={q.recalled ? 'bad' : undefined}
              to={canReports ? LOADS : undefined}
            />
            <Fact
              label={L(`Εκκρεμότητες · ${problems.open} ανοιχτές`, `Issues · ${problems.open} open`)}
              value={problems.total}
              sub={trend(problems.total, before.issues, 'up')}
              tone={problems.open ? 'warn' : undefined}
              to={can('issue.view') ? '/issues' : undefined}
            />
          </div>
          <div className="ind-board">
            <section className="ind-section ind-panel" aria-labelledby="ind-types">
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
            <section className="ind-section ind-panel" aria-labelledby="ind-depts">
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
            <section className="ind-section ind-panel" aria-labelledby="ind-loss">
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
