/**
 * Modules the platform owner switches on for a hospital (Studio → Hospitals). A hospital that has not been
 * given a module does not see its screens, counts or alerts.
 */
export type HospitalModule =
  'REPLACEMENTS' | 'ORDERS' | 'STOCK_MINIMUMS' | 'DEVICES' | 'SURGICAL_COUNT' | 'EQUIPMENT_TESTS' | 'MANUAL_USES';

export const HOSPITAL_MODULES: Array<{
  id: HospitalModule;
  el: string;
  en: string;
  descriptionEl: string;
  descriptionEn: string;
}> = [
  {
    id: 'REPLACEMENTS',
    el: 'Αποσύρσεις & αντικαταστάσεις',
    en: 'Withdrawals & replacements',
    descriptionEl:
      'Ποια εργαλεία χρειάζονται αντικατάσταση (βλάβη, απώλεια, Service, απόσυρση) και η αντικατάστασή τους από το Απόθεμα.',
    descriptionEn:
      'Which instruments need replacing (damage, loss, service, withdrawal), and replacing them from Stock.',
  },
  {
    id: 'ORDERS',
    el: 'Παραγγελίες',
    en: 'Orders',
    descriptionEl: 'Παραγγελίες αγοράς προς τον προμηθευτή και η παραλαβή τους στο Απόθεμα.',
    descriptionEn: 'Purchase orders to the supplier, and receiving them into Stock.',
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
    el: 'Καταμέτρηση εργαλείων',
    en: 'Instrument count',
    descriptionEl:
      'Τα τμήματα που επιλέγετε (χειρουργείο, αίθουσα τοκετών, ΤΕΠ…) μετρούν και υπογράφουν τα εργαλεία όταν στέλνουν Σετ ή εργαλείο προς Αποστείρωση (Οργάνωση → Τμήματα).',
    descriptionEn:
      'The departments you choose (operating theatre, delivery suite, emergency…) count and sign the instruments when they send a Set or instrument to Sterilization (Organization → Departments).',
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
      'Ο διαχειριστής του νοσοκομείου και ο προϊστάμενος Αποστείρωσης προσθέτουν ή διορθώνουν με το χέρι τις χρήσεις που έχουν γίνει, και στη δημιουργία εργαλείου. Ξεχωριστό από τον ορισμό των ορίων χρήσεων.',
    descriptionEn:
      'The hospital admin and the Sterilization supervisor add or correct by hand the uses already made, also when creating an instrument. Separate from setting the usage limits.',
  },
];

export const ALL_MODULES: HospitalModule[] = HOSPITAL_MODULES.map(m => m.id);

/** The modules a hospital row names (anything unknown is left out); undefined means the row says nothing. */
export const modulesOf = (value: unknown): HospitalModule[] | undefined =>
  Array.isArray(value) ? ALL_MODULES.filter(id => value.includes(id)) : undefined;
