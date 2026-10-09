import type {Permission} from './permissions';

export type ReleaseNote = {el: string; en: string; /** Shown only to those who can use it. */ permission?: Permission};
export type Release = {version: string; date: string; notes: ReleaseNote[]};

/** What changed for users, newest first: shown once after an update and in Help → What's new. */
export const releases: Release[] = [
  {
    version: '0.30.0',
    date: '2026-10-09',
    notes: [
      {
        el: 'Η Ιχνηλασιμότητα είναι πλέον στο μενού: όλη η πορεία ενός Set ή εργαλείου σε μία χρονογραμμή.',
        en: 'Traceability is now in the menu: the whole path of a Set or instrument on one timeline.',
        permission: 'traceability.view',
      },
      {
        el: 'Σε κάθε καρτέλα, βέλη για το προηγούμενο και το επόμενο της λίστας, χωρίς επιστροφή.',
        en: 'On every card, arrows to the previous and next item of the list, without going back.',
        permission: 'asset.detail.view',
      },
      {
        el: 'Αν φύγετε από μια φόρμα με αλλαγές που δεν αποθηκεύσατε, η εφαρμογή ρωτά πρώτα.',
        en: 'Leaving a form with unsaved changes now asks first.',
      },
      {
        el: 'Οι φωτογραφίες φορτώνουν γρηγορότερα· με ένα πάτημα ανοίγουν σε πλήρες μέγεθος.',
        en: 'Photos load faster; one tap opens them full size.',
      },
      {
        el: 'Οι αναφορές προβλήματος από το τμήμα μπορούν να έχουν φωτογραφία.',
        en: 'Problem reports from a department can include a photo.',
        permission: 'issue.create',
      },
      {
        el: 'Στις Εκκρεμότητες οι δείκτες είναι πάνω από τις καρτέλες· η λίστα ανοίγει άμεσα και με χιλιάδες εργαλεία.',
        en: 'In Issues the figures sit above the tabs; the list opens at once even with thousands of instruments.',
        permission: 'issue.view',
      },
      {
        el: 'Η Επισκόπηση χωρά σε μία οθόνη, και σε φορητό υπολογιστή.',
        en: 'The Overview fits on one screen, laptops included.',
        permission: 'overview.view',
      },
      {
        el: 'Πιο καθαρή λίστα Αποθέματος: barcode και όνομα μαζί, χωρίς άδειες στήλες.',
        en: 'A clearer Stock list: barcode and name together, no empty columns.',
        permission: 'stock.manage',
      },
      {
        el: 'Οι οθόνες στο κινητό ξαναστήθηκαν ώστε να διαβάζονται χωρίς οριζόντια κύλιση.',
        en: 'Phone screens were reworked to read without sideways scrolling.',
      },
      {
        el: 'Διαχείριση: τα δικαιώματα έχουν ελληνικά ονόματα και οι μετρήσεις ανά ρόλο είναι σωστές.',
        en: 'Administration: permissions have plain names and the counts per role are right.',
        permission: 'studio.manage',
      },
    ],
  },
];

/** The notes of a release this user can use. */
export const notesFor = (release: Release, can: (p: Permission) => boolean) =>
  release.notes.filter(n => !n.permission || can(n.permission));

/** True when version `a` is older than `b` (numeric parts, e.g. 0.9.1 < 0.30.0). */
export const olderVersion = (a: string, b: string) => {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0);
  }
  return false;
};
