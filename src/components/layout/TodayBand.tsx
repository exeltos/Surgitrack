import {useEffect, useMemo, useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight, PackageCheck} from 'lucide-react';
import {useAppPreferences} from '../../core/AppPreferences';
import {movementStamp} from '../../core/movementTime';
import {isoDate} from '../../core/sterileExpiry';

/** A number that counts up to its value when it first shows (at once for whoever prefers less motion); later changes show at once. */
function useCountUp(value: number, ms = 700) {
  const [counted, setCounted] = useState(prefersStill);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (counted) return;
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      // Fast at first, gently into the value.
      setShown(Math.round(value * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(step);
      else setCounted(true);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [counted, value, ms]);
  return counted ? value : shown;
}
const prefersStill = () =>
  typeof window === 'undefined' ||
  typeof window.matchMedia !== 'function' ||
  typeof requestAnimationFrame !== 'function' ||
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function Count({n, label, to}: {n: number; label: string; to: string}) {
  const shown = useCountUp(n);
  return (
    <Link to={to} className="today-count" aria-label={`${label}: ${n}`}>
      <b aria-hidden="true">{shown}</b>
      <small aria-hidden="true">{label}</small>
    </Link>
  );
}

type Props = {
  /** Today's figures, each opening the list that holds them. */
  counts: Array<{n: number; label: string; to: string}>;
  /** The most urgent thing waiting, if any; `null` where the page lists what waits already (no «Πρώτα»). */
  next?: {title: string; to: string} | null;
  /** When each of the week's events happened (a sterilization cycle, a movement): one bar per day. */
  events: readonly string[];
  /** How a day's count of events reads, e.g. «3 κύκλοι αποστείρωσης». */
  eventsLabel: (n: number) => string;
  /** Sterile Sets and instruments with their expiry date (yyyy-mm-dd). */
  expiries: ReadonlyArray<{sterileUntil: string}>;
};

/**
 * The top of a home page (the Overview, a department's Home): today in one line, the most urgent thing to do, and
 * this week — the events of each day so far and the sterile items that expire on each day.
 */
export default function TodayBand({counts, next, events, eventsLabel, expiries}: Props) {
  const {lang} = useAppPreferences();
  const L = (el: string, en: string) => (lang === 'el' ? el : en);
  const locale = lang === 'el' ? 'el-GR' : 'en-GB';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = isoDate(today);

  // This week, Monday to Sunday.
  const week = useMemo(() => {
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const days = Array.from({length: 7}, (_, i) => {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      return {day, key: isoDate(day), n: 0, expiring: 0};
    });
    const byKey = new Map(days.map(d => [d.key, d]));
    for (const at of events) {
      const stamp = movementStamp(at);
      if (!stamp) continue;
      const slot = byKey.get(isoDate(new Date(stamp)));
      if (slot) slot.n++;
    }
    for (const item of expiries) {
      const slot = byKey.get(item.sterileUntil.slice(0, 10));
      if (slot) slot.expiring++;
    }
    return days;
    // `today` changes only with the date.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, expiries, todayKey]);
  const most = Math.max(1, ...week.map(d => d.n));
  const dateLine = today.toLocaleDateString(locale, {weekday: 'long', day: 'numeric', month: 'long'});

  return (
    <section className="today-band" aria-label={L('Σήμερα', 'Today')}>
      <div className="today-main">
        <p className="today-date">
          {L('Σήμερα', 'Today')} · <span>{dateLine}</span>
        </p>
        <div className="today-counts">
          {counts.map(c => (
            <Count key={c.label} n={c.n} label={c.label} to={c.to} />
          ))}
        </div>
        {next ? (
          <Link className="today-next" to={next.to}>
            <span>{L('Πρώτα:', 'First:')}</span> {next.title} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        ) : next === null ? null : (
          <p className="today-next ok">
            <PackageCheck size={16} aria-hidden="true" /> {L('Τίποτα δεν περιμένει.', 'Nothing is waiting.')}
          </p>
        )}
      </div>
      <ol className="today-week" aria-label={L('Αυτή την εβδομάδα', 'This week')}>
        {week.map(d => {
          const isToday = d.key === todayKey;
          const future = d.day > today;
          const name = d.day.toLocaleDateString(locale, {weekday: 'short'});
          const full = d.day.toLocaleDateString(locale, {weekday: 'long', day: 'numeric', month: 'short'});
          const parts = [
            !future && eventsLabel(d.n),
            d.expiring > 0 && L(`${d.expiring} λήγουν`, `${d.expiring} expire`),
          ].filter(Boolean);
          return (
            <li
              key={d.key}
              className={`${isToday ? 'today' : ''}${future ? ' future' : ''}`.trim() || undefined}
              aria-current={isToday ? 'date' : undefined}
              title={[full, ...parts].join(' · ')}
            >
              <span className="today-bar" aria-hidden="true">
                {!future && <i style={{height: `${Math.max(d.n ? 12 : 0, (d.n / most) * 100)}%`}} />}
              </span>
              <b aria-hidden="true">{future ? '' : d.n}</b>
              <small aria-hidden="true">{name}</small>
              <span className="visually-hidden">{[full, ...parts].join(', ')}</span>
              {d.expiring > 0 && <em className="today-expiry" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
