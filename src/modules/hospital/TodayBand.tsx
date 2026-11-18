import {useEffect, useMemo, useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight, PackageCheck} from 'lucide-react';
import {useAppPreferences} from '../../core/AppPreferences';
import {movementStamp} from '../../core/movementTime';
import {isoDate} from '../../core/sterileExpiry';
import type {ProcessLoadRecord} from '../../types/domain';

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
  incoming: number;
  inProcess: number;
  inSterilizer: number;
  ready: number;
  /** The most urgent thing waiting, if any. */
  next?: {title: string; to: string};
  processLoads: ProcessLoadRecord[];
  /** Sterile Sets and instruments with their expiry date (yyyy-mm-dd). */
  expiries: Array<{sterileUntil: string}>;
};

/**
 * The top of the Overview: today in one line (what waits, what runs, what is ready), the most urgent thing to do,
 * and this week — the sterilization cycles of each day so far and the sterile items that expire on each day.
 */
export default function TodayBand({incoming, inProcess, inSterilizer, ready, next, processLoads, expiries}: Props) {
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
      return {day, key: isoDate(day), cycles: 0, expiring: 0};
    });
    const byKey = new Map(days.map(d => [d.key, d]));
    for (const load of processLoads) {
      if (load.kind !== 'STERILIZATION') continue;
      const stamp = movementStamp(load.createdAt);
      if (!stamp) continue;
      const slot = byKey.get(isoDate(new Date(stamp)));
      if (slot) slot.cycles++;
    }
    for (const item of expiries) {
      const slot = byKey.get(item.sterileUntil.slice(0, 10));
      if (slot) slot.expiring++;
    }
    return days;
    // `today` changes only with the date.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processLoads, expiries, todayKey]);
  const most = Math.max(1, ...week.map(d => d.cycles));
  const dateLine = today.toLocaleDateString(locale, {weekday: 'long', day: 'numeric', month: 'long'});

  return (
    <section className="today-band" aria-label={L('Σήμερα', 'Today')}>
      <div className="today-main">
        <p className="today-date">
          {L('Σήμερα', 'Today')} · <span>{dateLine}</span>
        </p>
        <div className="today-counts">
          <Count n={incoming} label={L('Προς παραλαβή', 'To receive')} to="/sterilization?queue=INCOMING" />
          <Count n={inProcess} label={L('Σε αποστείρωση', 'In sterilization')} to="/sterilization" />
          <Count
            n={inSterilizer}
            label={L('Στον κλίβανο', 'In the sterilizer')}
            to="/sterilization?queue=IN_STERILIZER"
          />
          <Count n={ready} label={L('Έτοιμα για παραλαβή', 'Ready for pickup')} to="/sterilization?queue=READY" />
        </div>
        {next ? (
          <Link className="today-next" to={next.to}>
            <span>{L('Πρώτα:', 'First:')}</span> {next.title} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        ) : (
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
            !future && L(`${d.cycles} κύκλοι αποστείρωσης`, `${d.cycles} sterilization cycles`),
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
                {!future && <i style={{height: `${Math.max(d.cycles ? 12 : 0, (d.cycles / most) * 100)}%`}} />}
              </span>
              <b aria-hidden="true">{future ? '' : d.cycles}</b>
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
