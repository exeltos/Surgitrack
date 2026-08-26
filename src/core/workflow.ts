export type WorkflowStageId =
  'RECEIPT' | 'WASHING' | 'PREPARATION' | 'PACKAGING' | 'STERILIZATION' | 'RELEASE' | 'STORAGE' | 'DELIVERY';
export type WorkflowStageConfig = {
  id: WorkflowStageId;
  enabled: boolean;
  locked: boolean;
  labelEl: string;
  labelEn: string;
  descriptionEl: string;
  descriptionEn: string;
  checksEl: string[];
  checksEn: string[];
};
export type SterilizationReleasePolicy = {
  requireChemicalIndicator: boolean;
  biologicalIndicator: 'OPTIONAL' | 'REQUIRED' | 'NOT_REQUIRED';
  allowReleaseWhileBiPending: boolean;
};
export type SterilizationReceiptPolicy = {countSetsAtReceipt: boolean; allowCrossDepartmentHandover: boolean};
export type SterilizationWorkflowConfig = {
  profileName: string;
  version: number;
  updatedAt: string;
  receiptPolicy: SterilizationReceiptPolicy;
  releasePolicy: SterilizationReleasePolicy;
  stages: WorkflowStageConfig[];
};

export const defaultSterilizationWorkflow: SterilizationWorkflowConfig = {
  profileName: 'Πλήρης ροή CSSD',
  version: 1,
  updatedAt: '',
  receiptPolicy: {countSetsAtReceipt: false, allowCrossDepartmentHandover: true},
  releasePolicy: {requireChemicalIndicator: true, biologicalIndicator: 'OPTIONAL', allowReleaseWhileBiPending: false},
  stages: [
    {
      id: 'RECEIPT',
      enabled: true,
      locked: true,
      labelEl: 'Παραλαβή',
      labelEn: 'Receipt',
      descriptionEl: 'Φυσική παραλαβή, αλυσίδα παράδοσης και δήλωση τυχόν εμφανής απόκλισης.',
      descriptionEn: 'Physical receipt, chain of custody and declaration of any visible deviation.',
      checksEl: ['Ταυτοποίηση παραδίδοντα', 'Επιβεβαίωση εμφανής απόκλισης'],
      checksEn: ['Sender identification', 'Visible deviation confirmation'],
    },
    {
      id: 'WASHING',
      enabled: true,
      locked: false,
      labelEl: 'Καθαρισμός & Απολύμανση',
      labelEn: 'Cleaning & Disinfection',
      descriptionEl: 'Τεκμηρίωση ολοκλήρωσης καθαρισμού / θερμικής ή άλλης απολύμανσης.',
      descriptionEn: 'Document completion of cleaning and thermal or other disinfection.',
      checksEl: [
        'Ο κύκλος καθαρισμού/απολύμανσης ολοκληρώθηκε',
        'Το φορτίο είναι οπτικά καθαρό',
        'Καταγράφηκε τυχόν απόκλιση',
      ],
      checksEn: ['Cleaning/disinfection cycle completed', 'Load is visually clean', 'Any deviation was documented'],
    },
    {
      id: 'PREPARATION',
      enabled: true,
      locked: false,
      labelEl: 'Έλεγχος & Σύνθεση',
      labelEn: 'Inspection & Assembly',
      descriptionEl: 'Έλεγχος εργαλείων, σύνθεση Σετ και διαχείριση αποκλίσεων.',
      descriptionEn: 'Instrument inspection, set assembly and deviation management.',
      checksEl: ['Έλεγχος λειτουργικότητας', 'Επιβεβαίωση σύνθεσης'],
      checksEn: ['Function check', 'Composition verification'],
    },
    {
      id: 'PACKAGING',
      enabled: true,
      locked: false,
      labelEl: 'Συσκευασία & Σήμανση',
      labelEn: 'Packaging & Labelling',
      descriptionEl: 'Έλεγχος περιέκτη / sterile barrier, σήμανσης και δείκτη.',
      descriptionEn: 'Check container / sterile barrier, labelling and indicator.',
      checksEl: [
        'Κατάλληλη και ακέραιη συσκευασία',
        'Σωστή σήμανση / ιχνηλασιμότητα',
        'Τοποθέτηση κατάλληλου χημικού δείκτη',
      ],
      checksEn: ['Suitable intact packaging', 'Correct label / traceability', 'Appropriate chemical indicator placed'],
    },
    {
      id: 'STERILIZATION',
      enabled: true,
      locked: true,
      labelEl: 'Αποστείρωση',
      labelEn: 'Sterilization',
      descriptionEl: 'Καταχώρηση κλιβάνου, φορτίου, προγράμματος και αποτελέσματος κύκλου.',
      descriptionEn: 'Record sterilizer, load, program and cycle result.',
      checksEl: ['Καταγραφή κύκλου'],
      checksEn: ['Cycle record'],
    },
    {
      id: 'RELEASE',
      enabled: true,
      locked: false,
      labelEl: 'Αποδέσμευση φορτίου',
      labelEn: 'Load Release',
      descriptionEl: 'Ανεξάρτητο quality gate πριν τη διάθεση ως έτοιμο.',
      descriptionEn: 'Independent quality gate before release as ready.',
      checksEl: ['Παράμετροι κύκλου αποδεκτές', 'Χημικός δείκτης αποδεκτός', 'Συσκευασία στεγνή και ακέραιη'],
      checksEn: ['Cycle parameters acceptable', 'Chemical indicator acceptable', 'Packaging dry and intact'],
    },
    {
      id: 'STORAGE',
      enabled: false,
      locked: false,
      labelEl: 'Αποθήκευση',
      labelEn: 'Storage',
      descriptionEl: 'Προαιρετικός έλεγχος ασφαλούς αποθήκευσης πριν την παράδοση.',
      descriptionEn: 'Optional safe-storage check before delivery.',
      checksEl: ['Κατάλληλη θέση αποθήκευσης', 'Ακεραιότητα συσκευασίας διατηρείται'],
      checksEn: ['Suitable storage location', 'Packaging integrity maintained'],
    },
    {
      id: 'DELIVERY',
      enabled: true,
      locked: true,
      labelEl: 'Παράδοση στο Τμήμα',
      labelEn: 'Department Delivery',
      descriptionEl: 'Ταυτοποίηση παραλαμβάνοντα και ολοκλήρωση chain of custody.',
      descriptionEn: 'Receiver identification and chain-of-custody completion.',
      checksEl: ['Ταυτοποίηση παραλαμβάνοντα'],
      checksEn: ['Receiver identification'],
    },
  ],
};

