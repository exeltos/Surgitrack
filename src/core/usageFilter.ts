import {tr} from '../i18n';
import {isExhausted, isLimited, isLow, isNew, type Lives} from './usageStatus';

export type UsageFilter = '' | 'LIMITED' | 'NEW' | 'LOW' | 'EXHAUSTED' | 'UNLIMITED';

/**
 * Options of the "usage type" list filter: instruments with lives, new (declared new, none used), few lives left,
 * none left, or no limit.
 */
export const usageFilterOptions = () => [
  {value: 'LIMITED', label: tr('Με όριο χρήσεων')},
  {value: 'NEW', label: tr('Καινούργια (0 χρήσεις)')},
  {value: 'LOW', label: tr('Λίγες χρήσεις')},
  {value: 'EXHAUSTED', label: tr('Εξαντλημένα (0 υπόλοιπο)')},
  {value: 'UNLIMITED', label: tr('Χωρίς όριο')},
];

/** Whether an instrument (or any of the given instruments, e.g. a Set's) matches the usage filter. */
export const matchesUsage = (filter: string, items: Lives[], warningThreshold: number) => {
  if (!filter) return true;
  const limited = items.filter(isLimited);
  if (filter === 'LIMITED') return limited.length > 0;
  // New: a limit, no use made and declared new (see core/usageStatus). A Set is new when all its limited items are.
  if (filter === 'NEW') return limited.length > 0 && limited.every(isNew);
  if (filter === 'LOW') return limited.some(x => isLow(x, warningThreshold));
  if (filter === 'EXHAUSTED') return limited.some(isExhausted);
  return limited.length === 0;
};
