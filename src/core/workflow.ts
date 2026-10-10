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
/**
 * Washing goes through a washer load (washer, cycle and program recorded for every item). Washing an item
 * without one (manual cleaning) is offered only where the hospital allows it.
 */
export type SterilizationWashingPolicy = {allowWithoutWasher: boolean};
export type SterilizationWorkflowConfig = {
  profileName: string;
  version: number;
  updatedAt: string;
  updatedBy?: string;
  receiptPolicy: SterilizationReceiptPolicy;
  releasePolicy: SterilizationReleasePolicy;
  /** Absent in workflows saved before it: washing without a washer is then not allowed. */
  washingPolicy?: SterilizationWashingPolicy;
  stages: WorkflowStageConfig[];
};

export const defaultSterilizationWorkflow: SterilizationWorkflowConfig = {
  profileName: 'Πλήρης ροή CSSD',
  version: 1,
  updatedAt: '',
  receiptPolicy: {countSetsAtReceipt: false, allowCrossDepartmentHandover: true},
  releasePolicy: {requireChemicalIndicator: false, biologicalIndicator: 'OPTIONAL', allowReleaseWhileBiPending: false},
  washingPolicy: {allowWithoutWasher: false},
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
      descriptionEl: 'Έλεγχος περιέκτη / αποστειρωμένης συσκευασίας, σήμανσης και δείκτη.',
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
      labelEl: 'Φόρτωση κλιβάνου',
      labelEn: 'Sterilizer load',
      descriptionEl: 'Επιλογή κλιβάνου, φορτίου και προγράμματος· όλα τα Σετ και εργαλεία μπαίνουν μαζί σε έναν κύκλο.',
      descriptionEn: 'Choose the sterilizer, load and program; all Sets and instruments go into one cycle together.',
      checksEl: ['Καταγραφή κύκλου'],
      checksEn: ['Cycle record'],
    },
    {
      id: 'RELEASE',
      enabled: true,
      // Every sterilizer load ends here: indicators and approval before anything goes back to a department.
      locked: true,
      labelEl: 'Αποδέσμευση φορτίου',
      labelEn: 'Load Release',
      descriptionEl: 'Υποχρεωτικός έλεγχος δεικτών και έγκριση πριν την παράδοση.',
      descriptionEn: 'Required indicator check and approval before delivery.',
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
      descriptionEl: 'Ταυτοποίηση παραλαμβάνοντα και ολοκλήρωση της αλυσίδας φύλαξης.',
      descriptionEn: 'Receiver identification and chain-of-custody completion.',
      checksEl: ['Ταυτοποίηση παραλαμβάνοντα'],
      checksEn: ['Receiver identification'],
    },
  ],
};

/**
 * A workflow saved before the stage was renamed keeps its old wording: «Αποστείρωση» becomes
 * «Φόρτωση κλιβάνου» (only when the hospital has not renamed it itself). Stage descriptions still in their
 * old default wording (English terms since put in Greek) take the current default, and only those.
 */
const OLD_DESCRIPTIONS_EL = new Set([
  'Έλεγχος περιέκτη / sterile barrier, σήμανσης και δείκτη.',
  'Ταυτοποίηση παραλαμβάνοντα και ολοκλήρωση chain of custody.',
]);
export const upgradeWorkflowLabels = (workflow: SterilizationWorkflowConfig): SterilizationWorkflowConfig => {
  const fresh = defaultSterilizationWorkflow.stages.find(stage => stage.id === 'STERILIZATION');
  const oldLabel = (stage: WorkflowStageConfig) => stage.id === 'STERILIZATION' && stage.labelEl === 'Αποστείρωση';
  // Load release is required: a saved workflow that left it off (or unlocked) gets it back on and locked.
  const releaseOff = (stage: WorkflowStageConfig) => stage.id === 'RELEASE' && (!stage.enabled || !stage.locked);
  const oldDescription = (stage: WorkflowStageConfig) => OLD_DESCRIPTIONS_EL.has(stage.descriptionEl);
  if (!workflow.stages?.some(stage => (fresh && oldLabel(stage)) || releaseOff(stage) || oldDescription(stage)))
    return workflow;
  return {
    ...workflow,
    stages: workflow.stages.map(stage => {
      if (fresh && oldLabel(stage))
        return {
          ...stage,
          labelEl: fresh.labelEl,
          labelEn: fresh.labelEn,
          descriptionEl: fresh.descriptionEl,
          descriptionEn: fresh.descriptionEn,
        };
      const upgraded = releaseOff(stage) ? {...stage, enabled: true, locked: true} : stage;
      const current = defaultSterilizationWorkflow.stages.find(item => item.id === stage.id);
      return oldDescription(stage) && current ? {...upgraded, descriptionEl: current.descriptionEl} : upgraded;
    }),
  };
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
 * The state an item is handled in. An item left in a stage that has since been turned off (e.g. in packaging
 * when the hospital no longer packs separately) is handled by the next enabled stage, so nothing stays stuck in a
 * stage no screen shows and no stage step (e.g. the sterile duration) is asked twice.
 */
export function effectiveState(stages: readonly WorkflowStageConfig[], state: string): string {
  const stage = stages.find(item => workflowStageState[item.id] === state);
  return !stage || stage.enabled ? state : nextStateAfter(stages, stage.id);
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

export type SterilizationWorkflowVersion = {
  id: string;
  version: number;
  profileName: string;
  effectiveFrom: string;
  changedBy: string;
  changeReason?: string;
  snapshot: SterilizationWorkflowConfig;
};
