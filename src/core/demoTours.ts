/**
 * Guided tours of an evaluation Demo: for each first-steps step, the places on the real screen to look at,
 * one after the other, each with a short note. A note waits for the person to press what it points at
 * (`advance: 'click'`) or for "Next". A place not on the screen yet (a dialog not open) is waited for.
 */
type Text = {el: string; en: string};
export type TourStop = {
  /** CSS selector of what the note points at; none: a note in the middle of the screen. */
  target?: string;
  title: Text;
  text: Text;
  /** Pressing what it points at moves on (the person does the action); otherwise "Next". */
  advance?: 'click';
};
export type Tour = {key: string; to: string; stops: TourStop[]};

const t = (el: string, en: string): Text => ({el, en});
const ROW_ACTION = '.ster-work-row .ster-row-action button';
const DIALOG_DONE = '.modal-backdrop .modal-actions .primary';

const TOURS: Tour[] = [
  {
    key: 'receive',
    to: '/sterilization',
    stops: [
      {
        target: '[data-tour="queue-INCOMING"]',
        title: t('Τι έρχεται από τα τμήματα', 'What comes back from the departments'),
        text: t(
          'Η καρτέλα «Παραλαβή» δείχνει τα Σετ και τα εργαλεία που έστειλαν τα τμήματα. Πατήστε την.',
          'The «Receipt» tab shows the Sets and instruments the departments sent. Press it.',
        ),
        advance: 'click',
      },
      {
        target: '[data-tour="ster-scan"]',
        title: t('Σάρωση barcode', 'Scan a barcode'),
        text: t(
          'Με scanner ή πληκτρολογώντας το barcode, το Σετ ανοίγει κατευθείαν. Μπορείτε και να το επιλέξετε από τη λίστα.',
          'With a scanner or by typing the barcode, the Set opens at once. You can also pick it from the list.',
        ),
      },
      {
        target: ROW_ACTION,
        title: t('Παραλαβή', 'Receive'),
        text: t('Πατήστε «Παραλαβή» σε μια γραμμή.', 'Press «Receive» on a row.'),
        advance: 'click',
      },
      {
        target: '.identity-work-section',
        title: t('Ποιος το φέρνει', 'Who brings it'),
        text: t(
          'Επιλέξτε ποιος παραδίδει και δηλώστε τυχόν εμφανή απόκλιση. Η αλυσίδα φύλαξης καταγράφεται με το όνομα και την ώρα.',
          'Choose who delivers it and note any visible deviation. The chain of custody is recorded with the name and time.',
        ),
      },
      {
        target: DIALOG_DONE,
        title: t('Ολοκλήρωση', 'Complete'),
        text: t('Πατήστε για να καταγραφεί η παραλαβή.', 'Press to record the receipt.'),
        advance: 'click',
      },
    ],
  },
  {
    key: 'prepare',
    to: '/sterilization',
    stops: [
      {
        target: '[data-tour="queue-PREP"]',
        title: t('Σύνθεση', 'Composition'),
        text: t(
          'Μετά τον καθαρισμό, τα Σετ περιμένουν έλεγχο σύνθεσης. Πατήστε την καρτέλα «Σύνθεση».',
          'After washing, Sets wait for their composition check. Press the «Composition» tab.',
        ),
        advance: 'click',
      },
      {
        target: ROW_ACTION,
        title: t('Έλεγχος & Σύνθεση', 'Check & assemble'),
        text: t('Ανοίξτε ένα Σετ.', 'Open a Set.'),
        advance: 'click',
      },
      {
        target: '.prep-tools-panel',
        title: t('Εργαλείο προς εργαλείο', 'Instrument by instrument'),
        text: t(
          'Τσεκάρετε όσα είναι εντάξει· για ένα που λείπει ή χάλασε, πατήστε «Αντιμετώπιση» (αντικατάσταση, Service, έλλειψη).',
          'Tick the ones that are fine; for one missing or damaged, press «Handle» (replace, service, shortage).',
        ),
      },
      {
        target: '.prep-quality-section',
        title: t('Έλεγχοι πριν τον κλιβανισμό', 'Checks before sterilizing'),
        text: t(
          'Επιβεβαιώστε τους ελέγχους της ροής του νοσοκομείου σας.',
          'Confirm the checks of your hospital’s flow.',
        ),
      },
      {
        target: DIALOG_DONE,
        title: t('Προς κλιβανισμό', 'On to sterilizing'),
        text: t('Πατήστε για να ολοκληρωθεί η προετοιμασία.', 'Press to complete the preparation.'),
        advance: 'click',
      },
    ],
  },
  {
    key: 'cycle',
    to: '/sterilization',
    stops: [
      {
        target: '[data-tour="queue-PROCESS"]',
        title: t('Φόρτωση κλιβάνου', 'Sterilizer load'),
        text: t('Πατήστε την καρτέλα «Φόρτωση».', 'Press the «Load» tab.'),
        advance: 'click',
      },
      {
        target: '[data-tour="ster-panel-actions"]',
        title: t('Ένας κύκλος για όλα', 'One cycle for all'),
        text: t(
          'Επιλέξτε τα Σετ που μπαίνουν μαζί και πατήστε «Φόρτωση κλιβάνου».',
          'Pick the Sets that go in together and press «Sterilizer load».',
        ),
        advance: 'click',
      },
      {
        target: '.load-modal .cycle-clean-fields',
        title: t('Κλίβανος, κύκλος, πρόγραμμα', 'Sterilizer, cycle, program'),
        text: t(
          'Ο κύκλος συνδέεται με κάθε Σετ: αργότερα ξέρετε σε ποιον κύκλο αποστειρώθηκε το καθένα.',
          'The cycle is linked to every Set: later you know which cycle each was sterilized in.',
        ),
      },
      {
        target: DIALOG_DONE,
        title: t('Έναρξη κύκλου', 'Start the cycle'),
        text: t('Πατήστε για να μπει το φορτίο στον κλίβανο.', 'Press to put the load in the sterilizer.'),
        advance: 'click',
      },
    ],
  },
  {
    key: 'release',
    to: '/sterilization',
    stops: [
      {
        target: '[data-tour="queue-RELEASE"]',
        title: t('Αποδέσμευση', 'Release'),
        text: t(
          'Όταν τελειώσει ο κύκλος, το φορτίο περιμένει εδώ. Πατήστε την καρτέλα «Αποδέσμευση».',
          'When the cycle ends, the load waits here. Press the «Release» tab.',
        ),
        advance: 'click',
      },
      {
        target: '[data-tour="ster-panel-actions"]',
        title: t('Δείκτες και έγκριση', 'Indicators and approval'),
        text: t(
          'Ανοίξτε την αποδέσμευση του φορτίου: παράμετροι κύκλου, χημικός και βιολογικός δείκτης, συσκευασία.',
          'Open the load’s release: cycle parameters, chemical and biological indicator, packaging.',
        ),
        advance: 'click',
      },
      {
        target: DIALOG_DONE,
        title: t('Αποδέσμευση', 'Release'),
        text: t('Πατήστε για να αποδεσμευτεί το φορτίο.', 'Press to release the load.'),
        advance: 'click',
      },
    ],
  },
  {
    key: 'deliver',
    to: '/sterilization',
    stops: [
      {
        target: '[data-tour="queue-READY"]',
        title: t('Έτοιμα για παράδοση', 'Ready to deliver'),
        text: t('Πατήστε την καρτέλα «Παράδοση».', 'Press the «Delivery» tab.'),
        advance: 'click',
      },
      {
        target: ROW_ACTION,
        title: t('Παράδοση', 'Deliver'),
        text: t('Πατήστε «Παράδοση» σε μια γραμμή.', 'Press «Deliver» on a row.'),
        advance: 'click',
      },
      {
        target: '.workflow-modal-delivery .delivery-pair',
        title: t('Υπογραφή παραλήπτη', 'The receiver signs'),
        text: t(
          'Ο παραλήπτης του τμήματος υπογράφει με τον κωδικό του· η παράδοση καταγράφεται στο όνομά του.',
          'The department’s receiver signs with their code; the delivery is recorded in their name.',
        ),
      },
    ],
  },
  {
    key: 'trace',
    to: '/traceability',
    stops: [
      {
        target: '.trace-search',
        title: t('Αναζήτηση', 'Search'),
        text: t(
          'Γράψτε ένα barcode Σετ ή έναν κωδικό ασθενή: βλέπετε όλη τη διαδρομή, κύκλο, παραλαβές και παραδόσεις.',
          'Type a Set barcode or a patient code: you see the whole path, cycle, receipts and deliveries.',
        ),
      },
    ],
  },
  {
    key: 'reports',
    to: '/reports',
    stops: [
      {
        target: '.reports-catalog-head',
        title: t('Οι αναφορές', 'The reports'),
        text: t('Επιλέξτε μια αναφορά από τον κατάλογο.', 'Pick a report from the catalogue.'),
      },
      {
        target: '[data-tour="report-download"]',
        title: t('Λήψη', 'Download'),
        text: t('Κατεβάστε την σε Excel ή PDF, ή εκτυπώστε την.', 'Download it as Excel or PDF, or print it.'),
      },
    ],
  },
  {
    key: 'invite',
    to: '/hospital',
    stops: [
      {
        target: '[data-tour="add-user"]',
        title: t('Πρόσκληση συναδέλφου', 'Invite a colleague'),
        text: t(
          'Προσθέστε έναν συνάδελφο από την Αποστείρωση ή ένα τμήμα, για να δοκιμάσετε μαζί τη ροή.',
          'Add a colleague from Sterilization or a department, to try the flow together.',
        ),
        advance: 'click',
      },
    ],
  },
  {
    key: 'department',
    to: '/department',
    stops: [
      {
        target: '.department-kpis',
        title: t('Με μια ματιά', 'At a glance'),
        text: t(
          'Πόσα Σετ είναι στο τμήμα, στην Αποστείρωση ή έτοιμα για παραλαβή.',
          'How many Sets are in the department, in Sterilization or ready to collect.',
        ),
      },
      {
        target: '.department-asset-list',
        title: t('Τα Σετ σας', 'Your Sets'),
        text: t(
          'Κάθε Σετ με την κατάστασή του και τη λήξη αποστείρωσης. Πατήστε ένα για όλη την καρτέλα του.',
          'Each Set with its state and sterile expiry. Press one for its whole record.',
        ),
      },
    ],
  },
];