export const workflowStageState: Record<WorkflowStageId, string> = {
  RECEIPT: 'PENDING_STERILIZATION',
  WASHING: 'IN_WASHING',
  PREPARATION: 'IN_PREPARATION',
  PACKAGING: 'IN_PACKAGING',
  STERILIZATION: 'IN_STERILIZATION',
  RELEASE: 'AWAITING_RELEASE',
  STORAGE: 'IN_STORAGE',
  DELIVERY: 'READY_FOR_PICKUP',
};

/**
 * Given the facility's configured stage list and the stage that was just completed,
 * returns the asset state for the next *enabled* stage in sequence (disabled stages
 * are skipped). Falls back to 'READY_FOR_PICKUP' once there is no further enabled
 * stage after `stageId` — i.e. the asset is ready for department delivery.
 */
export function nextStateAfter(stages: readonly WorkflowStageConfig[], stageId: WorkflowStageId): string {
  const index = stages.findIndex(stage => stage.id === stageId);
  const next = stages.slice(index + 1).find(stage => stage.enabled);
  return next ? workflowStageState[next.id] : 'READY_FOR_PICKUP';
}

/**
 * Returns the asset state an item should return to when a load fails release/QA and
 * must be reprocessed. This is always the first enabled stage after RECEIPT (never
 * RECEIPT itself, since the item never physically left the facility), falling back to
 * 'IN_PREPARATION' if every intermediate stage has been disabled by facility policy.
 */
export function reprocessState(stages: readonly WorkflowStageConfig[]): string {
  const next = stages.filter(stage => stage.enabled).find(stage => stage.id !== 'RECEIPT');
  return next ? workflowStageState[next.id] : 'IN_PREPARATION';
}
