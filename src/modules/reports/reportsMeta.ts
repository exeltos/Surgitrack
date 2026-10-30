import {Activity, Boxes, CalendarClock, Flame, FileText, PenLine, Wrench} from 'lucide-react';
import {escapeHtml} from '../../core/escapeHtml';
import {printLogoHtml} from '../../core/printBranding';
import {getI18nLang, tr, trData} from '../../i18n';
import {formatDateTime, parseDisplayDate} from '../../core/displayDate';

/** The reports, their labels and their printed form. */
/** A record's date as a number for sorting (newest first); unreadable dates go last. */
export const sortableTime = (value: string) => parseDisplayDate(value)?.getTime() ?? 0;

export const LOAD_STATUS: Record<string, string> = {
  OPEN: 'Στον κλίβανο',
  AWAITING_RELEASE: 'Αναμονή αποδέσμευσης',
  RELEASED: 'Αποδεσμεύτηκε',
  REPROCESS: 'Μη αποδέσμευση',
  FAILED: 'Αποτυχία κύκλου',
  RECALLED: 'Ανάκληση',
};
export const INDICATOR: Record<string, string> = {
  PASS: 'Επιτυχής',
  FAIL: 'Ανεπιτυχής',
  NOT_RECORDED: 'Δεν έγινε',
  PENDING: 'Σε αναμονή',
};
export const indicatorText = (value?: string) => (value && INDICATOR[value] ? tr(INDICATOR[value]) : '—');

export type ReportId = 'inventory' | 'issues' | 'usage' | 'loads' | 'expiry' | 'handovers';
/** How the equipment inventory is grouped. */
export type InventoryGroup = 'department' | 'specialty';
export type Row = Record<string, string | number>;

export const stateLabel: Record<string, string> = {
  IN_DEPARTMENT: 'Στο τμήμα',
  PENDING_STERILIZATION: 'Αναμονή παραλαβής',
  IN_WASHING: 'Σε καθαρισμό',
  IN_PREPARATION: 'Σε σύνθεση',
  IN_PACKAGING: 'Σε συσκευασία',
  IN_STERILIZATION: 'Στον κλίβανο',
  AWAITING_RELEASE: 'Αναμονή αποδέσμευσης',
  IN_STORAGE: 'Σε αποθήκευση',
  READY_FOR_PICKUP: 'Έτοιμο για παραλαβή',
  IN_STOCK: 'Απόθεμα',
  SERVICE: 'Service',
  LOST: 'Απώλεια',
  RETIRED: 'Εκτός χρήσης',
};

/** The reports in three groups, as the list shows them. */
export type ReportGroup = 'EQUIPMENT' | 'STERILIZATION' | 'HANDOVER';
export const reportGroups: Array<{id: ReportGroup; title: string}> = [
  {id: 'EQUIPMENT', title: 'Εξοπλισμός'},
  {id: 'STERILIZATION', title: 'Αποστείρωση'},
  {id: 'HANDOVER', title: 'Παραδόσεις'},
];

