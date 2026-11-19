import {useEffect} from 'react';
import {cycleDigits, cyclePrefixOf, todaysCycles} from '../../../core/cycleNumber';
import type {LibraryItem} from '../../../core/libraries';
import type {ProcessLoadRecord} from '../../../types/domain';
import {tr} from '../../../i18n';

/**
 * The cycle number of a sterilizer load: the sterilizer's own letter (A, B…) with today's number, picked from a list
 * (A1, A2…), the next one chosen. Numbers used today by that sterilizer cannot be picked again. A number that came
 * from elsewhere (a connected device's cycle) stays offered as it is; without a sterilizer from the list, typed.
 */
export default function CycleNumberSelect({
  sterilizer,
  sterilizers,
  equipment,
  loads,
  value,
  onChange,
  label = tr('Αριθμός κύκλου'),
  className,
  fromDevice,
}: {
  sterilizer?: LibraryItem;
  sterilizers: readonly LibraryItem[];
  equipment: string;
  loads: readonly ProcessLoadRecord[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
  /** The number came from a connected device's cycle: it stays as the device gave it, whatever its letter. */
  fromDevice?: boolean;
}) {
  const prefix = cyclePrefixOf(sterilizer, sterilizers);
  const {used, next} = todaysCycles(loads, equipment, prefix);
  const digits = cycleDigits(value, prefix);
  const last = Math.max(10, next + 2);
  // The value is among the numbers offered; otherwise (a device's, or one past them) it is offered as it is.
  const listed = digits !== undefined && digits >= 1 && digits <= last && `${prefix}${digits}` === value;
  // Another sterilizer picked (or none yet): today's next number of this one. A device's number stays.
  const suggested = prefix ? `${prefix}${next}` : '';
  const stale = !fromDevice && (!value || (/^[A-Z]+\d+$/.test(value) && digits === undefined));
  useEffect(() => {
    if (suggested && stale) onChange(suggested);
  }, [suggested, stale, onChange]);

  if (!prefix)
    return (
      <label className={className}>
        {label}
        <input value={value} onChange={e => onChange(e.target.value)} />
      </label>
    );
  return (
    <label className={className}>
      {label}
      <select value={value} onChange={e => onChange(e.target.value)}>
        {value && !listed && <option value={value}>{value}</option>}
        {Array.from({length: last}, (_, i) => i + 1).map(n => (
          <option key={n} value={`${prefix}${n}`} disabled={used.has(n)}>
            {prefix}
            {n}
            {used.has(n) ? ` · ${tr('έγινε σήμερα')}` : ''}
          </option>
        ))}
      </select>
    </label>
  );
}
