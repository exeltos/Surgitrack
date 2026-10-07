import {en} from './en';
import {translateToEnglish} from '../core/glossary';

export type Lang = 'el' | 'en';

const readStoredLang = (): Lang => {
  try {
    return localStorage.getItem('surgitrack-lang') === 'en' ? 'en' : 'el';
  } catch {
    return 'el';
  }
};

let current: Lang = readStoredLang();

/** Called by the preferences provider whenever the language changes (before the re-render). */
export const setI18nLang = (lang: Lang) => {
  current = lang;
};
export const getI18nLang = () => current;

/**
 * UI text in the current language. The Greek text is the key: in Greek it is shown as is, in
 * English it is looked up in the dictionary (falling back to the Greek). "{0}", "{1}"… in the
 * text are replaced by the extra arguments, so word order can differ between languages.
 */
export function tr(greek: string, ...args: Array<string | number | null | undefined>): string {
  const text = current === 'en' ? (en[greek] ?? greek) : greek;
  if (!args.length) return text;
  return text.replace(/\{(\d+)\}/g, (match, index: string) => {
    const value = args[Number(index)];
    return value === undefined || value === null ? '' : String(value);
  });
}

/**
 * Like tr(), for a Greek word with more than one English meaning in the app: the dictionary
 * entry "context|Greek" wins (e.g. "stage|Καθαρισμός" → "Cleaning", while "Καθαρισμός" alone is
 * the "Clear" button).
 */
export function trc(context: string, greek: string, ...args: Array<string | number | null | undefined>): string {
  if (current === 'en' && en[`${context}|${greek}`]) return tr(`${context}|${greek}`, ...args);
  return tr(greek, ...args);
}

/** Stored record text that carries numbers or names: "Φορτίο L-12" → "Load L-12". */
const DATA_PATTERNS: Array<[RegExp, string]> = [
  [/^Χρωματικός μάρτυρας: όπως το Σετ · αλλαγή ταινίας$/, 'Color marker: as the Set · change the tape'],
  [/^Χρωματικός μάρτυρας: κρατά την ταινία του$/, 'Color marker: keeps its tape'],
  [/^Χρωματικός μάρτυρας: (.+)$/, 'Color marker: $1'],
  [/^Νέο barcode · (.+)$/, 'New barcode · $1'],
  [/^Αποτυχία κύκλου (.+)$/, 'Cycle $1 failed'],
  [/^Φορτίο πλυντηρίου (.+)$/, 'Washer load $1'],
  [/^Αποδέσμευση φορτίου (.+)$/, 'Load $1 released'],
  [/^Μη αποδέσμευση φορτίου (.+)$/, 'Load $1 not released'],
  [/^Φορτίο (.+)$/, 'Load $1'],
  [/^φορτίο (.+)$/, 'load $1'],
  [/^κύκλος (.+)$/, 'cycle $1'],
  [/^ΑΝΑΚΛΗΣΗ (.+)$/, 'RECALL $1'],
  [/^παρέδωσε (.+)$/, 'handed over by $1'],
  [/^παρέλαβε (.+)$/, 'received by $1'],
  [/^Ολοκλήρωση ελέγχου$/, 'Check completed'],
  [/^Αντικατάσταση στη σύνθεση από (.+)$/, 'Replaced in the composition by $1'],
  [/^Αντικατάσταση εργαλείου (.+)$/, 'Replacement for instrument $1'],
  [/^Δημιουργία από (.+)$/, 'Created from $1'],
  [/^Αντίγραφο (.+)$/, 'Copy of $1'],
  [/^Επανέκδοση barcode$/, 'Barcode reissued'],
  [/^Διαγραφή Σετ και (\d+) εργαλείων$/, 'Set and $1 instruments deleted'],
  [/^Διαγραφή Σετ$/, 'Set deleted'],
  [/^(\d+) εργαλεία μεταφέρθηκαν στο Stock$/, '$1 instruments moved to stock'],
  [/^Δημιουργία Set$/, 'Set created'],
  [/^(\d+) εργαλεία$/, '$1 instruments'],
  [/^Barcode (.+) → (.+)$/, 'Barcode $1 → $2'],
  [/^Αναμενόμενα (\d+) \/ παραλήφθηκαν (\d+)$/, 'Expected $1 / received $2'],
  [/^Αναμενόμενα (\d+) \/ καταμετρημένα (\d+)$/, 'Expected $1 / counted $2'],
  [/^Επίλυση: (.+)$/, 'Resolved: $1'],
  [/^Σετ (.+?): (.+)$/, 'Set $1: $2'],
  [/^(.+) \(ως (.+)\)$/, '$1 (as $2)'],
  // Sterilizer loads (load, in the sterilizer, end of cycle, release).
  [/^Φορτίο (.+)$/, 'Load $1'],
  [/^κύκλος (.+)$/, 'cycle $1'],
  [/^Κύκλος (.+) ολοκληρώθηκε$/, 'Cycle $1 completed'],
  [/^Φόρτωση στον (.+)$/, 'Loaded into $1'],
  [/^Αποδέσμευση φορτίου (.+)$/, 'Load $1 released'],
  [/^Μη αποδέσμευση φορτίου (.+)$/, 'Load $1 not released'],
  [/^Αποδεσμεύτηκε$/, 'Released'],
];

const translateSegment = (segment: string): string => {
  const trimmed = segment.trim();
  if (!trimmed || !/[\u0370-\u03ff\u1f00-\u1fff]/.test(trimmed)) return segment;
  const exact = en[trimmed];
  if (exact) return exact;
  for (const [pattern, english] of DATA_PATTERNS) {
    if (pattern.test(trimmed))
      return trimmed.replace(pattern, (...m) =>
        english.replace(/\$(\d)/g, (_, i) => trDataSegment(String(m[Number(i)]))),
      );
  }
  return translateToEnglish(trimmed) ?? trimmed;
};
// Captured parts may themselves be translatable ("ως Χειρουργείο").
const trDataSegment = (value: string) => (current === 'en' ? translateSegment(value) : value);

/**
 * Text stored in records (movement steps, locations, issue types, notes written by the app) is
 * kept in Greek; in the English UI it is shown translated: the whole text if known, else each
 * " · "-separated part, using the UI dictionary, record patterns and the medical glossary.
 */
export function trData(text: string | null | undefined): string {
  if (!text) return text ?? '';
  // Records written before «Stock» was renamed «Απόθεμα» still say Stock.
  if (current !== 'en') return text.replace(/\bStock\b/g, 'Απόθεμα');
  const whole = en[text.trim()];
  if (whole) return whole;
  return text
    .split(/( · | → )/)
    .map(part => (part === ' · ' || part === ' → ' ? part : translateSegment(part)))
    .join('');
}
