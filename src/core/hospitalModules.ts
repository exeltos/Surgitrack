/**
 * Modules the platform owner switches on for a hospital (Studio → Hospitals). A hospital that has not been
 * given a module does not see its screens, counts or alerts.
 */
export type HospitalModule =
  'REPLACEMENTS' | 'STOCK_MINIMUMS' | 'DEVICES' | 'SURGICAL_COUNT' | 'EQUIPMENT_TESTS' | 'MANUAL_USES';

export const HOSPITAL_MODULES: Array<{
  id: HospitalModule;
  el: string;
  en: string;
  descriptionEl: string;
  descriptionEn: string;
}> = [
  {
    id: 'REPLACEMENTS',
    el: 'Αντικαταστάσεις & Παραγγελίες',
    en: 'Replacements & Orders',
    descriptionEl: 'Ποια εργαλεία χρειάζονται αντικατάσταση και οι παραγγελίες προς τον προμηθευτή.',
    descriptionEn: 'Which instruments need replacing, and the orders sent to the supplier.',
  },
  {
    id: 'STOCK_MINIMUMS',
    el: 'Ελάχιστα αποθέματα',
    en: 'Minimum stock',
    descriptionEl: 'Ελάχιστη ποσότητα ανά είδος εργαλείου στο Απόθεμα και ειδοποίηση όταν πέσει κάτω από αυτή.',
    descriptionEn: 'A minimum quantity per kind of instrument in Stock, and an alert when it falls below.',
  },
  {
    id: 'DEVICES',
    el: 'Συσκευές',
    en: 'Devices',
    descriptionEl: 'Σύνδεση κλιβάνων και πλυντηρίων και κύκλοι που έρχονται από τις συσκευές.',
    descriptionEn: 'Connecting sterilizers and washers, and the cycles that come from the devices.',
  },
  {
    id: 'SURGICAL_COUNT',
    el: 'Καταμέτρηση στο χειρουργείο',
    en: 'Count in the operating theatre',
    descriptionEl:
      'Το χειρουργείο μετρά και υπογράφει τα εργαλεία όταν στέλνει Σετ ή εργαλείο προς Αποστείρωση (τα τμήματα που μετρούν ορίζονται στις Βιβλιοθήκες).',
    descriptionEn:
      'The operating theatre counts and signs the instruments when it sends a Set or instrument to Sterilization (the departments that count are set in Libraries).',
  },
  {
    id: 'EQUIPMENT_TESTS',
    el: 'Δοκιμές εξοπλισμού',
    en: 'Equipment tests',
    descriptionEl:
      'Καθημερινές και εβδομαδιαίες δοκιμές κλιβάνων και πλυντηρίων (Bowie-Dick, διαρροή, βιολογική, καθαρισμός) που φράσσουν τη φόρτωση σε αποτυχία.',
    descriptionEn:
      'Daily and weekly tests of sterilizers and washers (Bowie-Dick, leak, biological, cleaning) that block loading when one fails.',
  },
  {
    id: 'MANUAL_USES',
    el: 'Χειροκίνητη καταγραφή χρήσεων',
    en: 'Manual use records',
    descriptionEl:
      'Όποιος ορίζει τα όρια χρήσεων (διαχειριστής νοσοκομείου, προϊστάμενος Αποστείρωσης) προσθέτει ή διορθώνει με το χέρι τις χρήσεις που έχουν γίνει, και στη δημιουργία εργαλείου.',
    descriptionEn:
      'Whoever sets the usage limits (hospital admin, Sterilization supervisor) adds or corrects the uses already made by hand, also when creating an instrument.',
  },
];

export const ALL_MODULES: HospitalModule[] = HOSPITAL_MODULES.map(m => m.id);

/** The modules a hospital row names (anything unknown is left out); undefined means the row says nothing. */
export const modulesOf = (value: unknown): HospitalModule[] | undefined =>
  Array.isArray(value) ? ALL_MODULES.filter(id => value.includes(id)) : undefined;