/** The tour of a first-steps step, if it has one. */
export const tourFor = (key: string): Tour | undefined => TOURS.find(tour => tour.key === key);

/** Where a tour's progress and rating are kept (demo_guide_progress / demo_feedback keys). */
export const tourTopic = (key: string) => `tour_${key}`;
/** A screen's rating topic: its path in lower-case letters and underscores. */
export const screenTopic = (pathname: string) =>
  `screen_${
    pathname
      .split('/')
      .filter(Boolean)[0]
      ?.toLowerCase()
      .replace(/[^a-z]+/g, '_')
      .slice(0, 30) || 'home'
  }`;

/** The screens a rating can be about, by their topic, for the platform owner's view. */
const SCREEN_TITLES: Record<string, Text> = {
  overview: t('Επισκόπηση', 'Overview'),
  sterilization: t('Αποστείρωση', 'Sterilization'),
  issues: t('Εκκρεμότητες', 'Issues'),
  expiry: t('Λήξεις', 'Expiries'),
  sets: t('Σετ εργαλείων', 'Instrument Sets'),
  tools: t('Εργαλεία', 'Instruments'),
  standalone_tools: t('Μεμονωμένα', 'Standalone'),
  stock: t('Απόθεμα εργαλείων', 'Instrument stock'),
  devices: t('Συσκευές', 'Devices'),
  traceability: t('Ιχνηλάτηση', 'Traceability'),
  reports: t('Αναφορές', 'Reports'),
  movements: t('Ιστορικό', 'History'),
  department: t('Σετ & Εργαλεία τμήματος', 'Department Sets & Instruments'),
  hospital: t('Χρήστες & Τμήματα', 'Users & Departments'),
  studio: t('SurgiTrack Studio', 'SurgiTrack Studio'),
};

/** What a tour or screen rating is about («Ξενάγηση · Παραλαβή», «Οθόνη · Σετ εργαλείων»); none for others. */
export const tourOrScreenTitle = (topic: string, stepTitle: (key: string) => Text | undefined): Text | undefined => {
  if (topic.startsWith('tour_')) {
    const title = stepTitle(topic.slice(5));
    return title && t(`Ξενάγηση · ${title.el}`, `Tour · ${title.en}`);
  }
  if (topic.startsWith('screen_')) {
    const key = topic.slice(7);
    const title = SCREEN_TITLES[key];
    return t(`Οθόνη · ${title?.el || key}`, `Screen · ${title?.en || key}`);
  }
  return undefined;
};
