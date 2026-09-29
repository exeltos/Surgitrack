import {tr} from '../../i18n';

const labels: Record<string, string> = {
  IN_DEPARTMENT: 'Στο τμήμα',
  PENDING_STERILIZATION: 'Αναμονή παραλαβής από Αποστείρωση',
  IN_WASHING: 'Καθαρισμός & Απολύμανση',
  IN_PREPARATION: 'Σύνθεση & Προετοιμασία',
  IN_PACKAGING: 'Συσκευασία & Σήμανση',
  IN_STERILIZATION: 'Αποστείρωση',
  AWAITING_RELEASE: 'Αναμονή αποδέσμευσης',
  IN_STORAGE: 'Αποθήκευση',
  READY_FOR_PICKUP: 'Έτοιμο για παραλαβή',
  IN_STOCK: 'Stock',
  SERVICE: 'Service',
  LOST: 'Απολεσθέν',
  RETIRED: 'Εκτός χρήσης',
};
/** The label of an asset state in the current language. */
export const statusLabel = (value: string) => tr(labels[value] || value);