export const reports: Array<{
  id: ReportId;
  group: ReportGroup;
  title: string;
  description: string;
  /** What it is used for, in one line. */
  purpose: string;
  icon: typeof FileText;
}> = [
  {
    id: 'inventory',
    group: 'EQUIPMENT',
    purpose: 'Για απογραφή και έλεγχο: τι υπάρχει και πού βρίσκεται.',
    title: 'Απογραφή εξοπλισμού',
    description: 'Σετ και εργαλεία ανά τμήμα ή ανά ειδικότητα.',
    icon: Boxes,
  },
  {
    id: 'issues',
    group: 'EQUIPMENT',
    purpose: 'Για να δεις ποιες βλάβες και απώλειες εκκρεμούν.',
    title: 'Service & βλάβες',
    description: 'Βλάβες, φθορές, απώλειες και εκκρεμότητες.',
    icon: Wrench,
  },
  {
    id: 'usage',
    group: 'EQUIPMENT',
    purpose: 'Για να προλάβεις εργαλεία που φτάνουν στο όριο χρήσεων.',
    title: 'Χρήσεις & αποσύρσεις',
    description: 'Υπόλοιπο χρήσεων, κρίσιμα όρια και εργαλεία που τέθηκαν εκτός χρήσης.',
    icon: Activity,
  },
  {
    id: 'loads',
    group: 'STERILIZATION',
    purpose: 'Για τεκμηρίωση κύκλων και αποδεσμεύσεων σε έλεγχο.',
    title: 'Φορτία κλιβάνου',
    description: 'Φορτία, κύκλοι, δείκτες και αποδεσμεύσεις ανά κλίβανο.',
    icon: Flame,
  },
  {
    id: 'expiry',
    group: 'STERILIZATION',
    purpose: 'Για να ξανα-αποστειρώσεις πριν λήξει ό,τι είναι στα ράφια.',
    title: 'Λήξεις αποστείρωσης',
    description: 'Αποστειρωμένα Σετ και εργαλεία με διάρκεια και ημερομηνία λήξης.',
    icon: CalendarClock,
  },
  {
    id: 'handovers',
    group: 'HANDOVER',
    purpose: 'Για να δεις ποιος παρέδωσε σε ποιον και ποιες υπογραφές λείπουν.',
    title: 'Παραδόσεις & παραλαβές',
    description: 'Ποιος παρέδωσε σε ποιον, και αν ο άλλος υπέγραψε με τον δικό του κωδικό.',
    icon: PenLine,
  },
];

/** Report cells holding stored Greek values (type, department, state…) are shown in the UI language. */
export const TRANSLATED_COLUMNS = new Set([
  'kind',
  'department',
  'specialty',
  'stateLabel',
  'type',
  'status',
  'from',
  'to',
  'reason',
]);
export const cellText = (key: string, value: unknown) => {
  const text = String(value ?? '—');
  return TRANSLATED_COLUMNS.has(key) ? trData(text) : text;
};

export function genericReportHtml(
  title: string,
  subtitle: string,
  columns: Array<{key: string; label: string}>,
  rows: Row[],
) {
  const bodyRows = rows.length
    ? rows
        .map(
          row => `<tr>${columns.map(col => `<td>${escapeHtml(cellText(col.key, row[col.key]))}</td>`).join('')}</tr>`,
        )
        .join('')
    : `<tr><td colspan="${columns.length}" class="empty">${escapeHtml(tr('Δεν υπάρχουν εγγραφές για τα επιλεγμένα φίλτρα.'))}</td></tr>`;
  return `<!doctype html><html lang="${getI18nLang()}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172b38;margin:0;font-size:9pt}.brand{font-size:16pt;font-weight:800;color:#153f51}.head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:1px solid #d8e1e5;padding-bottom:5mm;margin-bottom:5mm}.head h1{font-size:15pt;margin:2mm 0 1mm}.head p{margin:0;color:#687b87}.meta{text-align:right;color:#72838d;font-size:8pt}.count{margin:0 0 3mm;color:#526975}table{width:100%;border-collapse:collapse;table-layout:auto}th{text-align:left;background:#f1f5f7;color:#526975;font-size:8pt;padding:2.5mm 2mm;border-bottom:.4mm solid #c9d5da}td{padding:2.4mm 2mm;border-bottom:.2mm solid #e3eaed;vertical-align:top}.empty{text-align:center;padding:15mm;color:#81909a}.footer{margin-top:5mm;padding-top:3mm;border-top:.2mm solid #d8e1e5;display:flex;justify-content:space-between;color:#7a8a94;font-size:7.5pt}</style></head><body><div class="head"><div>${printLogoHtml() || '<div class="brand">SurgiTrack</div>'}<h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></div><div class="meta">${escapeHtml(tr('Αναφορά συστήματος'))}<br>${escapeHtml(formatDateTime())}</div></div><p class="count">${escapeHtml(tr('{0} εγγραφές', rows.length))}</p><table><thead><tr>${columns.map(c => `<th>${escapeHtml(c.label)}</th>`).join('')}</tr></thead><tbody>${bodyRows}</tbody></table><div class="footer"><span>SurgiTrack · Asset Management</span><span>${escapeHtml(title)}</span></div></body></html>`;
}
