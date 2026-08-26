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
};
export default function StatusBadge({value}: {value: string}) {
  return <span className={'badge badge-' + value.toLowerCase()}>{labels[value] || value}</span>;
}
