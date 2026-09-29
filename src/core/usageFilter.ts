import {tr} from '../i18n';

export type UsageFilter = '' | 'LIMITED' | 'LOW' | 'UNLIMITED';

/** Options of the "usage type" list filter: instruments with lives, few lives left, or no limit. */
export const usageFilterOptions = () => [
  {value: 'LIMITED', label: tr('Πολλαπλών χρήσεων (με ζωές)')},
  {value: 'LOW', label: tr('Λίγες ζωές')},
  {value: 'UNLIMITED', label: tr('Χωρίς όριο')},
];

type Lives = {maxUses?: number; uses?: number};

const remaining = (x: Lives) => (x.maxUses ? Math.max(0, x.maxUses - (x.uses || 0)) : Infinity);

/** Whether an instrument (or any of the given instruments, e.g. a Set's) matches the usage filter. */
export const matchesUsage = (filter: string, items: Lives[], warningThreshold: number) => {
  if (!filter) return true;
  const limited = items.filter(x => !!x.maxUses);
  if (filter === 'LIMITED') return limited.length > 0;
  if (filter === 'LOW') return limited.some(x => remaining(x) <= warningThreshold);
  return limited.length === 0;
};
