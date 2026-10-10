/**
 * The first-steps guide of a prospect's evaluation Demo. Each role gets a few real tasks; a step
 * is done when the person actually does it (a record they made, or their visit to a screen), never
 * by ticking it. "Show me" opens the screen and the Help Center on it.
 */
import type {UserRole} from '../store/types';

/** How the app sees that a step was done. */
export type StepCheck =
  /** A record in this table made by the person (the database stamps who recorded it). */
  | {kind: 'record'; table: string; column: 'created_by' | 'updated_by' | 'invited_by'}
  /** The person opened this screen. */
  | {kind: 'visit'};

export type GuideStep = {
  key: string;
  to: string;
  title: {el: string; en: string};
  text: {el: string; en: string};
  check: StepCheck;
};

const record = (table: string, column: 'created_by' | 'updated_by' | 'invited_by' = 'created_by'): StepCheck => ({
  kind: 'record',
  table,
  column,
});
const visit: StepCheck = {kind: 'visit'};

const STERILIZATION: GuideStep[] = [
  {
    key: 'receive',
    to: '/sterilization',
    title: {el: 'Παραλαβή από τμήμα', en: 'Receive from a department'},
    text: {
      el: 'Στην Αποστείρωση, σαρώστε ή επιλέξτε ένα Σετ που επέστρεψε και καταγράψτε την παραλαβή.',
      en: 'In Sterilization, scan or pick a Set that came back and record the receipt.',
    },
    check: record('receipts'),
  },
  {
    key: 'prepare',
    to: '/sterilization',
    title: {el: 'Σύνθεση και έλεγχος', en: 'Composition check'},
    text: {
      el: 'Ελέγξτε τη σύνθεση ενός Σετ εργαλείο προς εργαλείο και ολοκληρώστε την προετοιμασία.',
      en: 'Check a Set’s composition instrument by instrument and complete the preparation.',
    },
    check: record('preparations'),
  },
  {
    key: 'cycle',
    to: '/sterilization',
    title: {el: 'Κύκλος αποστείρωσης', en: 'Sterilization cycle'},
    text: {
      el: 'Φορτώστε Σετ σε κλίβανο και καταγράψτε τον κύκλο.',
      en: 'Load Sets into a sterilizer and record the cycle.',
    },
    check: record('sterilization_cycles'),
  },
  {
    key: 'release',
    to: '/sterilization',
    title: {el: 'Αποδέσμευση', en: 'Release'},
    text: {
      el: 'Ελέγξτε δείκτες και συσκευασία και αποδεσμεύστε τα Σετ του κύκλου.',
      en: 'Check the indicators and packaging and release the cycle’s Sets.',
    },
    check: record('sterilization_releases'),
  },
  {
    key: 'deliver',
    to: '/sterilization',
    title: {el: 'Παράδοση με υπογραφή', en: 'Signed delivery'},
    text: {
      el: 'Παραδώστε αποστειρωμένα Σετ σε τμήμα· ο παραλήπτης υπογράφει με τον κωδικό του.',
      en: 'Deliver sterile Sets to a department; the receiver signs with their code.',
    },
    check: record('deliveries'),
  },
  {
    key: 'trace',
    to: '/traceability',
    title: {el: 'Ιχνηλασιμότητα', en: 'Traceability'},
    text: {
      el: 'Αναζητήστε ένα Σετ ή έναν ασθενή και δείτε όλη τη διαδρομή του.',
      en: 'Look up a Set or a patient and see its whole path.',
    },
    check: visit,
  },
  {
    key: 'reports',
    to: '/reports',
    title: {el: 'Αναφορές', en: 'Reports'},
    text: {
      el: 'Ανοίξτε τις αναφορές και κατεβάστε μία σε Excel ή PDF.',
      en: 'Open the reports and download one as Excel or PDF.',
    },
    check: visit,
  },
];

const INVITE: GuideStep = {
  key: 'invite',
  to: '/hospital',
  title: {el: 'Πρόσκληση συναδέλφου', en: 'Invite a colleague'},
  text: {
    el: 'Στους Χρήστες, προσκαλέστε έναν συνάδελφο (π.χ. από την Αποστείρωση ή ένα τμήμα) να δοκιμάσει μαζί σας.',
    en: 'In Users, invite a colleague (e.g. from Sterilization or a department) to try it with you.',
  },
  check: record('staff_access_requests', 'invited_by'),
};

const DEPARTMENT: GuideStep[] = [
  {
    key: 'department',
    to: '/department',
    title: {el: 'Τα Σετ του τμήματος', en: 'Your department’s Sets'},
    text: {
      el: 'Δείτε ποια Σετ έχει το τμήμα σας και σε ποια κατάσταση είναι.',
      en: 'See which Sets your department holds and their state.',
    },
    check: visit,
  },
  {
    key: 'dispatch',
    to: '/department',
    title: {el: 'Αποστολή για αποστείρωση', en: 'Send for sterilization'},
    text: {
      el: 'Στείλτε ένα χρησιμοποιημένο Σετ στην Αποστείρωση.',
      en: 'Send a used Set to Sterilization.',
    },
    check: record('movements'),
  },
  {
    key: 'count',
    to: '/department',
    title: {el: 'Καταμέτρηση στο χειρουργείο', en: 'Count in theatre'},
    text: {
      el: 'Καταγράψτε την καταμέτρηση εργαλείων ενός Σετ για έναν ασθενή.',
      en: 'Record the instrument count of a Set for a patient.',
    },
    check: record('surgical_counts'),
  },
  {
    key: 'issue',
    to: '/issues',
    title: {el: 'Αναφορά ζητήματος', en: 'Report an issue'},
    text: {
      el: 'Αναφέρετε ένα φθαρμένο ή ελλείπον εργαλείο.',
      en: 'Report a worn or missing instrument.',
    },
    check: record('issues', 'updated_by'),
  },
  {
    key: 'history',
    to: '/movements',
    title: {el: 'Ιστορικό', en: 'History'},
    text: {
      el: 'Δείτε το ιστορικό κινήσεων του τμήματός σας.',
      en: 'See your department’s movement history.',
    },
    check: visit,
  },
];

const VIEWER: GuideStep[] = [
  {
    key: 'overview',
    to: '/overview',
    title: {el: 'Επισκόπηση', en: 'Overview'},
    text: {el: 'Δείτε την εικόνα όλου του νοσοκομείου.', en: 'See the whole hospital at a glance.'},
    check: visit,
  },
  STERILIZATION.find(s => s.key === 'trace')!,
  STERILIZATION.find(s => s.key === 'reports')!,
];

/** The steps for a role: the Demo's administrator also invites a colleague. */
export const guideSteps = (role: UserRole): GuideStep[] =>
  role === 'ADMIN'
    ? [...STERILIZATION, INVITE]
    : role === 'STERILIZATION'
      ? STERILIZATION
      : role === 'DEPARTMENT'
        ? DEPARTMENT
        : VIEWER;

/** A step by its key, whichever role's guide it is in. */
export const guideStep = (key: string): GuideStep | undefined =>
  [...STERILIZATION, INVITE, ...DEPARTMENT, ...VIEWER].find(s => s.key === key);

/** The visit steps a screen completes (a path and anything under it). */
export const visitStepsFor = (steps: GuideStep[], pathname: string) =>
  steps.filter(s => s.check.kind === 'visit' && (pathname === s.to || pathname.startsWith(`${s.to}/`)));

export const guideProgress = (steps: GuideStep[], done: ReadonlySet<string>) => ({
  done: steps.filter(s => done.has(s.key)).length,
  total: steps.length,
  next: steps.find(s => !done.has(s.key)),
});
