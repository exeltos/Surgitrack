import {tr} from '../../i18n';
import {LOAD_STATUS, type ReportId, type Row} from './reportsMeta';

/** A card above the table: how many rows fit, and which they are (opens the list when pressed). */
export type SummaryChip = {label: string; value: number; tone?: 'warn' | 'bad'; test: (row: Row) => boolean};
/** The rows split by one column (department, sterilizer…), the biggest groups first. */
export type SummaryGroup = {title: string; key: string; items: Array<{label: string; value: number}>};

const all = () => true;

const count = (rows: Row[], test: (row: Row) => boolean) => rows.filter(test).length;

/** The totals shown above a report's table: what the list adds up to, before reading its rows. */
export function reportSummary(active: ReportId, rows: Row[], warningThreshold: number): SummaryChip[] {
  if (active === 'inventory')
    return [
      {label: tr('Σύνολο'), value: rows.length, test: all},
      {label: tr('Σετ'), value: count(rows, r => r.kind === 'Σετ'), test: r => r.kind === 'Σετ'},
      {label: tr('Εργαλεία'), value: count(rows, r => r.kind === 'Εργαλείο'), test: r => r.kind === 'Εργαλείο'},
    ];
  if (active === 'issues')
    return [
      {label: tr('Σύνολο'), value: rows.length, test: all},
      {
        label: tr('Ανοιχτές'),
        value: count(rows, r => r.status === 'Ανοιχτή'),
        tone: 'warn',
        test: r => r.status === 'Ανοιχτή',
      },
      {
        label: tr('Ολοκληρωμένες'),
        value: count(rows, r => r.status === 'Ολοκληρωμένη'),
        test: r => r.status === 'Ολοκληρωμένη',
      },
    ];
  if (active === 'usage')
    return [
      {
        label: tr('Σε χρήση'),
        value: count(rows, r => r.stateLabel === 'Σε χρήση'),
        test: r => r.stateLabel === 'Σε χρήση',
      },
      {
        label: tr('Κρίσιμο όριο'),
        value: count(rows, r => r.stateLabel === 'Σε χρήση' && Number(r.remaining) <= warningThreshold),
        tone: 'warn',
        test: r => r.stateLabel === 'Σε χρήση' && Number(r.remaining) <= warningThreshold,
      },
      {
        label: tr('Εκτός χρήσης'),
        value: count(rows, r => r.stateLabel === 'Εκτός χρήσης'),
        test: r => r.stateLabel === 'Εκτός χρήσης',
      },
    ];
  if (active === 'loads')
    return [
      {label: tr('Φορτία'), value: rows.length, test: all},
      {label: tr('Αποδεσμεύτηκαν'), value: count(rows, r => r.released !== '—'), test: r => r.released !== '—'},
      {
        label: tr('Αποτυχίες'),
        value: count(rows, r => r.loadStatus === tr(LOAD_STATUS.FAILED)),
        tone: 'bad',
        test: r => r.loadStatus === tr(LOAD_STATUS.FAILED),
      },
    ];
  if (active === 'expiry')
    return [
      {label: tr('Σύνολο'), value: rows.length, test: all},
      {
        label: tr('Λήγουν σύντομα'),
        value: count(rows, r => r.expiryState === 'EXPIRING'),
        tone: 'warn',
        test: r => r.expiryState === 'EXPIRING',
      },
      {
        label: tr('Έληξαν'),
        value: count(rows, r => r.expiryState === 'EXPIRED'),
        tone: 'bad',
        test: r => r.expiryState === 'EXPIRED',
      },
    ];
  return [
    {label: tr('Σύνολο'), value: rows.length, test: all},
    {label: tr('Παραλαβές'), value: count(rows, r => r.type === 'Παραλαβή'), test: r => r.type === 'Παραλαβή'},
    {label: tr('Παραδόσεις'), value: count(rows, r => r.type === 'Παράδοση'), test: r => r.type === 'Παράδοση'},
    {
      label: tr('Μη επιβεβαιωμένες'),
      value: count(rows, r => r.signature === tr('Μη επιβεβαιωμένη')),
      tone: 'warn',
      test: r => r.signature === tr('Μη επιβεβαιωμένη'),
    },
  ];
}

/** What each report is split by in its small chart. */
const GROUP_BY: Record<ReportId, {title: () => string; key: string}> = {
  inventory: {title: () => tr('Ανά τμήμα'), key: 'department'},
  issues: {title: () => tr('Ανά είδος'), key: 'type'},
  usage: {title: () => tr('Ανά τμήμα'), key: 'department'},
  loads: {title: () => tr('Ανά κλίβανο'), key: 'equipment'},
  expiry: {title: () => tr('Ανά τμήμα'), key: 'department'},
  handovers: {title: () => tr('Ανά τμήμα'), key: 'department'},
};

/** The rows split by one column, biggest first (at most six groups). An inventory by specialty splits by that. */
export function reportGroups(active: ReportId, rows: Row[]): SummaryGroup {
  const spec = GROUP_BY[active];
  const key = active === 'inventory' && rows.length && !('department' in rows[0]) ? 'specialty' : spec.key;
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = String(row[key] ?? '—');
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const items = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value]) => ({label, value}));
  return {title: spec.title(), key, items};
}
