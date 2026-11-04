import {statusLabel} from '../components/ui/statusLabel';
import {tr, trData} from '../i18n';
import {STERILE_STATES, formatExpiry} from './sterileExpiry';
import {isExhausted, isNew} from './usageStatus';
import {distinctValues, groupTools} from './toolGroups';
import type {ExportTable} from './exportTable';
import type {SetAsset, Tool} from '../types/domain';

const remainingUses = (x: {maxUses?: number; uses?: number}) =>
  x.maxUses ? Math.max(0, x.maxUses - (x.uses || 0)) : tr('Χωρίς όριο');

const expiry = (x: {state: string; sterileUntil?: string}) =>
  x.sterileUntil && (STERILE_STATES as readonly string[]).includes(x.state) ? formatExpiry(x.sterileUntil) : '';

/** The instruments of a list as a table: name, barcode, where, uses (used, limit, remaining) and expiry. */
const sum = (values: Array<number | undefined>) => values.reduce<number>((total, v) => total + (v || 0), 0);

export const toolsExportTable = (tools: Tool[], title: string): ExportTable => ({
  title,
  totals: [
    tr('Σύνολο εργαλείων: {0}', tools.length),
    '',
    '',
    '',
    '',
    '',
    '',
    sum(tools.map(t => t.uses)),
    '',
    sum(tools.filter(t => t.maxUses).map(t => remainingUses(t) as number)),
    '',
  ],
  headers: [
    tr('Ονομασία'),
    'Barcode',
    tr('Κωδικός'),
    tr('Εταιρεία'),
    tr('Ειδικότητα'),
    tr('Τμήμα'),
    tr('Κατάσταση'),
    tr('Χρήσεις'),
    tr('Όριο χρήσεων'),
    tr('Υπόλοιπο'),
    tr('Λήξη'),
  ],
  rows: tools.map(t => [
    t.name,
    t.barcode,
    t.code || '',
    t.manufacturer || '',
    trData(t.specialty) || '',
    trData(t.department) || '',
    statusLabel(t.state),
    t.uses || 0,
    t.maxUses || '',
    remainingUses(t),
    expiry(t),
  ]),
});

/** The Sets of a list as a table: name, barcode, where, instruments, uses and expiry. */
export const setsExportTable = (sets: SetAsset[], memberCount: Map<string, number>, title: string): ExportTable => ({
  title,
  totals: [
    tr('Σύνολο Σετ: {0}', sets.length),
    '',
    '',
    '',
    '',
    '',
    sum(sets.map(s => memberCount.get(s.id) ?? s.actual)),
    sum(sets.map(s => s.uses)),
    '',
    sum(sets.filter(s => s.maxUses).map(s => remainingUses(s) as number)),
    '',
  ],
  headers: [
    tr('Ονομασία'),
    'Barcode',
    tr('Κωδικός'),
    tr('Ειδικότητα'),
    tr('Τμήμα'),
    tr('Κατάσταση'),
    tr('Εργαλεία'),
    tr('Χρήσεις'),
    tr('Όριο χρήσεων'),
    tr('Υπόλοιπο'),
    tr('Λήξη'),
  ],
  rows: sets.map(s => [
    s.name,
    s.barcode,
    s.code || '',
    trData(s.specialty) || '',
    trData(s.department) || '',
    statusLabel(s.state),
    `${memberCount.get(s.id) ?? s.actual}/${s.expected}`,
    s.uses || 0,
    s.maxUses || '',
    remainingUses(s),
    expiry(s),
  ]),
});

/**
 * The same instruments grouped by kind, i.e. by name (as the list's «Ομαδοποίηση», see core/toolGroups): one row per kind with its
 * pieces, the departments they are in, how many have a limit, the uses made and left, and how many are new or
 * exhausted; and the totals under them.
 */
export const toolsGroupedExportTable = (tools: Tool[], title: string): ExportTable => {
  const rows = groupTools(tools)
    .sort((a, b) => a[0].name.localeCompare(b[0].name, 'el'))
    .map(g => {
      const limited = g.filter(t => t.maxUses);
      const departments = distinctValues(g, t => trData(t.department) || tr('Απόθεμα')).sort((a, b) =>
        a.localeCompare(b, 'el'),
      );
      const codes = distinctValues(g, t => t.code);
      return [
        g[0].name,
        codes.length > 1 ? tr('{0} κωδικοί', codes.length) : codes[0] || '',
        distinctValues(g, t => t.manufacturer).join(', '),
        trData(g.find(t => t.specialty)?.specialty) || '',
        departments.join(' · '),
        g.length,
        limited.length,
        sum(limited.map(t => t.uses)),
        sum(limited.map(t => remainingUses(t) as number)),
        limited.filter(isExhausted).length,
        limited.filter(isNew).length,
      ];
    });
  const column = (index: number) => sum(rows.map(row => row[index] as number));
  return {
    title,
    headers: [
      tr('Ονομασία'),
      tr('Κωδικός'),
      tr('Εταιρεία'),
      tr('Ειδικότητα'),
      tr('Τμήμα'),
      tr('Τεμάχια'),
      tr('Με όριο χρήσεων'),
      tr('Χρήσεις που έγιναν'),
      tr('Υπόλοιπο χρήσεων'),
      tr('Εξαντλημένα'),
      tr('Καινούργια'),
    ],
    rows,
    totals: [
      tr('Σύνολο ειδών: {0}', rows.length),
      '',
      '',
      '',
      '',
      column(5),
      column(6),
      column(7),
      column(8),
      column(9),
      column(10),
    ],
  };
};
