import {tr} from '../../i18n';
import {LOAD_STATUS, type ReportId, type Row} from './reportsMeta';

export type SummaryChip = {label: string; value: number; tone?: 'warn' | 'bad'};

const count = (rows: Row[], test: (row: Row) => boolean) => rows.filter(test).length;

/** The totals shown above a report's table: what the list adds up to, before reading its rows. */
export function reportSummary(active: ReportId, rows: Row[], warningThreshold: number): SummaryChip[] {
  if (active === 'inventory')
    return [
      {label: tr('Σύνολο'), value: rows.length},
      {label: tr('Σετ'), value: count(rows, r => r.kind === 'Σετ')},
      {label: tr('Εργαλεία'), value: count(rows, r => r.kind === 'Εργαλείο')},
    ];
  if (active === 'issues')
    return [
      {label: tr('Σύνολο'), value: rows.length},
      {label: tr('Ανοιχτές'), value: count(rows, r => r.status === 'Ανοιχτή'), tone: 'warn'},
      {label: tr('Ολοκληρωμένες'), value: count(rows, r => r.status === 'Ολοκληρωμένη')},
    ];
  if (active === 'usage')
    return [
      {label: tr('Σε χρήση'), value: count(rows, r => r.stateLabel === 'Σε χρήση')},
      {
        label: tr('Κρίσιμο όριο'),
        value: count(rows, r => r.stateLabel === 'Σε χρήση' && Number(r.remaining) <= warningThreshold),
        tone: 'warn',
      },
      {label: tr('Εκτός χρήσης'), value: count(rows, r => r.stateLabel === 'Εκτός χρήσης')},
    ];
  if (active === 'loads')
    return [
      {label: tr('Φορτία'), value: rows.length},
      {label: tr('Αποδεσμεύτηκαν'), value: count(rows, r => r.released !== '—')},
      {label: tr('Αποτυχίες'), value: count(rows, r => r.loadStatus === tr(LOAD_STATUS.FAILED)), tone: 'bad'},
    ];
  if (active === 'expiry')
    return [
      {label: tr('Σύνολο'), value: rows.length},
      {label: tr('Λήγουν σύντομα'), value: count(rows, r => r.expiryState === 'EXPIRING'), tone: 'warn'},
      {label: tr('Έληξαν'), value: count(rows, r => r.expiryState === 'EXPIRED'), tone: 'bad'},
    ];
  return [
    {label: tr('Σύνολο'), value: rows.length},
    {label: tr('Παραλαβές'), value: count(rows, r => r.type === 'Παραλαβή')},
    {label: tr('Παραδόσεις'), value: count(rows, r => r.type === 'Παράδοση')},
    {label: tr('Μη επιβεβαιωμένες'), value: count(rows, r => r.signature === tr('Μη επιβεβαιωμένη')), tone: 'warn'},
  ];
}
