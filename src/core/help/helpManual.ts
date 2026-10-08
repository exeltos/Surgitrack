import type {Permission} from '../permissions';

/** One chapter of a screen's manual: title and body, in both languages. */
type Chapter = {el: [string, string]; en: [string, string]};

export type ManualSection = {
  /** Route the section belongs to; the Help Center opens on the section of the current screen. */
  to: string;
  /** Shown only to users with this permission (the same one that opens the screen). */
  permission?: Permission;
  /** A record card rather than a menu page: the paths it covers (e.g. '/tools/'), no "Open screen". */
  detailOf?: string[];
  /** A screen opened from other pages rather than the menu: shown when one of them is in the menu. */
  openedFrom?: string[];
  /** A guide rather than a screen (no screen preview, no "Open screen"); `to` is only its id. */
  guide?: boolean;
  title: {el: string; en: string};
  summary: {el: string; en: string};
  audience: {el: string; en: string};
  chapters: Chapter[];
  steps: {el: string[]; en: string[]};
  checks?: {el: string[]; en: string[]};
  tip?: {el: string; en: string};
  related?: string[];
};

export const helpManual: ManualSection[] = [
  {
    to: '/start',
    guide: true,
    title: {el: 'Ξεκινώντας', en: 'Getting started'},
    summary: {
      el: 'Η πρώτη σας σύνδεση, τι βλέπετε στην οθόνη και πού ζητάτε βοήθεια.',
      en: 'Your first sign-in, what you see on screen and where to ask for help.',
    },
    audience: {el: 'Όλοι οι χρήστες', en: 'All users'},
    chapters: [
      {
        el: [
          'Λογαριασμός',
          'Λογαριασμό ανοίγει μόνο ο διαχειριστής του νοσοκομείου σας. Αν σας έστειλε πρόσκληση ή σύνδεσμο εγγραφής, συμπληρώνετε ονοματεπώνυμο και τμήμα και περιμένετε την έγκρισή του· κωδικό δεν ορίζετε ακόμη.',
        ],
        en: [
          'Account',
          'Only your hospital administrator opens accounts. If you got an invitation or a signup link, you fill in your name and department and wait for approval; you do not set a password yet.',
        ],
      },
      {
        el: [
          'Πολλές συσκευές',
          'Μπορείτε να δουλεύετε από πολλούς υπολογιστές και tablet μαζί. Κάθε οθόνη παίρνει ό,τι αποθήκευσαν οι άλλες κάθε λίγα δευτερόλεπτα και μόλις επιστρέψετε στο παράθυρο· ό,τι έχετε αλλάξει εσείς αποθηκεύεται πρώτα. Αν χαθεί το δίκτυο, εμφανίζεται κάτω στην οθόνη η ειδοποίηση «Χωρίς σύνδεση στο δίκτυο»: ό,τι καταχωρίσετε κρατιέται στη σελίδα και αποθηκεύεται μόλις επανέλθει η σύνδεση, αρκεί να μην κλείσετε ή ανανεώσετε τη σελίδα. Η πάνω μπάρα δείχνει «Αποθήκευση…» ή «Δεν αποθηκεύτηκε · νέα προσπάθεια» όσο υπάρχουν αλλαγές σε αναμονή.',
        ],
        en: [
          'Several devices',
          'You can work from several computers and tablets at once. Each screen takes what the others saved every few seconds and as soon as you come back to the window; your own changes are saved first. If the network drops, a "No network connection" notice appears at the bottom of the screen: what you record is kept on the page and saved as soon as the connection is back, as long as you do not close or reload the page. The top bar shows "Saving…" or "Not saved · retrying" while changes are waiting.',
        ],
      },
      {
        el: [
          'Πρώτη σύνδεση',
          'Μετά την έγκριση λαμβάνετε email «Η πρόσβασή σας εγκρίθηκε» με το όνομα χρήστη σας (π.χ. GN1234), τον ρόλο και το τμήμα σας. Πατήστε «Ορισμός κωδικού», ορίστε κωδικό τουλάχιστον 8 χαρακτήρων και συνδεθείτε με το όνομα χρήστη ή το email σας.',
        ],
        en: [
          'First sign-in',
          'Once approved you get an "Access approved" email with your username (e.g. GN1234), your role and your department. Press "Set password", choose a password of at least 8 characters and sign in with your username or email.',
        ],
      },
      {
        el: [
          'Η οθόνη σας',
          'Το μενού αριστερά δείχνει μόνο όσα επιτρέπει ο ρόλος σας. Μετά τη σύνδεση ανοίγει η Επισκόπηση, αν υπάρχει στο μενού σας· αλλιώς η πρώτη επιλογή του μενού. Στο πεδίο σάρωσης της πάνω μπάρας σαρώνετε ή γράφετε barcode και ανοίγει αμέσως το Σετ ή το εργαλείο. Πάνω δεξιά: γλώσσα (EL/EN), Βοήθεια, προσβασιμότητα (μέγεθος κειμένου, αντίθεση) και ειδοποιήσεις.',
        ],
        en: [
          'Your screen',
          'The menu on the left shows only what your role allows. After signing in the Overview opens if your menu has it; otherwise the first entry of your menu. In the scan field of the top bar, scan or type a barcode and the Set or instrument opens at once. Top right: language (EL/EN), Help, accessibility (text size, contrast) and notifications.',
        ],
      },
      {
        el: [
          'Ξεχάσατε τον κωδικό',
          'Στη σελίδα σύνδεσης πατήστε «Ξέχασα τον κωδικό» και γράψτε το email σας· θα λάβετε σύνδεσμο για νέο κωδικό. Μετά από πολλές λάθος προσπάθειες η σύνδεση κλειδώνει για 15 λεπτά. Ο διαχειριστής μπορεί επίσης να σας στείλει σύνδεσμο αλλαγής κωδικού.',
        ],
        en: [
          'Forgotten password',
          'On the sign-in page press "Forgot password" and enter your email; you will get a link to a new password. After many wrong attempts sign-in locks for 15 minutes. The administrator can also send you a password change link.',
        ],
      },
    ],
    steps: {
      el: [
        'Ανοίξτε το email έγκρισης και κρατήστε το όνομα χρήστη.',
        'Πατήστε «Ορισμός κωδικού» και ορίστε κωδικό.',
        'Συνδεθείτε και ανοίξτε τη Βοήθεια (το βιβλίο πάνω δεξιά) σε κάθε οθόνη που δεν γνωρίζετε.',
      ],
      en: [
        'Open the approval email and keep your username.',
        'Press "Set password" and choose a password.',
        'Sign in and open Help (the book icon, top right) on any screen you do not know.',
      ],
    },
    checks: {
      el: [
        'Βλέπετε το σωστό τμήμα και ρόλο; Αν όχι, ενημερώστε τον διαχειριστή του νοσοκομείου.',
        'Μην μοιράζεστε τον κωδικό σας: κάθε κίνηση καταγράφεται με το όνομά σας.',
      ],
      en: [
        'Do you see the right department and role? If not, tell the hospital administrator.',
        'Do not share your password: every movement is recorded under your name.',
      ],
    },
    tip: {
      el: 'Η Βοήθεια ανοίγει πάντα στη σελίδα της οθόνης που βλέπετε. Για πρόσβαση, κωδικό ή δικαιώματα απευθυνθείτε στον διαχειριστή του νοσοκομείου· για τεχνικό πρόβλημα δείτε «Υποστήριξη».',
      en: 'Help always opens on the page of the screen you are on. For access, password or permissions ask the hospital administrator; for a technical problem see "Support".',
    },
  },
  {
    to: '/start-admin',
    guide: true,
    permission: 'studio.manage',
    openedFrom: ['/hospital'],
    title: {el: 'Από την αγορά στη λειτουργία', en: 'From purchase to go-live'},
    summary: {
      el: 'Τα βήματα του διαχειριστή του νοσοκομείου, με τη σειρά, από τον πρώτο λογαριασμό έως την πρώτη μέρα πραγματικής χρήσης.',
      en: "The hospital administrator's steps, in order, from the first account to the first day of real use.",
    },
    audience: {el: 'Διαχειριστής νοσοκομείου', en: 'Hospital administrator'},
    chapters: [
      {
        el: [
          'Ο λογαριασμός σας',
          'Η Exeltos δημιουργεί το νοσοκομείο σας και σας στέλνει πρόσκληση διαχειριστή. Από το email ορίζετε κωδικό και συνδέεστε. Αν το νοσοκομείο είναι σε δοκιμαστική περίοδο, όταν λήξει η εφαρμογή κλειδώνει μέχρι την ενεργοποίηση.',
        ],
        en: [
          'Your account',
          'Exeltos creates your hospital and sends you an administrator invitation. From the email you set a password and sign in. If the hospital is on a trial, the app locks when it ends until activation.',
        ],
      },
      {
        el: [
          'Τμήματα και βιβλιοθήκες',
          'Στη Χρήστες & Τμήματα → Τμήματα προσθέστε όλα τα τμήματα (Χειρουργείο, ΜΕΘ, Κεντρική Αποστείρωση…). Στο Studio → Βιβλιοθήκες ελέγξτε ειδικότητες, κατασκευαστές, κλιβάνους και χρωματικές ταινίες· στη Ροή Αποστείρωσης τα στάδια.',
        ],
        en: [
          'Departments and libraries',
          'In Users & departments → Departments add every department (Operating theatre, ICU, Central Sterilization…). In Studio → Libraries check specialties, manufacturers, sterilizers and color tapes; in Sterilization Flow the stages.',
        ],
      },
      {
        el: [
          'Εργαλεία και Σετ',
          'Ετοιμάστε το Excel με το «Πρότυπο Excel» της Μαζικής εισαγωγής (Εργαλεία ή Σετ → «Μαζική εισαγωγή»): μία γραμμή ανά εργαλείο, το όνομα του Σετ σε κάθε γραμμή του. Ελέγξτε την προεπισκόπηση και εισάγετε. Μετά τρέξτε τον «Έλεγχο ονομασιών» ώστε κάθε κωδικός να έχει μία ονομασία.',
        ],
        en: [
          'Instruments and Sets',
          'Prepare the Excel file with the "Excel template" of Bulk import (Instruments or Sets → "Bulk import"): one row per instrument, the Set name on each of its rows. Check the preview and import. Then run the "Name check" so each code has one name.',
        ],
      },
      {
        el: [
          'Προσωπικό',
          'Στη Χρήστες & Τμήματα → Χρήστες: «Πρόσκληση» για έναν έναν, «Σύνδεσμος εγγραφής» για πολλούς ή «Από αρχείο CSV». Πρώτα τον Προϊστάμενο Αποστείρωσης, μετά Αποστείρωση και τμήματα. Εγκρίνετε τις αιτήσεις (πορτοκαλί) με τον σωστό ρόλο και τμήμα.',
        ],
        en: [
          'Staff',
          'In Users & departments → Users: "Invite" one by one, "Signup link" for many or "From CSV file". First the Sterilization supervisor, then Sterilization and the departments. Approve the requests (orange) with the right role and department.',
        ],
      },
      {
        el: [
          'Εξοπλισμός',
          'Εκτυπωτής ετικετών barcode στην Αποστείρωση, σαρωτής barcode (USB ή Bluetooth, λειτουργεί ως πληκτρολόγιο) σε κάθε σημείο παράδοσης-παραλαβής, υπολογιστής ή tablet με Chrome ή Edge. Αν οι κλίβανοι θα συνδεθούν, δείτε «Συνδεδεμένες συσκευές».',
        ],
        en: [
          'Equipment',
          'A barcode label printer in Sterilization, a barcode scanner (USB or Bluetooth, works as a keyboard) at every handover point, a computer or tablet with Chrome or Edge. If sterilizers will be connected, see "Connected devices".',
        ],
      },
      {
        el: [
          'Εκπαίδευση και έναρξη',
          'Εκπαιδεύστε το προσωπικό στο Demo: ίδιες οθόνες με δοκιμαστικά δεδομένα· την πρόσβαση Demo την ανοίγετε ανά χρήστη στη Χρήστες & Τμήματα. Κολλήστε ετικέτες στα Σετ και στα εργαλεία, ορίστε μέρα έναρξης και από εκείνη τη μέρα κάθε παράδοση και παραλαβή γίνεται με σάρωση.',
        ],
        en: [
          'Training and go-live',
          'Train staff in the Demo: the same screens with test data; you turn Demo access on per user in Users & departments. Label the Sets and instruments, set a start day and from that day every handover and receipt is done by scanning.',
        ],
      },
    ],
    steps: {
      el: [
        'Συνδεθείτε ως διαχειριστής από την πρόσκληση της Exeltos.',
        'Τμήματα, βιβλιοθήκες και ροή αποστείρωσης.',
        'Μαζική εισαγωγή εργαλείων και Σετ, μετά Έλεγχος ονομασιών.',
        'Προσκλήσεις και εγκρίσεις προσωπικού.',
        'Εκτυπωτής, σαρωτές, ετικέτες.',
        'Εκπαίδευση στο Demo και μέρα έναρξης.',
      ],
      en: [
        'Sign in as administrator from the Exeltos invitation.',
        'Departments, libraries and sterilization flow.',
        'Bulk import of instruments and Sets, then Name check.',
        'Staff invitations and approvals.',
        'Printer, scanners, labels.',
        'Training in the Demo and a start day.',
      ],
    },
    checks: {
      el: [
        'Όλα τα τμήματα υπάρχουν και είναι ενεργά.',
        'Τα Σετ έχουν σωστή σύνθεση και τμήμα· ο Έλεγχος ονομασιών δεν δείχνει εκκρεμότητες.',
        'Κάθε χρήστης έχει ρόλο και τμήμα· τουλάχιστον ένας Προϊστάμενος Αποστείρωσης.',
        'Ο εκτυπωτής τυπώνει ετικέτα και ο σαρωτής ανοίγει το Σετ από την πάνω μπάρα.',
        'Μία δοκιμαστική αποστολή και παραλαβή ολοκληρώθηκε από τμήμα και Αποστείρωση.',
      ],
      en: [
        'Every department exists and is active.',
        'Sets have the right composition and department; the Name check shows nothing pending.',
        'Every user has a role and department; at least one Sterilization supervisor.',
        'The printer prints a label and the scanner opens the Set from the top bar.',
        'One test dispatch and receipt was completed by a department and Sterilization.',
      ],
    },
    tip: {
      el: 'Για οποιοδήποτε βήμα χρειάζεστε βοήθεια, γράψτε στην Exeltos στο info@exeltos.com (δείτε «Υποστήριξη»).',
      en: 'For help with any step, write to Exeltos at info@exeltos.com (see "Support").',
    },
    related: ['/hospital', '/import', '/tools/names', '/studio'],
  },
  {
    to: '/asset-card',
    detailOf: ['/tools/', '/sets/'],
    permission: 'asset.detail.view',
    title: {el: 'Καρτέλα Σετ / εργαλείου', en: 'Set / instrument card'},
    summary: {
      el: 'Όλα όσα αφορούν ένα Σετ ή εργαλείο: στοιχεία, σύνθεση, ιστορικό, φωτογραφίες, χρήσεις και ενέργειες.',
      en: 'Everything about one Set or instrument: details, composition, history, photos, uses and actions.',
    },
    audience: {
      el: 'Όλοι οι χρήστες (οι ενέργειες εξαρτώνται από τον ρόλο)',
      en: 'All users (actions depend on the role)',
    },
    chapters: [
      {
        el: [
          'Στοιχεία',
          'Αριστερά φαίνονται barcode, κωδικός, τμήμα, ειδικότητα, κατασκευαστής, ιδιοκτησία και χρωματική σήμανση. Όσοι έχουν δικαίωμα τα αλλάζουν με «Επεξεργασία».',
        ],
        en: [
          'Details',
          'On the left: barcode, code, department, specialty, manufacturer, ownership and color marker. Users with the right can change them with "Edit".',
        ],
      },
      {
        el: [
          'Χρήσεις και όρια',
          'Για εργαλεία περιορισμένων χρήσεων φαίνεται το υπόλοιπο χρήσεων. Κάθε αποστολή μετά από χρήση αφαιρεί μία χρήση· στο μηδέν το εργαλείο τίθεται αυτόματα εκτός χρήσης.',
        ],
        en: [
          'Uses and limits',
          'Limited-use instruments show their remaining uses. Each dispatch after use takes one use; at zero the instrument is taken out of use automatically.',
        ],
      },
      {
        el: [
          'Ιστορικό και φωτογραφίες',
          'Οι καρτέλες δείχνουν κάθε κίνηση, αναφορά προβλήματος και φωτογραφία του αντικειμένου.',
        ],
        en: ['History and photos', 'The tabs show every movement, problem report and photo of the item.'],
      },
      {
        el: [
          'Ενέργειες',
          'Ανάλογα με τον ρόλο: αποστολή προς Αποστείρωση, εκτύπωση barcode και, στο κουμπί «Ενέργειες», αναφορά προβλήματος και διαχείριση (τμήμα, Σετ, Απόθεμα, Service, απώλεια). Μια ενέργεια διαχείρισης αναιρείται από την ειδοποίηση για λίγα δευτερόλεπτα· το ιστορικό κρατά και την αναίρεση.',
        ],
        en: [
          'Actions',
          'Depending on the role: send to Sterilization, print the barcode and, under "Actions", report a problem and manage (department, Set, Stock, Service, loss). A management action can be undone from its notice for a few seconds; the history keeps the undo too.',
        ],
      },
    ],
    steps: {
      el: [
        'Ελέγξτε την κατάσταση και το υπόλοιπο χρήσεων.',
        'Δείτε το ιστορικό για την τελευταία κίνηση.',
        'Χρησιμοποιήστε την ενέργεια που χρειάζεστε από πάνω δεξιά.',
      ],
      en: [
        'Check the state and remaining uses.',
        'See the history for the last movement.',
        'Use the action you need from the top right.',
      ],
    },
  },
  {
    to: '/overview',
    permission: 'overview.view',
    title: {el: 'Επισκόπηση', en: 'Overview'},
    summary: {
      el: 'Όλο το νοσοκομείο με μια ματιά: Σετ, εργαλεία, ροή αποστείρωσης, εκκρεμότητες και όρια χρήσεων.',
      en: 'The whole hospital at a glance: Sets, instruments, sterilization flow, issues and usage limits.',
    },
    audience: {
      el: 'Διαχειριστής νοσοκομείου και Προϊστάμενος Αποστείρωσης',
      en: 'Hospital administrator and Sterilization supervisor',
    },
    chapters: [
      {
        el: [
          'Δείκτες (KPIs)',
          'Κάθε δείκτης στην κορυφή είναι σύνδεσμος. Πατώντας τον ανοίγει η αντίστοιχη λίστα με τα σωστά φίλτρα ήδη εφαρμοσμένα, π.χ. «Κοντά στο όριο χρήσεων» ανοίγει τα Εργαλεία με φίλτρο «Λίγες χρήσεις».',
        ],
        en: [
          'Indicators (KPIs)',
          'Every indicator at the top is a link. It opens the matching list with its filters already applied, e.g. "Near usage limit" opens Instruments filtered to "Few uses left".',
        ],
      },
      {
        el: [
          'Ανά τμήμα',
          'Ο πίνακας δείχνει τι έχει κάθε τμήμα: στο τμήμα, στην αποστείρωση, έτοιμα και εκκρεμότητες. Πατήστε το όνομα του τμήματος για να δείτε τα Σετ του.',
        ],
        en: [
          'By department',
          'The table shows what each department holds: at the department, in sterilization, ready and issues. Click a department name to see its Sets.',
        ],
      },
      {
        el: [
          'Ροή αποστείρωσης',
          'Οι μπάρες δείχνουν πόσα βρίσκονται σε κάθε στάδιο. Πατώντας ένα στάδιο ανοίγει η Αποστείρωση στην αντίστοιχη καρτέλα.',
        ],
        en: [
          'Sterilization flow',
          'The bars show how many items are at each stage. Clicking a stage opens Sterilization on that tab.',
        ],
      },
    ],
    steps: {
      el: [
        'Ξεκινήστε από τους δείκτες με πορτοκαλί χρώμα: χρειάζονται προσοχή.',
        'Πατήστε τον δείκτη για να δείτε ακριβώς ποια εγγραφές αφορά.',
        'Ελέγξτε τις τελευταίες κινήσεις για ό,τι έγινε πρόσφατα.',
      ],
      en: [
        'Start with the orange indicators: they need attention.',
        'Click an indicator to see exactly which records it counts.',
        'Check the latest movements for recent activity.',
      ],
    },
    tip: {
      el: 'Η Επισκόπηση είναι η αφετηρία της ημέρας: ό,τι είναι κόκκινο ή πορτοκαλί θέλει ενέργεια σήμερα.',
      en: 'The Overview is where the day starts: anything red or orange needs action today.',
    },
    related: ['/reports', '/issues', '/sterilization'],
  },
  {
    to: '/department',
    permission: 'department.workspace',
    title: {el: 'Σετ & Εργαλεία τμήματος', en: 'Department Sets & Instruments'},
    summary: {
      el: 'Τα Σετ και τα μεμονωμένα εργαλεία του τμήματος και η ηλεκτρονική αποστολή τους στην Κεντρική Αποστείρωση.',
      en: "The department's Sets and standalone instruments, and sending them electronically to Central Sterilization.",
    },
    audience: {el: 'Χρήστες τμήματος', en: 'Department users'},
    chapters: [
      {
        el: [
          'Τι βλέπω',
          'Στις δύο καρτέλες βλέπετε τα Σετ και τα μεμονωμένα εργαλεία του τμήματός σας. Οι δείκτες πάνω φιλτράρουν τη λίστα: «Στο τμήμα», «Προς / στην Αποστείρωση», «Έτοιμα για παραλαβή».',
        ],
        en: [
          'What I see',
          'The two tabs list your Sets and standalone instruments. The indicators above filter the list: "At department", "To / in Sterilization", "Ready for pickup".',
        ],
      },
      {
        el: [
          'Καταμέτρηση χειρουργείου',
          'Στα χειρουργεία (Studio → Βιβλιοθήκες → Τμήματα → «Καταμέτρηση») η «Αποστολή προς Αποστείρωση» ζητά πρώτα καταμέτρηση. Το κουμπί «Καταμέτρηση» ανοίγει το έντυπο: πάνω το μέρος της Αποστείρωσης (σύνθεση, αποδέσμευση, αποστείρωση και λήξη, κύκλος), κάτω τα εργαλεία με «Εστάλη» και «Καταμετρήθηκε». Γράφετε τον κωδικό ασθενούς, τσεκάρετε ή σαρώνετε κάθε εργαλείο ή πατάτε «Όλα παρόντα», και «Υπογραφή καταμέτρησης» (όνομα και ώρα). Μετά ενεργοποιείται η αποστολή. Αν λείπουν εργαλεία, ανοίγει εκκρεμότητα και η Αποστείρωση το βλέπει στην Παραλαβή. Το έντυπο τυπώνεται κενό ή υπογεγραμμένο, και από την Εκτύπωση του Σετ.',
        ],
        en: [
          'Surgical count',
          'In operating theatres (Studio → Libraries → Departments → "Count") "Send to Sterilization" asks for the count first. The "Count" button opens the form: Sterilization’s part on top (composition, release, sterilization and expiry, cycle), the instruments below with "Sent" and "Counted". Enter the patient code, tick or scan each instrument or press "All present", then "Sign the count" (name and time). Sending is then enabled. If instruments are missing, an issue opens and Sterilization sees it at Receipt. The form prints blank or signed, also from the Set’s Print menu.',
        ],
      },
      {
        el: [
          'Αποστολή προς Αποστείρωση',
          'Μετά τη χρήση πατήστε «Αποστολή προς Αποστείρωση». Ο κωδικός ασθενούς είναι προαιρετικός, εκτός αν το Σετ ή το εργαλείο έχει περιορισμένες χρήσεις.',
        ],
        en: [
          'Send to Sterilization',
          'After use, press "Send to Sterilization". The patient code is optional unless the Set or instrument has limited uses.',
        ],
      },
      {
        el: [
          'Εργαλεία με όριο χρήσεων',
          'Για εργαλεία πολλαπλών χρήσεων με όριο (π.χ. ρομποτικά), η αποστολή ζητά υποχρεωτικά κωδικό ασθενούς και επιβεβαίωση ότι χρησιμοποιήθηκε: καταγράφεται μία χρήση και φαίνεται το υπόλοιπο. Όταν εξαντληθούν οι χρήσεις, το εργαλείο τίθεται αυτόματα εκτός χρήσης.',
        ],
        en: [
          'Instruments with a usage limit',
          'For limited multi-use instruments (e.g. robotic), sending requires a patient code and confirming it was used: one use is recorded and the uses left are shown. When no uses are left the instrument is taken out of use automatically.',
        ],
      },
      {
        el: [
          'Αναφορά προβλήματος',
          'Αν λείπει ή έχει φθορά ένα εργαλείο, ανοίξτε το Σετ, πατήστε «Ενέργειες» → «Αναφορά προβλήματος» και δηλώστε το. Η Αποστείρωση το βλέπει στις Εκκρεμότητες.',
        ],
        en: [
          'Report a problem',
          'If an instrument is missing or damaged, open the Set, press "Actions" → "Report a problem" and describe it. Sterilization sees it under Issues.',
        ],
      },
    ],
    steps: {
      el: [
        'Βρείτε το Σετ ή το εργαλείο (αναζήτηση ή σάρωση barcode).',
        'Πατήστε «Αποστολή προς Αποστείρωση».',
        'Συμπληρώστε κωδικό ασθενούς όπου ζητείται και επιβεβαιώστε.',
        'Όταν γίνει «Έτοιμο για παραλαβή», παραλάβετε το από την Αποστείρωση υπογράφοντας με τον κωδικό χρήστη και το συνθηματικό σας.',
      ],
      en: [
        'Find the Set or instrument (search or scan the barcode).',
        'Press "Send to Sterilization".',
        'Enter the patient code where asked and confirm.',
        'When it shows "Ready for pickup", collect it from Sterilization, signing with your user code and password.',
      ],
    },
    checks: {
      el: [
        'Ο κωδικός ασθενούς δεν περιέχει ονοματεπώνυμο.',
        'Η χρήση καταγράφηκε για τα εργαλεία περιορισμένων χρήσεων.',
      ],
      en: ['The patient code contains no patient name.', 'The use was recorded for limited-use instruments.'],
    },
    tip: {
      el: 'Σαρώστε το barcode αντί να ψάχνετε με το όνομα: είναι πιο γρήγορο και αποφεύγει λάθη.',
      en: 'Scan the barcode instead of searching by name: it is faster and avoids mistakes.',
    },
    related: ['/issues', '/movements'],
  },
  {
    to: '/sterilization',
    permission: 'sterilization.workspace',
    title: {el: 'Αποστείρωση', en: 'Sterilization'},
    summary: {
      el: 'Η ροή της Κεντρικής Αποστείρωσης: παραλαβή, καθαρισμός, σύνθεση, συσκευασία, φόρτωση κλιβάνου, αποδέσμευση φορτίου, αποθήκευση και παράδοση.',
      en: 'The Central Sterilization flow: receipt, washing, preparation, packaging, sterilizer load, load release, storage and delivery.',
    },
    audience: {el: 'Χρήστες και Προϊστάμενος Αποστείρωσης', en: 'Sterilization users and supervisor'},
    chapters: [
      {
        el: [
          'Καρτέλες σταδίων',
          'Κάθε καρτέλα είναι ένα στάδιο. Ο αριθμός δείχνει πόσα περιμένουν. Τα στάδια που είναι απενεργοποιημένα στο Studio δεν εμφανίζονται. Η μπλε μπάρα «Αναζήτηση & σάρωση» φιλτράρει την καρτέλα καθώς γράφετε· με σάρωση barcode και Enter ανοίγει το αντικείμενο στο στάδιο όπου βρίσκεται. Δίπλα της είναι τα Φίλτρα (τμήμα, ειδικότητα, Σετ ή εργαλεία).',
        ],
        en: [
          'Stage tabs',
          'Each tab is a stage and its number shows how many are waiting. Stages disabled in Studio are not shown. The blue "Search & scan" bar filters the tab as you type; scanning a barcode and pressing Enter opens the item in its stage. The Filters (department, specialty, Sets or instruments) sit next to it.',
        ],
      },
      {
        el: [
          'Φυσική παραλαβή',
          'Στην «Παραλαβή» σαρώστε το Σετ και δηλώστε τυχόν εμφανή απόκλιση. Εσείς καταγράφεστε αυτόματα ως παραλαμβάνων· ο παραδίδων του τμήματος υπογράφει με τον κωδικό χρήστη και το συνθηματικό του. Αποκλίσεις (έλλειψη, φθορά) δημιουργούν εκκρεμότητα.',
        ],
        en: [
          'Physical receipt',
          'In "Receipt" scan the Set and declare any visible deviation. You are recorded automatically as the receiver; the department person handing it over signs with their user code and password. Deviations (missing, damaged) create an issue.',
        ],
      },
      {
        el: [
          'Εκκρεμότητες στη Σύνθεση',
          'Ό,τι χρειάζεται ενέργεια εμφανίζεται ως χρωματισμένη γραμμή στη λίστα εργαλείων του Σετ, με κουμπί «Αντιμετώπιση». Εργαλείο με βλάβη ή άλλη εκκρεμότητα: αντικατάσταση, Service, Απόθεμα ή μεταφορά σε άλλο Σετ. Εργαλείο που λείπει (γραμμή «Λείπει»): «Κάλυψη έλλειψης» με εργαλείο από Απόθεμα, άλλο Σετ ή μεμονωμένο, «Αναφορά», ή «Παραμονή ως έχει» για να συνεχίσει το Σετ με λιγότερα εργαλεία (το ίδιο κάνει και η «Αποδοχή καταγεγραμμένης έλλειψης» στην ενημέρωση της σύνθεσης). Εκκρεμότητα του ίδιου του Σετ: «Διορθώθηκε» με σημείωση για το ιστορικό, ή «Παραμονή ως έχει» (η εκκρεμότητα μένει ανοιχτή).',
        ],
        en: [
          'Issues during Composition',
          'Whatever needs action shows as a coloured row in the Set’s instrument list, with a "Handle" button. An instrument with damage or another issue: replace it, send it to Service or Stock, or move it to another Set. A missing instrument ("Missing" row): "Cover the shortage" with an instrument from Stock, another Set or a standalone one, "Report", or "Keep as is" so the Set goes on with fewer instruments (the same as "Accept the recorded shortage" in the composition notice). An issue on the Set itself: "Fixed" with a note for the history, or "Keep as is" (the issue stays open).',
        ],
      },
      {
        el: [
          'Παράδοση στο τμήμα',
          'Στην «Παράδοση» εσείς καταγράφεστε αυτόματα ως παραδίδων. Ο παραλαμβάνων του τμήματος υπογράφει με τον κωδικό χρήστη και το συνθηματικό του στην ίδια οθόνη· χωρίς υπογραφή η παράδοση δεν ολοκληρώνεται.',
        ],
        en: [
          'Delivery to the department',
          'In "Delivery" you are recorded automatically as the person handing over. The department person collecting signs with their user code and password on the same screen; without the signature the delivery cannot be completed.',
        ],
      },
      {
        el: [
          'Διάρκεια αποστείρωσης',
          'Στη «Συσκευασία & Σήμανση» διαλέγετε για κάθε Σετ ή εργαλείο διάρκεια 2, 3 ή 6 μηνών· προτείνεται η προεπιλογή του νοσοκομείου. Η διάρκεια μετρά από την αποδέσμευση και η ημερομηνία λήξης φαίνεται στην καρτέλα του. Αν το νοσοκομείο δεν έχει στάδιο συσκευασίας, η διάρκεια επιλέγεται στην προετοιμασία.',
        ],
        en: [
          'Sterile shelf life',
          'At "Packaging & Labelling" you choose a shelf life of 2, 3 or 6 months for each Set or instrument; the hospital default is suggested. It counts from the release and the expiry date shows on its card. If the hospital has no packaging stage, the shelf life is chosen at preparation.',
        ],
      },
      {
        el: [
          'Φόρτωση κλιβάνου',
          'Στην καρτέλα «Φόρτωση» όλα τα έτοιμα Σετ και εργαλεία είναι ήδη τσεκαρισμένα· ξετσεκάρετε όσα δεν μπαίνουν και πατήστε ένα κουμπί, «Φόρτωση κλιβάνου». Διαλέγετε τον κλίβανο από τη λίστα του νοσοκομείου, τον αριθμό κύκλου και το πρόγραμμα, και δηλώνετε ποιοι δείκτες μπήκαν στο φορτίο (χημικός, βιολογικός). Αποτέλεσμα δεικτών εδώ δεν δίνεται. Με «Έναρξη κύκλου» το φορτίο μπαίνει στον κλίβανο. Αν διαλέξετε κύκλο από συνδεδεμένη συσκευή, ο κύκλος έχει ήδη τελειώσει και το φορτίο πάει κατευθείαν στην Αποδέσμευση· αν η συσκευή δήλωσε αποτυχία, επιστρέφει σε επανεπεξεργασία.',
        ],
        en: [
          'Sterilizer load',
          'In the "Load" tab every ready Set and instrument is already ticked; untick what does not go in and press one button, "Sterilizer load". Pick the sterilizer from the hospital list, the cycle number and the program, and declare which indicators are in the load (chemical, biological). No indicator result is given here. "Start cycle" puts the load in the sterilizer. If you pick a cycle from a connected device, that cycle has already ended and the load goes straight to Release; if the device reported a failure, it goes back to reprocessing.',
        ],
      },
      {
        el: [
          'Στον κλίβανο',
          'Η καρτέλα «Στον κλίβανο» δείχνει τα φορτία που κλιβανίζονται τώρα: κλίβανο, κύκλο, πρόγραμμα, ποιος φόρτωσε και πότε, και τα αντικείμενα. Είναι κλειδωμένα· κανείς δεν μπορεί να τα αλλάξει. Όταν τελειώσει ο κύκλος πατήστε «Τέλος κύκλου»: το φορτίο περνά στην Αποδέσμευση και η οθόνη πηγαίνει εκεί (η Αποδέσμευση είναι πάντα υποχρεωτική)· με «Αποτυχία κύκλου» όλο το φορτίο επιστρέφει σε επανεπεξεργασία.',
        ],
        en: [
          'In the sterilizer',
          'The "In the sterilizer" tab shows the loads being sterilized now: sterilizer, cycle, program, who loaded it and when, and the items. They are locked; nobody can change them. When the cycle ends press "End of cycle": the load moves to Release and the screen goes there (Release is always required); "Cycle failed" sends the whole load back to reprocessing.',
        ],
      },
      {
        el: [
          'Αποδέσμευση φορτίου',
          'Στην καρτέλα «Αποδέσμευση» ένα κουμπί, «Αποδέσμευση φορτίου», ανοίγει τα φορτία που περιμένουν· διαλέγετε φορτίο και κλίβανο. Επιβεβαιώνετε φυσικές παραμέτρους και συσκευασίες και γράφετε το αποτέλεσμα των δεικτών που μπήκαν στο φορτίο. Αρκεί ένας επιτυχής δείκτης, εκτός αν η μονάδα απαιτεί συγκεκριμένο. Ανεπιτυχής δείκτης ή «Μη αποδέσμευση» στέλνει όλο το φορτίο σε επανεπεξεργασία. Κλείνοντας την αποδέσμευση τα αντικείμενα περνούν στην «Παράδοση» για να παραδοθούν στο τμήμα (ή πρώτα στην Αποθήκευση, αν το νοσοκομείο την έχει ενεργή).',
        ],
        en: [
          'Load release',
          'In the "Release" tab one button, "Release load", opens the loads that are waiting; pick the load and sterilizer. Confirm the physical parameters and the packaging and record the result of the indicators placed in the load. One passed indicator is enough, unless the unit requires a specific one. A failed indicator or "Do not release" sends the whole load back to reprocessing. Closing the release moves the items to "Delivery" to be handed to the department (or first to Storage, if the hospital uses it).',
        ],
      },
      {
        el: [
          'Έντυπο αποδέσμευσης',
          'Το κουμπί «Έντυπο» (στο «Στον κλίβανο», στην Αποδέσμευση και στα πρόσφατα αποδεσμευμένα φορτία) τυπώνει σε A4 το έντυπο του φορτίου: τύπο φορτίου, κλίβανο, κύκλο, πρόγραμμα, διάρκεια αποστείρωσης, τους δείκτες με χώρο για να κολλήσετε την ταινία τους, τους ελέγχους, τα αντικείμενα με τη λήξη τους, την απόφαση και την έγκριση με τα στοιχεία του χρήστη και υπογραφή. Από το «Στον κλίβανο» βγαίνει κενό για συμπλήρωση· από την Αποδέσμευση βγαίνει συμπληρωμένο με ό,τι έχετε επιλέξει εκεί (δείκτες, έλεγχοι) και τα στοιχεία του συνδεδεμένου χρήστη· μετά την αποδέσμευση βγαίνει με την καταχωρημένη απόφαση. Τα αντικείμενα δείχνουν την ημερομηνία αποστείρωσης (STERILE) και λήξης (κλεψύδρα)· αν δεν έχει οριστεί διάρκεια, εμφανίζεται η προεπιλογή του νοσοκομείου.',
        ],
        en: [
          'Release form',
          'The "Form" button (in "In the sterilizer", in Release and in the recently released loads) prints the load’s A4 form: load type, sterilizer, cycle, program, shelf life, the indicators with a place to stick their strip, the checks, the items with their expiry, the decision and the approval with the user’s details and signature. From "In the sterilizer" it prints blank to fill in; from Release it prints filled in with what you have ticked there (indicators, checks) and the signed-in user’s details; after the release it prints with the recorded decision. Items show the sterilization date (STERILE) and the expiry date (hourglass); when no shelf life is set, the hospital default is shown.',
        ],
      },
      {
        el: [
          'Εκτυπώσεις',
          'Από τη σύνθεση εκτυπώνεται το φύλλο σύνθεσης (A4, με στήλη ελέγχου και υπογραφές) και η ετικέτα barcode. Η ετικέτα έχει τρία μεγέθη (50×25, 70×35, 100×50 mm) και κεφαλίδα SurgiTrack, λογότυπο, δικό σας κείμενο ή καμία· ο διαχειριστής ορίζει την προεπιλογή του νοσοκομείου.',
        ],
        en: [
          'Printing',
          'The composition sheet (A4, with a check column and signatures) and the barcode label print from the preparation step. The label comes in three sizes (50×25, 70×35, 100×50 mm) with a SurgiTrack, logo, custom text or no header; the administrator sets the hospital default.',
        ],
      },
    ],
    steps: {
      el: [
        'Ανοίξτε την καρτέλα του σταδίου σας.',
        'Σαρώστε ή επιλέξτε το αντικείμενο.',
        'Ολοκληρώστε τον έλεγχο του σταδίου και προωθήστε το στο επόμενο.',
      ],
      en: [
        'Open the tab of your stage.',
        'Scan or select the item.',
        'Complete the stage check and move it on to the next stage.',
      ],
    },
    checks: {
      el: [
        'Η σύνθεση του Σετ ελέγχθηκε πριν τη συσκευασία.',
        'Το φορτίο καταγράφηκε με κλίβανο, αριθμό κύκλου και δείκτες.',
        'Στην αποδέσμευση συμπληρώθηκε τουλάχιστον ένας δείκτης ως επιτυχής.',
      ],
      en: [
        'The Set composition was checked before packaging.',
        'The load was recorded with sterilizer, cycle number and indicators.',
        'At release at least one indicator was recorded as passed.',
      ],
    },
    tip: {
      el: 'Ένα αντικείμενο σε ενεργή ανάκληση ή χωρίς υπόλοιπο χρήσεων δεν μπορεί να κυκλοφορήσει: η εφαρμογή το σταματά.',
      en: 'An item under an active recall or with no uses left cannot circulate: the app stops it.',
    },
    related: ['/issues', '/sets', '/movements', '/expiry'],
  },
  {
    to: '/expiry',
    permission: 'asset.registry.view',
    title: {el: 'Λήξεις αποστείρωσης', en: 'Sterile expiry'},
    summary: {
      el: 'Τα αποστειρωμένα Σετ και εργαλεία με την ημερομηνία λήξης τους: όσα λήγουν σύντομα και όσα έληξαν.',
      en: 'Sterile Sets and instruments with their expiry date: the ones expiring soon and the expired ones.',
    },
    audience: {el: 'Αποστείρωση και Διαχειριστής', en: 'Sterilization and Administrator'},
    chapters: [
      {
        el: [
          'Πότε ειδοποιεί',
          'Ένα Σετ ή εργαλείο «λήγει σύντομα» τον τελευταίο μήνα της αποστείρωσής του (τις τελευταίες 10 ημέρες για δίμηνη). Τότε εμφανίζεται στο καμπανάκι, στο «Χρειάζεται προσοχή» της Επισκόπησης και σε αυτή τη λίστα· το τμήμα το βλέπει στις δικές του ειδοποιήσεις.',
        ],
        en: [
          'When it warns',
          'A Set or instrument is "expiring soon" in the last month of its sterility (the last 10 days for 2 months). It then shows in the bell, in the Overview "Needs attention" and in this list; the department sees it in its own notifications.',
        ],
      },
      {
        el: [
          'Όταν λήξει',
          'Η εφαρμογή μόνο ειδοποιεί και το κρατά στη λίστα «Έληξαν»· δεν το στέλνει αυτόματα για επανεπεξεργασία. Μόλις σταλεί ξανά στην Αποστείρωση, η λήξη σβήνει και ορίζεται νέα στην επόμενη αποδέσμευση.',
        ],
        en: [
          'When it expires',
          'The app only warns and keeps it in the "Expired" list; it does not send it for reprocessing by itself. Once it is sent to Sterilization again, the expiry is cleared and a new one is set at the next release.',
        ],
      },
    ],
    steps: {
      el: [
        'Πατήστε «Λήγουν σύντομα» ή «Έληξαν» για να δείτε μόνο αυτά.',
        'Φιλτράρετε ανά τμήμα και ανοίξτε το Σετ ή το εργαλείο.',
        'Ενημερώστε το τμήμα να το στείλει στην Αποστείρωση πριν χρησιμοποιηθεί.',
      ],
      en: [
        'Press "Expiring soon" or "Expired" to see only those.',
        'Filter by department and open the Set or instrument.',
        'Ask the department to send it to Sterilization before it is used.',
      ],
    },
    tip: {
      el: 'Η προεπιλεγμένη διάρκεια του νοσοκομείου ορίζεται στο Studio → Ρυθμίσεις.',
      en: 'The hospital’s default shelf life is set in Studio → Settings.',
    },
    related: ['/sterilization', '/sets', '/studio'],
  },
  {
    to: '/bin',
    permission: 'asset.delete',
    title: {el: 'Κάδος', en: 'Recycle bin'},
    summary: {
      el: 'Ό,τι διαγράφεται μένει 30 ημέρες στον Κάδο και μπορεί να επανέλθει όπως ήταν.',
      en: 'Whatever is deleted stays 30 days in the bin and can be put back as it was.',
    },
    audience: {el: 'Αποστείρωση και Διαχειριστής', en: 'Sterilization and Administrator'},
    chapters: [
      {
        el: [
          'Πού βρίσκεται',
          'Ο Κάδος είναι κάτω αριστερά στο μενού, όπως στον υπολογιστή. Όταν έχει κάτι μέσα δείχνει πόσα είναι.',
        ],
        en: [
          'Where it is',
          'The bin sits at the bottom left of the menu, like on a computer. When something is in it, it shows how many.',
        ],
      },
      {
        el: [
          'Επαναφορά',
          'Σετ, εργαλεία, εγγραφές βιβλιοθηκών, χρωματικές ταινίες και συσκευές επανέρχονται όπως ήταν· μετά από 30 ημέρες σβήνονται οριστικά. Τις βιβλιοθήκες τις επαναφέρει μόνο ο Διαχειριστής.',
        ],
        en: [
          'Restore',
          'Sets, instruments, library records, color tapes and devices come back as they were; after 30 days they are deleted for good. Only the Administrator restores library records.',
        ],
      },
    ],
    steps: {
      el: ['Πατήστε τον Κάδο κάτω αριστερά.', 'Βρείτε την εγγραφή και πατήστε «Επαναφορά».'],
      en: ['Press the bin at the bottom left.', 'Find the record and press "Restore".'],
    },
    related: ['/sets', '/tools', '/studio'],
  },
  {
    to: '/devices',
    permission: 'sterilization.workspace',
    title: {el: 'Συνδεδεμένες συσκευές', en: 'Connected devices'},
    summary: {
      el: 'Κλίβανοι, πλυντήρια και άλλες συσκευές που στέλνουν τα δεδομένα των κύκλων τους στο SurgiTrack.',
      en: 'Sterilizers, washers and other devices that send their cycle data to SurgiTrack.',
    },
    audience: {el: 'Αποστείρωση και Διαχειριστής', en: 'Sterilization and Administrator'},
    chapters: [
      {
        el: [
          'Τρεις τρόποι σύνδεσης',
          'Δίκτυο: η συσκευή ή το λογισμικό του κατασκευαστή στέλνει κάθε κύκλο αυτόματα με ένα κλειδί συσκευής. Αρχείο: εξάγετε τους κύκλους σε USB (CSV ή Excel) και τους ανεβάζετε. Καλώδιο: η συσκευή συνδέεται σε υπολογιστή της Αποστείρωσης (Chrome ή Edge) και ό,τι τυπώνει διαβάζεται αυτόματα.',
        ],
        en: [
          'Three ways to connect',
          'Network: the device or the manufacturer software sends every cycle automatically with a device key. File: export the cycles to USB (CSV or Excel) and upload them. Cable: the device connects to a Sterilization computer (Chrome or Edge) and what it prints is read automatically.',
        ],
      },
      {
        el: [
          'Αυτόματη συμπλήρωση κύκλου',
          'Στην καταγραφή κύκλου ή φορτίου εμφανίζονται οι νέοι κύκλοι των συσκευών. Το «Χρήση» συμπληρώνει κλίβανο, αριθμό κύκλου και πρόγραμμα· εσείς ελέγχετε και επιβεβαιώνετε. Αποτυχημένος κύκλος της συσκευής σημειώνεται ως αποτυχία.',
        ],
        en: [
          'Cycle auto-fill',
          'When recording a cycle or a load, the devices’ new cycles are listed. “Use” fills in sterilizer, cycle number and program; you check and confirm. A cycle the device failed is marked as failed.',
        ],
      },
      {
        el: [
          'Αρχείο',
          'Κάθε συσκευή κρατά τους κύκλους της με θερμοκρασία, πίεση, διάρκεια και αποτέλεσμα. Το «Εξαγωγή Excel» τους κατεβάζει για έλεγχο ή επιθεώρηση.',
        ],
        en: [
          'Record',
          'Each device keeps its cycles with temperature, pressure, duration and result. “Export Excel” downloads them for review or audit.',
        ],
      },
    ],
    steps: {
      el: [
        'Ο διαχειριστής προσθέτει τη συσκευή και διαλέγει τρόπο σύνδεσης.',
        'Για δίκτυο: «Κλειδί δικτύου» και το δίνετε στον τεχνικό του κατασκευαστή.',
        'Για αρχείο ή καλώδιο: «Αρχείο» ή «Καλώδιο» στην κάρτα της συσκευής.',
      ],
      en: [
        'The admin adds the device and picks how it connects.',
        'For network: “Network key”, given to the manufacturer’s technician.',
        'For file or cable: “File” or “Cable” on the device card.',
      ],
    },
    related: ['/sterilization', '/reports'],
  },
  {
    to: '/tools',
    permission: 'asset.registry.view',
    title: {el: 'Εργαλεία', en: 'Instruments'},
    summary: {
      el: 'Το γενικό μητρώο όλων των φυσικών εργαλείων, σε Σετ, μεμονωμένα ή στο Απόθεμα.',
      en: 'The register of every physical instrument, in Sets, standalone or in Stock.',
    },
    audience: {el: 'Αποστείρωση και Διαχειριστής', en: 'Sterilization and Administrator'},
    chapters: [
      {
        el: [
          'Φίλτρα',
          'Όλα τα φίλτρα βρίσκονται στο κουμπί «Φίλτρα»: τμήμα, ειδικότητα, εταιρεία, θέση, κατάσταση και τύπος χρήσης. Οι δείκτες πάνω από τη λίστα φιλτράρουν με ένα κλικ.',
        ],
        en: [
          'Filters',
          'All filters are in the "Filters" button: department, specialty, manufacturer, location, state and usage type. The indicators above the list filter with one click.',
        ],
      },
      {
        el: [
          'Τύπος χρήσης',
          '«Με όριο χρήσεων» δείχνει εργαλεία με όριο χρήσεων, «Λίγες χρήσεις» όσα πλησιάζουν στο όριο και «Χωρίς όριο» τα υπόλοιπα.',
        ],
        en: [
          'Usage type',
          '"With a usage limit" shows instruments with a usage limit, "Few uses left" those near it and "No limit" the rest.',
        ],
      },
      {
        el: [
          'Καρτέλα εργαλείου',
          'Πατώντας ένα εργαλείο βλέπετε ιστορικό, φωτογραφίες, χρήσεις, χρωματική σήμανση και ιδιοκτησία. Το όριο και οι χρήσεις αλλάζουν μόνο από τον Διαχειριστή και τον Προϊστάμενο Αποστείρωσης.',
        ],
        en: [
          'Instrument card',
          'Opening an instrument shows history, photos, uses, color marker and ownership. The limit and uses can be changed only by the Administrator and the Sterilization supervisor.',
        ],
      },
      {
        el: [
          'Εισαγωγή και ονομασίες',
          'Το «Μαζική εισαγωγή» φέρνει εργαλεία και Σετ από Excel. Το «Έλεγχος ονομασιών» βρίσκει γραφές που διαφέρουν και κωδικούς με πολλές ονομασίες και τα ενοποιεί.',
        ],
        en: [
          'Import and names',
          '"Bulk import" brings instruments and Sets from Excel. "Name check" finds names written differently and codes with many names, and unifies them.',
        ],
      },
    ],
    steps: {
      el: [
        'Αναζητήστε με όνομα, κωδικό, barcode ή serial.',
        'Περιορίστε με τα φίλτρα.',
        'Ανοίξτε το εργαλείο για λεπτομέρειες και ενέργειες.',
      ],
      en: [
        'Search by name, code, barcode or serial.',
        'Narrow down with the filters.',
        'Open the instrument for details and actions.',
      ],
    },
    tip: {
      el: 'Η λίστα φορτώνει σταδιακά καθώς κάνετε κύλιση· για να βρείτε κάτι γρήγορα χρησιμοποιήστε την αναζήτηση.',
      en: 'The list loads progressively as you scroll; to find something quickly, use search.',
    },
    related: ['/sets', '/stock', '/standalone-tools', '/import', '/tools/names'],
  },
  {
    to: '/sets',
    permission: 'asset.registry.view',
    title: {el: 'Σετ εργαλείων', en: 'Instrument Sets'},
    summary: {
      el: 'Το μητρώο των Σετ με σύνθεση, τμήμα, κατάσταση και πληρότητα.',
      en: 'The register of Sets with composition, department, state and completeness.',
    },
    audience: {el: 'Αποστείρωση και Διαχειριστής', en: 'Sterilization and Administrator'},
    chapters: [
      {
        el: [
          'Σύνθεση',
          'Κάθε Σετ έχει πρότυπη σύνθεση (τι πρέπει να περιέχει) και τα πραγματικά εργαλεία του. Όταν λείπει κάτι, το Σετ εμφανίζεται «Με έλλειψη».',
        ],
        en: [
          'Composition',
          'Each Set has a template composition (what it should contain) and its actual instruments. When something is missing, the Set shows as "Missing items".',
        ],
      },
      {
        el: [
          'Διαχείριση σύνθεσης',
          'Ο Προϊστάμενος Αποστείρωσης προσθέτει εργαλεία από το Απόθεμα ή αφαιρεί εργαλεία. Εργαλείο με δικό του χρώμα που μπαίνει σε Σετ ρωτά αν κρατά το χρώμα του.',
        ],
        en: [
          'Managing composition',
          'The Sterilization supervisor adds instruments from Stock or removes them. An instrument with its own color joining a Set asks whether it keeps its color.',
        ],
      },
      {
        el: [
          'Ιδιοκτησία',
          'Ένα Σετ μπορεί να ανήκει στο νοσοκομείο, σε ιατρό ή σε άλλον. Το όνομα του ιατρού εμφανίζεται και στην αναζήτηση.',
        ],
        en: [
          'Ownership',
          "A Set can belong to the hospital, a doctor or someone else. The doctor's name is searchable.",
        ],
      },
    ],
    steps: {
      el: [
        'Βρείτε το Σετ με αναζήτηση ή φίλτρα.',
        'Ανοίξτε το για σύνθεση, ιστορικό και ενέργειες.',
        'Εκτυπώστε το φύλλο σύνθεσης όταν χρειάζεται.',
      ],
      en: [
        'Find the Set by search or filters.',
        'Open it for composition, history and actions.',
        'Print the composition sheet when needed.',
      ],
    },
    related: ['/tools', '/stock', '/reports', '/import'],
  },
  {
    to: '/import',
    permission: 'asset.create',
    openedFrom: ['/tools', '/sets'],
    title: {el: 'Μαζική εισαγωγή', en: 'Bulk import'},
    summary: {
      el: 'Εισαγωγή εργαλείων και Σετ από Excel ή CSV, με προεπισκόπηση πριν γραφτεί οτιδήποτε.',
      en: 'Import instruments and Sets from Excel or CSV, with a preview before anything is written.',
    },
    audience: {el: 'Διαχειριστής και Προϊστάμενος Αποστείρωσης', en: 'Administrator and Sterilization supervisor'},
    chapters: [
      {
        el: [
          'Το αρχείο',
          'Κατεβάστε το «Πρότυπο Excel». Μία γραμμή ανά εργαλείο: Σετ, κωδικός, όνομα εργαλείου (υποχρεωτικό), ποσότητα, τμήμα, ειδικότητα, κατασκευαστής, μέγιστες χρήσεις, σειριακός αριθμός. Ίδιο όνομα Σετ = ίδιο Σετ· κενό Σετ = μεμονωμένο εργαλείο· κενό τμήμα = Απόθεμα.',
        ],
        en: [
          'The file',
          'Download the "Excel template". One row per instrument: Set, code, instrument name (required), quantity, department, specialty, manufacturer, max uses, serial number. Same Set name = same Set; no Set = standalone instrument; no department = Stock.',
        ],
      },
      {
        el: [
          'Προεπισκόπηση',
          'Πριν την εισαγωγή βλέπετε πόσα Σετ, μεμονωμένα και εργαλεία Αποθέματος θα δημιουργηθούν, τη λίστα εργαλείων με αναζήτηση και τις γραμμές με πρόβλημα. Οι στήλες αναγνωρίζονται αυτόματα· αν μια στήλη δεν βρέθηκε, την αντιστοιχίζετε με το χέρι.',
        ],
        en: [
          'Preview',
          'Before importing you see how many Sets, standalone and Stock instruments will be created, the instrument list with search and the rows with problems. Columns are recognized automatically; if one is not found, you map it by hand.',
        ],
      },
      {
        el: [
          'Ονομασίες',
          'Η εισαγωγή μπορεί να γράψει τις ονομασίες ενιαία (κεφαλαία χωρίς τόνους, ίδια γραφή μονάδων) και να χρησιμοποιήσει την ονομασία που ήδη έχει το νοσοκομείο για τον ίδιο κωδικό, ώστε να μη δημιουργηθούν διπλές ονομασίες.',
        ],
        en: [
          'Names',
          'The import can write names uniformly (capitals without accents, units written the same way) and use the name the hospital already has for the same code, so no duplicate names are created.',
        ],
      },
      {
        el: [
          'Αναίρεση',
          'Κάθε εισαγωγή εμφανίζεται στις «Εισαγωγές σε αυτό το νοσοκομείο» και αναιρείται ολόκληρη με «Αναίρεση εισαγωγής», όσο κανένα αντικείμενό της δεν έχει χρησιμοποιηθεί.',
        ],
        en: [
          'Undo',
          'Every import appears under "Imports in this hospital" and can be undone in full with "Undo import", as long as none of its items has been used.',
        ],
      },
    ],
    steps: {
      el: [
        'Εργαλεία ή Σετ → «Μαζική εισαγωγή».',
        'Κατεβάστε το πρότυπο και συμπληρώστε το.',
        'Σύρετε το αρχείο στη σελίδα.',
        'Ελέγξτε προεπισκόπηση, προβλήματα και ονομασίες.',
        'Πατήστε «Εισαγωγή».',
      ],
      en: [
        'Instruments or Sets → "Bulk import".',
        'Download the template and fill it in.',
        'Drag the file onto the page.',
        'Check the preview, problems and names.',
        'Press "Import".',
      ],
    },
    checks: {
      el: [
        'Τα ονόματα τμημάτων είναι ίδια με αυτά της Διαχείρισης νοσοκομείου.',
        'Οι γραμμές με πρόβλημα διορθώθηκαν ή δεν χρειάζονται.',
        'Μετά την εισαγωγή: «Έλεγχος ονομασιών».',
      ],
      en: [
        'Department names match those in Users & departments.',
        'Rows with problems were fixed or are not needed.',
        'After importing: "Name check".',
      ],
    },
    related: ['/tools/names', '/sets', '/tools'],
  },
  {
    to: '/tools/names',
    permission: 'asset.edit',
    openedFrom: ['/tools'],
    title: {el: 'Έλεγχος ονομασιών', en: 'Name check'},
    summary: {
      el: 'Ενιαίες ονομασίες εργαλείων: διορθώσεις γραφής και κωδικοί που έχουν περισσότερες από μία ονομασίες.',
      en: 'Consistent instrument names: spelling fixes and codes that carry more than one name.',
    },
    audience: {el: 'Διαχειριστής και Προϊστάμενος Αποστείρωσης', en: 'Administrator and Sterilization supervisor'},
    chapters: [
      {
        el: [
          'Διορθώσεις γραφής',
          'Διορθώσεις χωρίς ρίσκο: διπλά κενά, τόνοι, πεζά, λατινικά γράμματα μέσα σε ελληνική λέξη (και αντίστροφα), «12cm» → «12 CM». Αφήστε επιλεγμένες όσες θέλετε και πατήστε «Εφαρμογή σε … εργαλεία».',
        ],
        en: [
          'Spelling fixes',
          'Risk-free fixes: double spaces, accents, lower case, Latin letters inside a Greek word (and the reverse), "12cm" → "12 CM". Keep the ones you want ticked and press "Apply to … instruments".',
        ],
      },
      {
        el: [
          'Ίδιος κωδικός',
          'Για κάθε κωδικό με πολλές ονομασίες η εφαρμογή προτείνει την πιο συχνή. Επιλέξτε ποιες ονομασίες μπαίνουν στην ενοποίηση, την τελική ονομασία (ή γράψτε άλλη) και πατήστε «Ενοποίηση». Το «Πιθανό λάθος κωδικός» σημαίνει άλλο εργαλείο με λάθος κωδικό: διορθώστε το από την καρτέλα του.',
        ],
        en: [
          'Same code',
          'For each code with many names the app suggests the most used one. Choose which names join, the final name (or type another) and press "Unify". "Possibly wrong code" means another instrument with the wrong code: fix it from its card.',
        ],
      },
      {
        el: [
          'Συνθέσεις Σετ',
          'Η αλλαγή ονομασίας περνά και στις πρότυπες συνθέσεις των Σετ. Αν εμφανιστεί «Συνθέσεις Σετ με παλιές ονομασίες», πατήστε «Ενημέρωση συνθέσεων».',
        ],
        en: [
          'Set compositions',
          'A rename also reaches the Set template compositions. If "Set compositions with old names" appears, press "Update compositions".',
        ],
      },
    ],
    steps: {
      el: [
        'Εργαλεία → «Έλεγχος ονομασιών».',
        'Εφαρμόστε τις διορθώσεις γραφής.',
        'Περάστε τους κωδικούς με πολλές ονομασίες· ο αριθμός εργαλείων ανοίγει τη λίστα τους.',
        'Ενημερώστε τις συνθέσεις αν το ζητήσει.',
      ],
      en: [
        'Instruments → "Name check".',
        'Apply the spelling fixes.',
        'Go through the codes with many names; the instrument count opens their list.',
        'Update the compositions if asked.',
      ],
    },
    tip: {
      el: 'Κάθε αλλαγή αναιρείται από την ειδοποίηση που εμφανίζεται αμέσως μετά.',
      en: 'Every change can be undone from the notice that appears right after it.',
    },
    related: ['/tools', '/import', '/sets'],
  },
  {
    to: '/standalone-tools',
    permission: 'asset.registry.view',
    title: {el: 'Μεμονωμένα σε χρήση', en: 'Standalone in Use'},
    summary: {
      el: 'Εργαλεία που χρησιμοποιούνται αυτόνομα σε τμήματα, εκτός Σετ.',
      en: 'Instruments used on their own in departments, outside any Set.',
    },
    audience: {el: 'Αποστείρωση και Διαχειριστής', en: 'Sterilization and Administrator'},
    chapters: [
      {
        el: [
          'Τι είναι',
          'Μεμονωμένο είναι ένα εργαλείο που ανήκει σε τμήμα και κυκλοφορεί μόνο του. Πολλά ρομποτικά εργαλεία με όριο χρήσεων είναι μεμονωμένα.',
        ],
        en: [
          'What it is',
          'A standalone instrument belongs to a department and circulates on its own. Many robotic instruments with a usage limit are standalone.',
        ],
      },
      {
        el: [
          'Όριο χρήσεων',
          'Οι δείκτες «Με όριο χρήσεων» και «Λίγες χρήσεις» φιλτράρουν τη λίστα. Το υπόλοιπο φαίνεται σε κάθε γραμμή.',
        ],
        en: [
          'Usage limits',
          'The "With a usage limit" and "Few uses left" indicators filter the list. Remaining uses show on each row.',
        ],
      },
    ],
    steps: {
      el: ['Φιλτράρετε με τμήμα ή τύπο χρήσης.', 'Ανοίξτε το εργαλείο για λεπτομέρειες.'],
      en: ['Filter by department or usage type.', 'Open the instrument for details.'],
    },
    related: ['/tools', '/reports'],
  },
  {
    to: '/stock',
    permission: 'stock.manage',
    title: {el: 'Απόθεμα εργαλείων', en: 'Instrument Stock'},
    summary: {
      el: 'Διαθέσιμα εργαλεία εκτός Σετ και τμημάτων, έτοιμα να συμπληρώσουν Σετ.',
      en: 'Available instruments outside Sets and departments, ready to complete a Set.',
    },
    audience: {el: 'Αποστείρωση', en: 'Sterilization'},
    chapters: [
      {
        el: [
          'Προσθήκη σε Σετ',
          'Η προσθήκη γίνεται μέσα από το Σετ: ανοίξτε το Σετ, πατήστε «Προσθήκη εργαλείων» και διαλέξτε από την καρτέλα Απόθεμα. Ο δείκτης «Σετ με έλλειψη» ανοίγει τα Σετ που χρειάζονται συμπλήρωση.',
        ],
        en: [
          'Add to a Set',
          'Adding happens from the Set: open the Set, press "Add instruments" and pick from the Stock tab. The "Sets with missing items" indicator opens the Sets that need completing.',
        ],
      },
    ],
    steps: {
      el: [
        'Ανοίξτε «Σετ με έλλειψη» για να δείτε τι λείπει.',
        'Ανοίξτε το Σετ και πατήστε «Προσθήκη εργαλείων».',
        'Διαλέξτε το εργαλείο από την καρτέλα Απόθεμα.',
      ],
      en: [
        'Open "Sets with missing items" to see what is missing.',
        'Open the Set and press "Add instruments".',
        'Pick the instrument from the Stock tab.',
      ],
    },
    related: ['/sets', '/tools', '/replacements'],
  },
  {
    to: '/replacements',
    permission: 'stock.manage',
    openedFrom: ['/issues'],
    title: {el: 'Αντικαταστάσεις & Παραγγελίες', en: 'Replacements & orders'},
    summary: {
      el: 'Τα εργαλεία σε Service, με βλάβη ή φθορά, χαμένα ή εκτός χρήσης: αν υπάρχει ίδιο στο Απόθεμα, αντικατάσταση με ένα κλικ, αλλιώς παραγγελία αγοράς.',
      en: 'Instruments in Service, damaged or worn, lost or out of use: replace from Stock in one click when it holds the same instrument, otherwise record a purchase order.',
    },
    audience: {el: 'Αποστείρωση και Διαχειριστής', en: 'Sterilization and Administrator'},
    chapters: [
      {
        el: [
          'Τι εμφανίζεται',
          'Εργαλεία σε Service, με ανοιχτή αναφορά βλάβης ή φθοράς, χαμένα και εκτός χρήσης. Για καθένα: το Σετ στο οποίο ανήκει (ή από το οποίο βγήκε), η αιτία, από πότε, και αν το Απόθεμα έχει ίδιο εργαλείο (ίδιος κωδικός ή, χωρίς κωδικό, ίδια ονομασία).',
        ],
        en: [
          'What it lists',
          'Instruments in Service, with an open damage or wear report, lost and out of use. For each: the Set it belongs to (or left), the reason, since when, and whether Stock holds the same instrument (same code or, with no code, the same name).',
        ],
      },
      {
        el: [
          'Αντικατάσταση από Απόθεμα',
          '«Αντικατάσταση» βάζει ένα ίδιο εργαλείο από το Απόθεμα στο Σετ. Αν το χαλασμένο ήταν ακόμα μέσα, βγαίνει για Service. Επιλέξτε πολλά και πατήστε «Αντικατάσταση από Απόθεμα» για όλα μαζί· το ίδιο εργαλείο Αποθέματος δεν δίνεται δύο φορές.',
        ],
        en: [
          'Replace from Stock',
          '"Replace" puts a matching Stock instrument into the Set. If the damaged one was still in it, it leaves for Service. Select several and press "Replace from Stock" for all at once; one Stock instrument is never used twice.',
        ],
      },
      {
        el: [
          'Παραγγελία αγοράς',
          'Για όσα δεν υπάρχουν στο Απόθεμα: επιλέξτε τα και «Παραγγελία αγοράς». Γίνεται μία γραμμή ανά είδος με την ποσότητα, συμπληρώνετε προμηθευτή και σημείωση. Στην καρτέλα «Παραγγελίες» η παραγγελία εκτυπώνεται, σημειώνεται ως παραγγελθείσα ή ακυρωμένη, και με «Παραλαβή στο Απόθεμα» τα νέα εργαλεία καταχωρούνται αυτόματα στο Απόθεμα.',
        ],
        en: [
          'Purchase order',
          'For what Stock lacks: select it and "Purchase order". One line per kind with its quantity; add supplier and note. In the "Orders" tab the order prints, is marked ordered or cancelled, and "Receive into Stock" registers the new instruments in Stock.',
        ],
      },
    ],
    steps: {
      el: [
        'Φιλτράρετε με αιτία, τμήμα ή διαθεσιμότητα στο Απόθεμα.',
        'Αντικαταστήστε από το Απόθεμα όσα έχουν διαθέσιμο.',
        'Για τα υπόλοιπα καταχωρήστε παραγγελία αγοράς και εκτυπώστε την.',
        'Όταν έρθουν, «Παραλαβή στο Απόθεμα»: τα νέα εργαλεία μπαίνουν στο Απόθεμα με δικά τους barcodes.',
      ],
      en: [
        'Filter by reason, department or Stock availability.',
        'Replace from Stock what it holds.',
        'Record a purchase order for the rest and print it.',
        'When they arrive, "Receive into Stock": the new instruments enter Stock with their own barcodes.',
      ],
    },
    tip: {
      el: 'Η «Εκτύπωση λίστας» και το Excel παίρνουν ό,τι έχετε επιλέξει, αλλιώς ό,τι δείχνουν τα φίλτρα.',
      en: '"Print list" and Excel take your selection, otherwise what the filters show.',
    },
    related: ['/stock', '/issues', '/reports'],
  },
  {
    to: '/issues',
    permission: 'issue.view',
    title: {el: 'Εκκρεμότητες', en: 'Issues'},
    summary: {
      el: 'Ελλείψεις, φθορές, βλάβες και απώλειες που χρειάζονται διαχείριση.',
      en: 'Missing, damaged, faulty or lost items that need handling.',
    },
    audience: {el: 'Όλοι οι χρήστες', en: 'All users'},
    chapters: [
      {
        el: [
          'Δημιουργία',
          'Εκκρεμότητα δημιουργείται από την καρτέλα Σετ ή εργαλείου («Ενέργειες» → «Αναφορά προβλήματος») ή αυτόματα από απόκλιση στην παραλαβή. Απώλεια και αποστολή σε Service η Αποστείρωση τις δηλώνει από «Ενέργειες» → «Διαχείριση», γιατί αλλάζουν την κατάσταση· ένα τμήμα δηλώνει την απώλεια ως αναφορά και η Αποστείρωση την επιβεβαιώνει.',
        ],
        en: [
          'Creating',
          'An issue is created from a Set or instrument card ("Actions" → "Report a problem") or automatically from a receipt deviation. Sterilization declares a loss or a Service send-off in "Actions" → "Manage", because they change the state; a department reports a loss and Sterilization confirms it.',
        ],
      },
      {
        el: [
          'Κλείσιμο',
          'Η Αποστείρωση επιλύει την εκκρεμότητα (αντικατάσταση, service, επιστροφή) και την κλείνει. Όλα καταγράφονται στο Ιστορικό.',
        ],
        en: [
          'Closing',
          'Sterilization resolves the issue (replacement, service, return) and closes it. Everything is recorded in History.',
        ],
      },
      {
        el: [
          'Δύο καρτέλες',
          'Η Αποστείρωση και ο Διαχειριστής βλέπουν δύο καρτέλες: «Αναφορές προβλημάτων» (ό,τι αναφέρθηκε) και «Αντικαταστάσεις & Παραγγελίες» (τα εργαλεία που πρέπει να αντικατασταθούν, από το Απόθεμα ή με παραγγελία αγοράς).',
        ],
        en: [
          'Two tabs',
          'Sterilization and the Administrator see two tabs: "Problem reports" (what was reported) and "Replacements & orders" (the instruments to replace, from Stock or with a purchase order).',
        ],
      },
    ],
    steps: {
      el: [
        'Φιλτράρετε «Ανοιχτές».',
        'Ανοίξτε την εκκρεμότητα και δείτε σημείωση και φωτογραφίες.',
        'Επιλύστε και κλείστε την.',
      ],
      en: ['Filter "Open".', 'Open the issue and see its note and photos.', 'Resolve and close it.'],
    },
    related: ['/replacements', '/sterilization', '/movements'],
  },
  {
    to: '/reports',
    permission: 'reports.view',
    title: {el: 'Αναφορές & Εκτυπώσεις', en: 'Reports & Printing'},
    summary: {
      el: 'Έτοιμες αναφορές με φίλτρα, εκτύπωση/PDF και εξαγωγή σε Excel.',
      en: 'Ready-made reports with filters, print/PDF and Excel export.',
    },
    audience: {el: 'Αποστείρωση και Διαχειριστής', en: 'Sterilization and Administrator'},
    chapters: [
      {
        el: [
          'Διαθέσιμες αναφορές',
          'Σύνθεση Σετ, Ανά Τμήμα, Ανά Ειδικότητα, Service & Βλάβες, Όρια Χρήσεων, Εργαλεία εκτός χρήσης και Ιχνηλασιμότητα Ασθενούς.',
        ],
        en: [
          'Available reports',
          'Set composition, By department, By specialty, Service & faults, Usage limits, Out-of-use instruments and Patient traceability.',
        ],
      },
      {
        el: [
          'Εκτύπωση & Excel',
          'Το «Εκτύπωση / PDF» ανοίγει προεπισκόπηση A4. Το «Εξαγωγή Excel» κατεβάζει τα ίδια αποτελέσματα με τα φίλτρα που έχετε ορίσει.',
        ],
        en: [
          'Print & Excel',
          '"Print / PDF" opens an A4 preview. "Export Excel" downloads the same results with the filters you set.',
        ],
      },
      {
        el: [
          'Εκτός χρήσης',
          'Εργαλεία που συμπλήρωσαν το όριο χρήσεών τους φεύγουν από τις λίστες και μένουν ως ιστορικό σε αυτή την αναφορά, με ημερομηνία και αιτία.',
        ],
        en: [
          'Out of use',
          'Instruments that reached their usage limit leave the lists and stay as history in this report, with date and reason.',
        ],
      },
    ],
    steps: {
      el: ['Επιλέξτε αναφορά από αριστερά.', 'Ορίστε φίλτρα.', 'Εκτυπώστε ή εξάγετε σε Excel.'],
      en: ['Pick a report on the left.', 'Set the filters.', 'Print or export to Excel.'],
    },
    related: ['/overview', '/movements'],
  },
  {
    to: '/movements',
    permission: 'history.view',
    title: {el: 'Ιστορικό', en: 'History'},
    summary: {
      el: 'Η αλυσίδα φύλαξης: κάθε κίνηση Σετ και εργαλείου, ποιος, πότε και από πού προς πού.',
      en: 'The chain of custody: every Set and instrument movement, who, when and from where to where.',
    },
    audience: {
      el: 'Όλοι οι χρήστες (οι χρήστες τμήματος βλέπουν μόνο το τμήμα τους)',
      en: 'All users (department users see only their department)',
    },
    chapters: [
      {
        el: [
          'Καθαρισμός ιστορικού (owner)',
          'Μόνο ο owner της πλατφόρμας, μέσα σε νοσοκομείο, βλέπει το «Καθαρισμός ιστορικού». Τσεκάρει τις εγγραφές (ή «Επιλογή όλων των εμφανιζόμενων» μετά από φίλτρα) και πατά «Διαγραφή επιλεγμένων». Η διαγραφή είναι οριστική και καταγράφεται ως νέα εγγραφή «Καθαρισμός ιστορικού · N εγγραφές». Για όλους τους άλλους το ιστορικό δεν αλλάζει.',
        ],
        en: [
          'Cleaning up history (owner)',
          'Only the platform owner, inside a hospital, sees "Clean up history". They tick the entries (or "Select all shown" after filtering) and press "Delete selected". The deletion is permanent and is recorded as a new "History clean-up · N entries" entry. For everyone else the history never changes.',
        ],
      },
      {
        el: [
          'Αμετάβλητο',
          'Οι εγγραφές του ιστορικού δεν τροποποιούνται. Χρησιμοποιήστε τα φίλτρα ημερομηνίας, κατεύθυνσης και ενέργειας για να βρείτε μια κίνηση.',
        ],
        en: [
          'Immutable',
          'History records are never changed. Use the date, route and action filters to find a movement.',
        ],
      },
    ],
    steps: {
      el: ['Φιλτράρετε με ημερομηνία ή barcode.', 'Πατήστε μια κίνηση για πλήρεις λεπτομέρειες.'],
      en: ['Filter by date or barcode.', 'Click a movement for full details.'],
    },
    related: ['/reports'],
  },
  {
    to: '/studio',
    permission: 'studio.manage',
    title: {el: 'SurgiTrack Studio', en: 'Management Center'},
    summary: {
      el: 'Ρυθμίσεις του νοσοκομείου: βιβλιοθήκες, στάδια ροής, δικαιώματα ρόλων, χρωματικές ταινίες και όριο προειδοποίησης χρήσεων.',
      en: 'Hospital settings: libraries, workflow stages, role permissions, color tapes and the usage warning threshold.',
    },
    audience: {el: 'Διαχειριστής', en: 'Administrator'},
    chapters: [
      {
        el: [
          'Βιβλιοθήκες',
          'Τμήματα, ειδικότητες, κατασκευαστές, προμηθευτές, κατηγορίες εργαλείων και κλίβανοι. Ό,τι ορίζεται εδώ εμφανίζεται στις επιλογές όλης της εφαρμογής. Στους «Κλιβάνους», η «Προσθήκη κλιβάνων» προσθέτει πολλούς μαζί με τον τρόπο ονομασίας του νοσοκομείου (Κλίβανος A, B, C… ή 1, 2, 3…)· η επιλογή μένει για τις επόμενες φορές και οι κλίβανοι εμφανίζονται στη Φόρτωση κλιβάνου.',
        ],
        en: [
          'Libraries',
          'Departments, specialties, manufacturers, suppliers, instrument categories and sterilizers. Whatever you define here appears in the choices across the app. In "Sterilizers", "Add sterilizers" adds several at once in the hospital’s naming (Sterilizer A, B, C… or 1, 2, 3…); the choice is kept for next time and the sterilizers appear in the Sterilizer load.',
        ],
      },
      {
        el: [
          'Δικαιώματα',
          'Ορίστε τι κάνει κάθε ρόλος. Κάποια δικαιώματα (δημιουργία, σύνθεση, όρια χρήσεων) ανήκουν μόνο στον Προϊστάμενο Αποστείρωσης.',
        ],
        en: [
          'Permissions',
          'Set what each role can do. Some permissions (creation, composition, usage limits) belong only to the Sterilization supervisor.',
        ],
      },
      {
        el: [
          'Ροή Αποστείρωσης',
          'Τα στάδια από την παραλαβή έως την αποδέσμευση. Ενεργοποιήστε μόνο τα στάδια και τους ελέγχους που κάνει η Κεντρική Αποστείρωση του νοσοκομείου σας. Στην πολιτική αποδέσμευσης ορίζετε αν απαιτείται συγκεκριμένος δείκτης· χωρίς απαίτηση αρκεί ένας επιτυχής (χημικός ή βιολογικός).',
        ],
        en: [
          'Sterilization Flow',
          'The stages from receipt to release. Turn on only the stages and checks your hospital’s Central Sterilization performs. In the release policy you set whether a specific indicator is required; without one, one passed indicator (chemical or biological) is enough.',
        ],
      },
      {
        el: [
          'Ρόλοι και Ρυθμίσεις',
          'Οι «Ρόλοι» εξηγούν τι κάνει κάθε ρόλος, για να διαλέγετε σωστά στις εγκρίσεις. Στις «Ρυθμίσεις» ορίζετε πότε ένα εργαλείο εμφανίζεται με «Λίγες χρήσεις», την προεπιλεγμένη διάρκεια αποστείρωσης (2, 3 ή 6 μήνες) και την ετικέτα barcode του νοσοκομείου (μέγεθος, κεφαλίδα, λογότυπο).',
        ],
        en: [
          'Roles and Settings',
          '"Roles" explains what each role does, so you choose correctly when approving. In "Settings" you set when an instrument shows as "Few uses left", the default sterile shelf life (2, 3 or 6 months) and the hospital’s barcode label (size, header, logo).',
        ],
      },
    ],
    steps: {
      el: ['Επιλέξτε ενότητα.', 'Κάντε τις αλλαγές.', 'Αποθηκεύστε· οι αλλαγές ισχύουν αμέσως.'],
      en: ['Pick a section.', 'Make your changes.', 'Save; changes apply at once.'],
    },
    related: ['/hospital', '/start-admin', '/overview'],
  },
  {
    to: '/hospital',
    permission: 'studio.manage',
    title: {el: 'Χρήστες & Τμήματα', en: 'Users & departments'},
    summary: {
      el: 'Οι χρήστες, οι προσκλήσεις, οι αιτήσεις πρόσβασης και τα τμήματα του νοσοκομείου.',
      en: "The hospital's users, invitations, access requests and departments.",
    },
    audience: {el: 'Διαχειριστής νοσοκομείου', en: 'Hospital administrator'},
    chapters: [
      {
        el: [
          'Πρόσκληση',
          '«Πρόσκληση» → διαλέξτε πρώτα ρόλο και τμήμα, μετά το email. Ο χρήστης λαμβάνει email, συμπληρώνει ονοματεπώνυμο και η αίτησή του έρχεται σε εσάς για έγκριση. Μέχρι τότε φαίνεται στις προσκλήσεις, όπου την ξαναστέλνετε, αντιγράφετε τον σύνδεσμο ή την ακυρώνετε.',
        ],
        en: [
          'Invitation',
          '"Invite" → choose the role and department first, then the email. The user gets an email, fills in their name and the request comes to you for approval. Until then it shows under invitations, where you resend it, copy the link or cancel it.',
        ],
      },
      {
        el: [
          'Σύνδεσμος εγγραφής και CSV',
          'Για πολλούς μαζί: ο «Σύνδεσμος εγγραφής» μοιράζεται στο προσωπικό, κάνουν εγγραφή και τους εγκρίνετε. «Από αρχείο CSV» (Ονοματεπώνυμο; Email; Τμήμα; Ρόλος) δημιουργεί αμέσως τους λογαριασμούς και ο καθένας λαμβάνει email με όνομα χρήστη και σύνδεσμο κωδικού.',
        ],
        en: [
          'Signup link and CSV',
          'For many at once: share the "Signup link" with staff, they sign up and you approve them. "From CSV file" (Name; Email; Department; Role) creates the accounts at once and each person gets an email with a username and a password link.',
        ],
      },
      {
        el: [
          'Έγκριση',
          'Οι αιτήσεις εμφανίζονται πορτοκαλί και λαμβάνετε email για κάθε νέα. Ελέγξτε όνομα, email και τμήμα, ορίστε ρόλο και πατήστε «Έγκριση» ή «Απόρριψη». Με την έγκριση ο χρήστης λαμβάνει email με το όνομα χρήστη, τον ρόλο, το τμήμα και σύνδεσμο «Ορισμός κωδικού».',
        ],
        en: [
          'Approval',
          'Requests show in orange and you get an email for each new one. Check the name, email and department, set the role and press "Approve" or "Reject". On approval the user gets an email with the username, role, department and a "Set password" link.',
        ],
      },
      {
        el: [
          'Χρήστες',
          'Πατώντας έναν χρήστη αλλάζετε ρόλο, τμήμα, πρόσβαση Demo ή τον απενεργοποιείτε. «Αποστολή συνδέσμου αλλαγής κωδικού» βοηθά όποιον ξέχασε τον κωδικό. Η «Διαγραφή» αφαιρεί εντελώς τον λογαριασμό· το ιστορικό κινήσεών του μένει.',
        ],
        en: [
          'Users',
          'Open a user to change the role, department or Demo access, or to deactivate them. "Send password change link" helps someone who forgot their password. "Delete" removes the account completely; their movement history stays.',
        ],
      },
      {
        el: [
          'Τμήματα',
          'Προσθέστε, μετονομάστε ή απενεργοποιήστε τμήματα. Τα ονόματα εμφανίζονται στις εγγραφές, στις εισαγωγές και σε όλες τις λίστες· απενεργοποιημένο τμήμα δεν προσφέρεται σε νέους χρήστες.',
        ],
        en: [
          'Departments',
          'Add, rename or deactivate departments. The names appear in signups, imports and every list; a deactivated department is not offered to new users.',
        ],
      },
    ],
    steps: {
      el: [
        'Τμήματα: βεβαιωθείτε ότι υπάρχουν όλα.',
        'Χρήστες → «Πρόσκληση», «Σύνδεσμος εγγραφής» ή «Από αρχείο CSV».',
        'Εγκρίνετε τις αιτήσεις με τον σωστό ρόλο.',
        'Πατήστε «Ανανέωση» για τις τελευταίες αιτήσεις.',
      ],
      en: [
        'Departments: make sure they all exist.',
        'Users → "Invite", "Signup link" or "From CSV file".',
        'Approve the requests with the right role.',
        'Press "Refresh" for the latest requests.',
      ],
    },
    checks: {
      el: [
        'Κάθε χρήστης τμήματος έχει το σωστό τμήμα.',
        'Όσοι έφυγαν από το νοσοκομείο είναι ανενεργοί ή διαγραμμένοι.',
      ],
      en: ['Every department user has the right department.', 'People who left the hospital are inactive or deleted.'],
    },
    tip: {
      el: 'Αν ένα email πρόσκλησης δεν φτάνει, ζητήστε να ελέγξουν τα ανεπιθύμητα ή αντιγράψτε τον σύνδεσμο και στείλτε τον εσείς.',
      en: 'If an invitation email does not arrive, ask them to check spam or copy the link and send it yourself.',
    },
    related: ['/start-admin', '/studio'],
  },
  {
    to: '/hospitals',
    permission: 'studio.manage',
    title: {el: 'Νοσοκομεία', en: 'Hospitals'},
    summary: {
      el: 'Όλα τα νοσοκομεία της πλατφόρμας: δημιουργία, κατάσταση και είσοδος για εργασία μέσα σε ένα νοσοκομείο.',
      en: 'Every hospital on the platform: creation, status and entering one to work with its data.',
    },
    audience: {el: 'Διαχειριστής πλατφόρμας (Exeltos)', en: 'Platform administrator (Exeltos)'},
    chapters: [
      {
        el: [
          'Νέο νοσοκομείο',
          '«Νέο νοσοκομείο» με όνομα και κωδικό. Στο Studio → Νοσοκομεία & Demo ορίζετε κανονική χρήση ή δοκιμαστική περίοδο· στο Studio → Επισκόπηση βλέπετε τα νοσοκομεία σε δοκιμαστική περίοδο και την παρατείνετε κατά 30 ημέρες· μετά τη λήξη το νοσοκομείο κλειδώνει για όλους εκτός από εσάς, τα δεδομένα μένουν.',
        ],
        en: [
          'New hospital',
          '"New hospital" with a name and code. In Studio → Hospitals & Demo you set standard use or a trial; in Studio → Overview you see the hospitals on trial and extend them by 30 days; after it ends the hospital locks for everyone but you, the data stays.',
        ],
      },
      {
        el: [
          'Διαχειριστής νοσοκομείου',
          'Από το Studio → Χρήστες επιλέξτε το νοσοκομείο και στείλτε πρόσκληση στον διαχειριστή του. Λαμβάνει απευθείας όνομα χρήστη και σύνδεσμο κωδικού· από εκεί και πέρα προσκαλεί ο ίδιος το προσωπικό του.',
        ],
        en: [
          'Hospital administrator',
          'In Studio → Users pick the hospital and invite its administrator. They get a username and a password link straight away; from then on they invite their own staff.',
        ],
      },
      {
        el: [
          'Είσοδος',
          '«Είσοδος» σας μεταφέρει μέσα στο νοσοκομείο, με τα δικά του δεδομένα και μενού. Η πάνω μπάρα δείχνει πού εργάζεστε· «Έξοδος στο Studio» επιστρέφει.',
        ],
        en: [
          'Enter',
          '"Enter" takes you into the hospital, with its own data and menu. The top bar shows where you are working; "Exit to Studio" takes you back.',
        ],
      },
    ],
    steps: {
      el: [
        'Δημιουργήστε το νοσοκομείο.',
        'Ορίστε δοκιμαστική περίοδο ή κανονική χρήση.',
        'Προσκαλέστε τον διαχειριστή του.',
        'Μπείτε για να βοηθήσετε στην εισαγωγή δεδομένων αν χρειάζεται.',
      ],
      en: [
        'Create the hospital.',
        'Set a trial or standard use.',
        'Invite its administrator.',
        'Enter it to help with the data import if needed.',
      ],
    },
    related: ['/studio'],
  },
];

