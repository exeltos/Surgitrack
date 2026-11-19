import {useMemo, useState} from 'react';
import {Clock, Flame, ShieldCheck, Users} from 'lucide-react';
import {useSurgi} from '../../store/SurgiStore';
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
const PERIODS = [7, 30, 90] as const;

/**
 * Indicators (the admin, the Sterilization supervisor, the platform owner): how the work spreads over the hours and
 * the days, how long a round takes per department, who uses what and for which operations, and the quality —
 * failed cycles, issues, losses and expiries — over the last 7, 30 or 90 days.
 */
export default function IndicatorsPage() {
  const {movements, processLoads, issues, sets, tools} = useSurgi();
  const {lang} = useAppPreferences();
  const L = (el: string, en: string) => (lang === 'el' ? el : en);
  const locale = lang === 'el' ? 'el-GR' : 'en-GB';
  const [tab, setTab] = useState<Tab>('LOAD');
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const since = sinceDays(days);

  const live = useMemo(() => liveMovements(movements, since), [movements, since]);
  const load = useMemo(() => workload(live, since, days), [live, since, days]);
  const equipment = useMemo(() => equipmentLoad(processLoads, since), [processLoads, since]);
  const rounds = useMemo(() => turnaround(movements, since), [movements, since]);
  const use = useMemo(() => usage(live, since), [live, since]);
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
      ? L(`${Math.round(h)} ώρες`, `${Math.round(h)} hours`)
      : L(`${(h / 24).toFixed(1).replace('.', ',')} ημέρες`, `${(h / 24).toFixed(1)} days`);
  const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '—');

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
    const code = i.asset.split(' · ')[0].trim().toUpperCase();
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
      <h1 className="visually-hidden">{L('Δείκτες', 'Indicators')}</h1>
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
          <dl className="ind-facts">
            <div>
              <dt>{L('Κινήσεις', 'Movements')}</dt>
              <dd>{load.total}</dd>
            </div>
            <div>
              <dt>{L('Μέσος όρος ανά ημέρα', 'Average per day')}</dt>
              <dd>{load.perDay.toFixed(1).replace('.', lang === 'el' ? ',' : '.')}</dd>
            </div>
            <div>
              <dt>{L('Πιο φορτωμένη ώρα', 'Busiest hour')}</dt>
              <dd>{load.peakHour === undefined ? '—' : hourSpan(load.peakHour)}</dd>
            </div>
            <div>
              <dt>{L('Πιο φορτωμένη ημέρα', 'Busiest day')}</dt>
              <dd className="ind-cap">{load.peakDay === undefined ? '—' : weekday(load.peakDay, 'long')}</dd>
            </div>
          </dl>

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
          </section>

          <section className="ind-section" aria-labelledby="ind-eq">
            <h2 id="ind-eq">{L('Κλίβανοι και πλυντήρια', 'Sterilizers and washers')}</h2>
            <ul className="ind-rows" aria-labelledby="ind-eq">
              {equipment.map(e => (
                <li key={e.name}>
                  <b>{e.name}</b>
                  <Bar value={e.cycles} max={equipment[0]?.cycles || 1} />
                  <strong>{e.cycles}</strong>
                  <small>
                    {L('κύκλοι', 'cycles')} · {L('περισσότεροι', 'most on')}{' '}
                    <span className="ind-cap">{weekday(e.peakDay, 'long')}</span>
                    {e.failed > 0 && ` · ${L(`${e.failed} ανεπιτυχείς`, `${e.failed} failed`)}`}
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
          <dl className="ind-facts">
            <div>
              <dt>{L('Συνήθης χρόνος επιστροφής', 'Typical turnaround')}</dt>
              <dd>{rounds.overall.rounds ? hoursText(rounds.overall.median) : '—'}</dd>
            </div>
            <div>
              <dt>{L('Το 90% επιστρέφει σε', '90% are back within')}</dt>
              <dd>{rounds.overall.rounds ? hoursText(rounds.overall.p90) : '—'}</dd>
            </div>
            <div>
              <dt>{L('Ολοκληρωμένοι κύκλοι', 'Completed cycles')}</dt>
              <dd>{rounds.overall.rounds}</dd>
            </div>
          </dl>
          <section className="ind-section" aria-labelledby="ind-turn">
            <h2 id="ind-turn">{L('Ανά τμήμα', 'By department')}</h2>
            <p className="ind-note">
              {L(
                'Από την αποστολή του τμήματος στην Αποστείρωση ως την επιστροφή στο τμήμα· πρώτα τα πιο αργά.',
                'From the department’s dispatch to Sterilization until it is back; the slowest first.',
              )}
            </p>
            <ul className="ind-rows" aria-labelledby="ind-turn">
              {rounds.departments.map(d => (
                <li key={d.department}>
                  <b>{trData(d.department)}</b>
                  <Bar value={d.median} max={rounds.departments[0]?.median || 1} />
                  <strong>{hoursText(d.median)}</strong>
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
        <div className="ind-columns">
          <section className="ind-section" aria-labelledby="ind-use">
            <h2 id="ind-use">{L('Ανά τμήμα', 'By department')}</h2>
            <p className="ind-note">
              {L(
                'Χρήσεις σε ασθενή και οι επεμβάσεις (κατά Σετ) που τις απασχόλησαν περισσότερο.',
                'Uses on a patient and the operations (by Set) that took most of them.',
              )}
            </p>
            <ul className="ind-rows" aria-labelledby="ind-use">
              {use.departments.map(d => (
                <li key={d.department}>
                  <b>{trData(d.department)}</b>
                  <Bar value={d.uses} max={use.departments[0]?.uses || 1} />
                  <strong>{d.uses}</strong>
                  <small>
                    {L(`${d.patients} ασθενείς`, `${d.patients} patients`)}
                    {d.top.length > 0 && ` · ${d.top.map(k => `${k.name} (${k.uses})`).join(', ')}`}
                  </small>
                </li>
              ))}
              {use.departments.length === 0 && (
                <li className="ind-empty">
                  {L('Καμία χρήση σε ασθενή στην περίοδο.', 'No use on a patient in the period.')}
                </li>
              )}
            </ul>
          </section>
          <section className="ind-section" aria-labelledby="ind-kinds">
            <h2 id="ind-kinds">{L('Πιο συχνές επεμβάσεις', 'Most frequent operations')}</h2>
            <p className="ind-note">
              {L('Κατά Σετ ή εργαλείο που χρησιμοποιήθηκε.', 'By the Set or instrument used.')}
            </p>
            <ol className="ind-rows" aria-labelledby="ind-kinds">
              {use.kinds.map(k => (
                <li key={k.name}>
                  <b>{k.name}</b>
                  <Bar value={k.uses} max={use.kinds[0]?.uses || 1} />
                  <strong>{k.uses}</strong>
                </li>
              ))}
              {use.kinds.length === 0 && <li className="ind-empty">—</li>}
            </ol>
          </section>
        </div>
      )}

      {tab === 'QUALITY' && (
        <>
          <dl className="ind-facts">
            <div>
              <dt>{L('Κύκλοι αποστείρωσης', 'Sterilization cycles')}</dt>
              <dd>{q.cycles}</dd>
            </div>
            <div>
              <dt>{L('Ανεπιτυχείς', 'Failed')}</dt>
              <dd>
                {q.failed} <small>{pct(q.failed, q.cycles)}</small>
              </dd>
            </div>
            <div>
              <dt>{L('Επανεπεξεργασία', 'Reprocessed')}</dt>
              <dd>{q.reprocess}</dd>
            </div>
            <div>
              <dt>{L('Ανακλήσεις', 'Recalls')}</dt>
              <dd>{q.recalled}</dd>
            </div>
            <div>
              <dt>{L('Εκκρεμότητες', 'Issues')}</dt>
              <dd>
                {problems.total} <small>{L(`${problems.open} ανοιχτές`, `${problems.open} open`)}</small>
              </dd>
            </div>
          </dl>
          <div className="ind-columns">
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
              <h2 id="ind-depts">{L('Εκκρεμότητες ανά τμήμα', 'Issues by department')}</h2>
              <ul className="ind-rows" aria-labelledby="ind-depts">
                {problems.byDepartment.map(t => (
                  <li key={t.name}>
                    <b>{trData(t.name)}</b>
                    <Bar value={t.n} max={problems.byDepartment[0]?.n || 1} />
                    <strong>{t.n}</strong>
                  </li>
                ))}
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
