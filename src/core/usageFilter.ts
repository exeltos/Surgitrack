import {tr} from '../i18n';
import {isExhausted, isLimited, isLow, isNew, isUsed, type Lives} from './usageStatus';

export type UsageFilter = '' | 'LIMITED' | 'NEW' | 'USED' | 'LOW' | 'EXHAUSTED' | 'UNLIMITED';

/** The "limit" list filter (with or without a limit of uses) and the "usage" one (new, used, few left, finished) combine. */
export const limitFilterOptions = () => [
  {value: 'LIMITED', label: tr('Με όριο χρήσεων')},
  {value: 'UNLIMITED', label: tr('Χωρίς όριο')},
];

export const usageFilterOptions = () => [
  {value: 'NEW', label: tr('Αχρησιμοποίητα (0 χρήσεις)')},
  {value: 'USED', label: tr('Χρησιμοποιημένα')},
  {value: 'LOW', label: tr('Λίγες χρήσεις')},
  {value: 'EXHAUSTED', label: tr('Εξαντλημένα (0 υπόλοιπο)')},
];

/** Whether an instrument (or any of the given instruments, e.g. a Set's) matches the usage filter. */
export const matchesUsage = (filter: string, items: Lives[], warningThreshold: number) => {
  if (!filter) return true;
  const limited = items.filter(isLimited);
  if (filter === 'LIMITED') return limited.length > 0;
  // A Set is new when all its instruments with a limit are; used when any is.
  if (filter === 'NEW') return limited.length > 0 && limited.every(isNew);
  if (filter === 'USED') return limited.some(isUsed);
  if (filter === 'LOW') return limited.some(x => isLow(x, warningThreshold));
  if (filter === 'EXHAUSTED') return limited.some(isExhausted);
  return limited.length === 0;
};