export const glossary: Array<{term: string; el: string; en: string}> = [
  {
    term: 'Όνομα χρήστη / Username',
    el: 'Ο προσωπικός κωδικός σύνδεσης (π.χ. GN1234: τα αρχικά και τέσσερα ψηφία). Έρχεται με το email έγκρισης· συνδέεστε με αυτό ή με το email σας.',
    en: 'Your personal sign-in code (e.g. GN1234: your initials and four digits). It comes with the approval email; you sign in with it or with your email.',
  },
  {
    term: 'Αίτηση πρόσβασης',
    el: 'Η εγγραφή ενός νέου χρήστη που περιμένει την έγκριση του διαχειριστή του νοσοκομείου. Μέχρι την έγκριση δεν υπάρχει λογαριασμός ούτε κωδικός.',
    en: 'A new user signup waiting for the hospital administrator to approve it. Until approval there is no account and no password.',
  },
  {
    term: 'Πρότυπη σύνθεση',
    el: 'Τι πρέπει να περιέχει ένα Σετ (κωδικός, ονομασία, ποσότητα). Συγκρίνεται με τα πραγματικά εργαλεία του για να φανούν οι ελλείψεις.',
    en: 'What a Set should contain (code, name, quantity). It is compared with its actual instruments to show what is missing.',
  },
  {
    term: 'Έλεγχος ονομασιών',
    el: 'Εργαλείο που κάνει ενιαίες τις ονομασίες: ίδια γραφή και μία ονομασία για κάθε κωδικό.',
    en: 'A tool that makes names consistent: the same spelling and one name per code.',
  },
  {
    term: 'Παρατηρητής / Viewer',
    el: 'Λογαριασμός μόνο προβολής (π.χ. Νοσηλευτική Διεύθυνση): βλέπει επισκόπηση, μητρώα, εκκρεμότητες, ιστορικό και αναφορές όλου του νοσοκομείου, χωρίς να αλλάζει τίποτα. Τον δημιουργεί ο διαχειριστής του νοσοκομείου.',
    en: 'A read-only account (e.g. Nursing Directorate): sees the overview, registries, issues, history and reports of the whole hospital and changes nothing. The hospital administrator creates it.',
  },
  {
    term: 'Σετ / Set',
    el: 'Ομάδα εργαλείων με συγκεκριμένη σύνθεση που αποστειρώνεται και κυκλοφορεί μαζί.',
    en: 'A group of instruments with a defined composition, sterilized and circulated together.',
  },
  {
    term: 'Μεμονωμένο / Standalone',
    el: 'Εργαλείο που ανήκει σε τμήμα και κυκλοφορεί μόνο του, εκτός Σετ.',
    en: 'An instrument that belongs to a department and circulates on its own.',
  },
  {
    term: 'Απόθεμα / Stock',
    el: 'Διαθέσιμα εργαλεία εκτός Σετ και τμημάτων, για συμπλήρωση Σετ.',
    en: 'Available instruments outside Sets and departments, used to complete Sets.',
  },
  {
    term: 'Όριο χρήσεων',
    el: 'Πόσες φορές επιτρέπεται να χρησιμοποιηθεί ένα εργαλείο πολλαπλών χρήσεων. Μειώνεται κατά μία σε κάθε αποστολή μετά από χρήση.',
    en: 'How many times a limited multi-use instrument may be used. One use is counted on each dispatch after use.',
  },
  {
    term: 'Εκτός χρήσης',
    el: 'Εργαλείο που συμπλήρωσε το όριο χρήσεων· φεύγει από τις λίστες και μένει ως ιστορικό στις αναφορές.',
    en: 'An instrument that reached its usage limit; it leaves the lists and stays as history in reports.',
  },
  {
    term: 'Κωδικός ασθενούς',
    el: 'Αναγνωριστικό για ιχνηλασιμότητα, χωρίς ονοματεπώνυμο.',
    en: 'An identifier for traceability, without the patient name.',
  },
  {
    term: 'Barcode',
    el: 'Μοναδικός κωδικός κάθε Σετ (S…) ή εργαλείου (T…) για σάρωση.',
    en: 'The unique scan code of each Set (S…) or instrument (T…).',
  },
  {
    term: 'Αποδέσμευση',
    el: 'Έλεγχος μετά τον κύκλο αποστείρωσης που επιτρέπει τη χρήση του αντικειμένου.',
    en: 'The check after a sterilization cycle that allows the item to be used.',
  },
  {
    term: 'Φορτίο',
    el: 'Τα Σετ και τα εργαλεία που μπαίνουν μαζί στον ίδιο κύκλο κλιβάνου· αποδεσμεύονται ή επιστρέφουν σε επανεπεξεργασία όλα μαζί.',
    en: 'The Sets and instruments that go into the same sterilizer cycle; they are released or sent back to reprocessing together.',
  },
  {
    term: 'Χημικός / βιολογικός δείκτης',
    el: 'Δείκτες που μπαίνουν στο φορτίο και δείχνουν αν ο κύκλος πέτυχε. Δηλώνονται στη φόρτωση, το αποτέλεσμά τους γράφεται στην αποδέσμευση· αρκεί ένας επιτυχής.',
    en: 'Indicators placed in the load that show whether the cycle worked. They are declared at loading and their result is recorded at release; one passed indicator is enough.',
  },
  {
    term: 'Διάρκεια / λήξη αποστείρωσης',
    el: 'Πόσο μένει αποστειρωμένο ένα Σετ ή εργαλείο (2, 3 ή 6 μήνες από την αποδέσμευση). Ειδοποίηση τον τελευταίο μήνα (10 ημέρες για δίμηνη).',
    en: 'How long a Set or instrument stays sterile (2, 3 or 6 months from the release). It warns in the last month (10 days for 2 months).',
  },
  {
    term: 'Ανάκληση',
    el: 'Διαδικασία που μπλοκάρει την κυκλοφορία αντικειμένων από προβληματικό κύκλο.',
    en: 'A procedure that blocks items from a faulty cycle from circulating.',
  },
  {
    term: 'Χρωματική σήμανση',
    el: 'Έγχρωμες ταινίες που αναγνωρίζουν το Σετ ή το εργαλείο με μια ματιά.',
    en: 'Colored tapes that identify a Set or instrument at a glance.',
  },
];
