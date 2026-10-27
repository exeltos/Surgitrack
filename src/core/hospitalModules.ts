/**
 * Modules the platform owner switches on for a hospital (Studio → Hospitals). A hospital that has not been
 * given a module does not see its screens, counts or alerts.
 */
export type HospitalModule = 'REPLACEMENTS' | 'STOCK_MINIMUMS';

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
];

export const ALL_MODULES: HospitalModule[] = HOSPITAL_MODULES.map(m => m.id);

/** The modules a hospital row names (anything unknown is left out); undefined means the row says nothing. */
export const modulesOf = (value: unknown): HospitalModule[] | undefined =>
  Array.isArray(value) ? ALL_MODULES.filter(id => value.includes(id)) : undefined;
