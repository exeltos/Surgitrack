import {statusLabel} from '../components/ui/statusLabel';
import {tr, trData} from '../i18n';
import {STERILE_STATES, formatExpiry} from './sterileExpiry';
import {isExhausted, isLow, isNew} from './usageStatus';
import {distinctValues, groupTools} from './toolGroups';
import type {ExportTable} from './exportTable';
import {dayLabel, type UsesOnDay} from './usageHistory';
import type {SetAsset, Tool} from '../types/domain';

const remainingUses = (x: {maxUses?: number; uses?: number}) =>
  x.maxUses ? Math.max(0, x.maxUses - (x.uses || 0)) : tr('Χωρίς όριο');

const expiry = (x: {state: string; sterileUntil?: string}) =>
  x.sterileUntil && (STERILE_STATES as readonly string[]).includes(x.state) ? formatExpiry(x.sterileUntil) : '';

/** The instruments of a list as a table: name, barcode, where, uses (used, limit, remaining) and expiry. */
const sum = (values: Array<number | undefined>) => values.reduce<number>((total, v) => total + (v || 0), 0);

const baseToolsTable = (tools: Tool[], title: string): ExportTable => ({
  title,
  totals: [
    tr('Σύνολο εργαλείων: {0}', tools.length),
    '',
    '',
    '',
    '',
    '',
    '',
    sum(tools.filter(t => t.maxUses).map(t => t.uses)),
    '',
    '',
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

/**
 * The instruments as they were on a past day: those that existed then, with the uses of that day (the limit is the
 * present one). The expiry is today's, so it is left out.
 */
const asOfDay = (tools: Tool[], onDay: UsesOnDay): Tool[] =>
  tools
    .filter(t => onDay.byId.get(t.id)?.existed !== false)
    .map(t => ({...t, uses: onDay.byId.get(t.id)?.uses ?? t.uses ?? 0, sterileUntil: undefined}));

const onDayTitle = (title: string, onDay: UsesOnDay) => `${title} · ${tr('κατάσταση την {0}', dayLabel(onDay.day))}`;

/** The instruments as a table; with a past day, the list as it was on that day. */
export const toolsExportTable = (tools: Tool[], title: string, onDay?: UsesOnDay): ExportTable =>
  onDay ? baseToolsTable(asOfDay(tools, onDay), onDayTitle(title, onDay)) : baseToolsTable(tools, title);

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
    sum(sets.filter(s => s.maxUses).map(s => s.uses)),
    '',
    '',
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

const range = (values: number[]) => {
  if (!values.length) return '';
  const low = Math.min(...values);
  const high = Math.max(...values);
  return low === high ? String(low) : `${low}–${high}`;
};

/**
 * The same instruments grouped by kind, i.e. by name (as the list's «Ομαδοποίηση», see core/toolGroups): one row per
 * kind with its pieces and the departments they are in; for the pieces with a limit, the limit (or its range), the
 * uses made in all, the uses left per piece (least to most) and the total of the uses left by all the pieces of the
 * kind, and how many are exhausted, low on uses or new. The new pieces (a limit, no use made) of a kind are a row of
 * their own at the end of the list. The totals under it count the same things, the uses left included.
 */
export const toolsGroupedExportTable = (
  allTools: Tool[],
  title: string,
  warningThreshold: number,
  onDay?: UsesOnDay,
): ExportTable => {
  const tools = onDay ? asOfDay(allTools, onDay) : allTools;
  const kinds = groupTools(tools).sort((a, b) => a[0].name.localeCompare(b[0].name, 'el'));
  const rowOf = (g: Tool[], name: string) => {
    const limited = g.filter(t => t.maxUses);
    const departments = distinctValues(g, t => trData(t.department) || tr('Απόθεμα')).sort((a, b) =>
      a.localeCompare(b, 'el'),
    );
    const codes = distinctValues(g, t => t.code);
    return [
      name,
      // The codes themselves, not how many there are.
      [...codes].sort((a, b) => a.localeCompare(b, 'el')).join(', '),
      distinctValues(g, t => t.manufacturer).join(', '),
      trData(g.find(t => t.specialty)?.specialty) || '',
      departments.join(' · '),
      g.length,
      range(limited.map(t => t.maxUses as number)),
      sum(limited.map(t => t.uses)),
      range(limited.map(t => remainingUses(t) as number)),
      sum(limited.map(t => remainingUses(t) as number)),
      limited.filter(isExhausted).length,
      limited.filter(t => isLow(t, warningThreshold)).length,
      limited.filter(isNew).length,
    ];
  };
  // The pieces of each kind that are in use (or have no limit) first; the new ones, with no use made, on their own
  // rows at the end of the list, so their uses left (all of them) are not mixed with those of the used pieces.
  const inUse = kinds
    .map(g => ({g: g.filter(t => !isNew(t)), name: g[0].name}))
    .filter(part => part.g.length)
    .map(part => rowOf(part.g, part.name));
  const unused = kinds
    .map(g => ({g: g.filter(isNew), name: g[0].name}))
    .filter(part => part.g.length)
    .map(part => rowOf(part.g, tr('{0} (αχρησιμοποίητα)', part.name)));
  const rows = [...inUse, ...unused];
  // The new pieces are set apart under a band of their own.
  const sections = unused.length
    ? [{before: inUse.length, title: tr('Αχρησιμοποίητα: καινούρια τεμάχια, καμία χρήση ακόμα')}]
    : undefined;
  const column = (index: number) => sum(rows.map(row => row[index] as number));
  return {
    title: onDay ? onDayTitle(title, onDay) : title,
    headers: [
      tr('Ονομασία'),
      tr('Κωδικός'),
      tr('Εταιρεία'),
      tr('Ειδικότητα'),
      tr('Τμήμα'),
      tr('Τεμάχια'),
      tr('Όριο χρήσεων'),
      tr('Χρήσεις που έγιναν'),
      tr('Υπόλοιπο ανά τεμάχιο'),
      tr('Σύνολο υπολοίπων χρήσεων'),
      tr('Εξαντλημένα'),
      tr('Λίγες χρήσεις'),
      tr('Αχρησιμοποίητα'),
    ],
    rows,
    ...(sections ? {sections} : {}),
    totals: [
      tr('Σύνολο ειδών: {0}', kinds.length),
      '',
      '',
      '',
      '',
      column(5),
      '',
      column(7),
      '',
      column(9),
      column(10),
      column(11),
      column(12),
    ],
  };
};
