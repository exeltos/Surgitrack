/**
 * What an edit of a Set's or an instrument's details changed, field by field («Ονομασία: «Α» → «Β»»), for its history:
 * a correction can then be seen, and put back, by anyone reading it later.
 */
const LABELS: Record<string, string> = {
  name: 'Ονομασία',
  code: 'Κωδικός',
  barcode: 'Barcode',
  department: 'Τμήμα',
  specialty: 'Ειδικότητα',
  manufacturer: 'Κατασκευαστής',
  category: 'Κατηγορία',
  notes: 'Σημειώσεις',
  serialNumber: 'Σειριακός αριθμός',
  purchaseDate: 'Ημερομηνία αγοράς',
  warrantyUntil: 'Εγγύηση έως',
  cost: 'Κόστος',
  maxUses: 'Όριο χρήσεων',
  wearCheck: 'Έλεγχος φθοράς',
  multiUse: 'Πολλές χρήσεις ανά χειρουργείο',
  ownership: 'Ιδιοκτησία',
  ownerName: 'Ιδιοκτήτης',
};

const shown = (value: unknown) => {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Ναι' : 'Όχι';
  return `«${String(value).trim()}»`;
};

/** The fields of `patch` whose value differs from `before`, as «Πεδίο: «παλιό» → «νέο»», in a fixed order. */
export function describeChanges(before: Record<string, unknown>, patch: Record<string, unknown>): string[] {
  return Object.keys(LABELS)
    .filter(key => key in patch)
    .filter(key => {
      const a = before[key] ?? '';
      const b = patch[key] ?? '';
      return String(a).trim() !== String(b).trim();
    })
    .map(key => `${LABELS[key]}: ${shown(before[key])} → ${shown(patch[key])}`);
}
