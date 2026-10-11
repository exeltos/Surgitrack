import {tr} from '../../i18n';

const labels: Record<string, string> = {
  IN_DEPARTMENT: 'Στο τμήμα',
  PENDING_STERILIZATION: 'Αναμονή παραλαβής',
  IN_WASHING: 'Σε καθαρισμό',
  IN_PREPARATION: 'Σε σύνθεση',
  IN_PACKAGING: 'Σε συσκευασία',
  IN_STERILIZATION: 'Στον κλίβανο',
  AWAITING_RELEASE: 'Αναμονή αποδέσμευσης',
  IN_STORAGE: 'Σε αποθήκευση',
  READY_FOR_PICKUP: 'Έτοιμο για παραλαβή',
  IN_STOCK: 'Απόθεμα',
  SERVICE: 'Service',
  LOST: 'Απολεσθέν',
  RETIRED: 'Εκτός χρήσης',
};
/** The label of an asset state in the current language. */
export const statusLabel = (value: string) => tr(labels[value] || value);
