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
          'Χρήσεις και ζωές',
          'Για εργαλεία περιορισμένων χρήσεων φαίνεται το υπόλοιπο ζωών. Κάθε αποστολή μετά από χρήση αφαιρεί μία ζωή· στο μηδέν το εργαλείο τίθεται αυτόματα εκτός χρήσης.',
        ],
        en: [
          'Uses and lives',
          'Limited-use instruments show their remaining lives. Each dispatch after use takes one life; at zero the instrument is taken out of use automatically.',
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
        'Ελέγξτε την κατάσταση και το υπόλοιπο ζωών.',
        'Δείτε το ιστορικό για την τελευταία κίνηση.',
        'Χρησιμοποιήστε την ενέργεια που χρειάζεστε από πάνω δεξιά.',
      ],
      en: [
        'Check the state and remaining lives.',
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
          'Κάθε δείκτης στην κορυφή είναι σύνδεσμος. Πατώντας τον ανοίγει η αντίστοιχη λίστα με τα σωστά φίλτρα ήδη εφαρμοσμένα, π.χ. «Κοντά στο όριο χρήσεων» ανοίγει τα Εργαλεία με φίλτρο «Λίγες ζωές».',
        ],
        en: [
          'Indicators (KPIs)',
          'Every indicator at the top is a link. It opens the matching list with its filters already applied, e.g. "Near usage limit" opens Instruments filtered to "Few lives left".',
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
          'Εργαλεία με ζωές',
          'Για εργαλεία πολλαπλών χρήσεων με όριο (π.χ. ρομποτικά), η αποστολή ζητά υποχρεωτικά κωδικό ασθενούς και επιβεβαίωση μείωσης μίας ζωής. Στην τελευταία ζωή το εργαλείο τίθεται αυτόματα εκτός χρήσης.',
        ],
        en: [
          'Instruments with lives',
          'For limited multi-use instruments (e.g. robotic), sending requires a patient code and confirming one life is used. On the last life the instrument is taken out of use automatically.',
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
        'Η μείωση ζωής επιβεβαιώθηκε για τα εργαλεία περιορισμένων χρήσεων.',
      ],
      en: [
        'The patient code contains no patient name.',
        'The life reduction was confirmed for limited-use instruments.',
      ],
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
      el: 'Η ροή της Κεντρικής Αποστείρωσης: παραλαβή, καθαρισμός, σύνθεση, συσκευασία, κύκλος, αποδέσμευση, αποθήκευση και παράδοση.',
      en: 'The Central Sterilization flow: receipt, washing, preparation, packaging, cycle, release, storage and delivery.',
    },
    audience: {el: 'Χρήστες και Προϊστάμενος Αποστείρωσης', en: 'Sterilization users and supervisor'},
    chapters: [
      {
        el: [
          'Καρτέλες σταδίων',
          'Κάθε καρτέλα είναι ένα στάδιο. Ο αριθμός δείχνει πόσα περιμένουν. Τα στάδια που είναι απενεργοποιημένα στο Studio δεν εμφανίζονται.',
        ],
        en: [
          'Stage tabs',
          'Each tab is a stage and its number shows how many are waiting. Stages disabled in Studio are not shown.',
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
          'Κύκλος & αποδέσμευση',
          'Καταγράψτε τον κύκλο (αποστειρωτής, αριθμός κύκλου). Αποτυχημένος κύκλος επιστρέφει τα αντικείμενα για επανεπεξεργασία. Μετά την αποδέσμευση το αντικείμενο πάει σε αποθήκευση ή είναι έτοιμο για παραλαβή.',
        ],
        en: [
          'Cycle & release',
          'Record the cycle (sterilizer, cycle number). A failed cycle sends items back for reprocessing. After release the item goes to storage or is ready for pickup.',
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
      el: ['Η σύνθεση του Σετ ελέγχθηκε πριν τη συσκευασία.', 'Ο κύκλος καταγράφηκε με αριθμό και αποστειρωτή.'],
      en: ['The Set composition was checked before packaging.', 'The cycle was recorded with number and sterilizer.'],
    },
    tip: {
      el: 'Ένα αντικείμενο σε ενεργή ανάκληση ή χωρίς υπόλοιπο ζωών δεν μπορεί να κυκλοφορήσει: η εφαρμογή το σταματά.',
      en: 'An item under an active recall or with no lives left cannot circulate: the app stops it.',
    },
    related: ['/issues', '/sets', '/movements'],
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
          '«Πολλαπλών χρήσεων (με ζωές)» δείχνει εργαλεία με όριο χρήσεων, «Λίγες ζωές» όσα πλησιάζουν στο όριο και «Χωρίς όριο» τα υπόλοιπα.',
        ],
        en: [
          'Usage type',
          '"Multi-use (with lives)" shows instruments with a usage limit, "Few lives left" those near it and "No limit" the rest.',
        ],
      },
      {
        el: [
          'Καρτέλα εργαλείου',
          'Πατώντας ένα εργαλείο βλέπετε ιστορικό, φωτογραφίες, χρήσεις, χρωματική σήμανση και ιδιοκτησία. Οι ζωές αλλάζουν μόνο από τον Διαχειριστή και τον Προϊστάμενο Αποστείρωσης.',
        ],
        en: [
          'Instrument card',
          'Opening an instrument shows history, photos, uses, color marker and ownership. Lives can be changed only by the Administrator and the Sterilization supervisor.',
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
    related: ['/sets', '/stock', '/standalone-tools'],
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
    related: ['/tools', '/stock', '/reports'],
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
          'Μεμονωμένο είναι ένα εργαλείο που ανήκει σε τμήμα και κυκλοφορεί μόνο του. Πολλά ρομποτικά εργαλεία με ζωές είναι μεμονωμένα.',
        ],
        en: [
          'What it is',
          'A standalone instrument belongs to a department and circulates on its own. Many robotic instruments with lives are standalone.',
        ],
      },
      {
        el: [
          'Ζωές',
          'Οι δείκτες «Πολλαπλών χρήσεων» και «Λίγες ζωές» φιλτράρουν τη λίστα. Το υπόλοιπο φαίνεται σε κάθε γραμμή.',
        ],
        en: [
          'Lives',
          'The "Multi-use" and "Few lives left" indicators filter the list. Remaining lives show on each row.',
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
    related: ['/sets', '/tools'],
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
    ],
    steps: {
      el: [
        'Φιλτράρετε «Ανοιχτές».',
        'Ανοίξτε την εκκρεμότητα και δείτε σημείωση και φωτογραφίες.',
        'Επιλύστε και κλείστε την.',
      ],
      en: ['Filter "Open".', 'Open the issue and see its note and photos.', 'Resolve and close it.'],
    },
    related: ['/sterilization', '/movements'],
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
          'Τμήματα, ειδικότητες, κατασκευαστές και τύποι εκκρεμοτήτων. Ό,τι ορίζεται εδώ εμφανίζεται στις επιλογές όλης της εφαρμογής.',
        ],
        en: [
          'Libraries',
          'Departments, specialties, manufacturers and issue types. Whatever you define here appears in the choices across the app.',
        ],
      },
      {
        el: [
          'Δικαιώματα',
          'Ορίστε τι κάνει κάθε ρόλος. Κάποια δικαιώματα (δημιουργία, σύνθεση, ζωές) ανήκουν μόνο στον Προϊστάμενο Αποστείρωσης.',
        ],
        en: [
          'Permissions',
          'Set what each role can do. Some permissions (creation, composition, lives) belong only to the Sterilization supervisor.',
        ],
      },
    ],
    steps: {
      el: ['Επιλέξτε ενότητα.', 'Κάντε τις αλλαγές.', 'Αποθηκεύστε· οι αλλαγές ισχύουν αμέσως.'],
      en: ['Pick a section.', 'Make your changes.', 'Save; changes apply at once.'],
    },
    related: ['/overview'],
  },
];

export const glossary: Array<{term: string; el: string; en: string}> = [
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
    term: 'Ζωές / Όριο χρήσεων',
    el: 'Πόσες φορές επιτρέπεται να χρησιμοποιηθεί ένα εργαλείο πολλαπλών χρήσεων. Μειώνεται κατά μία σε κάθε αποστολή μετά από χρήση.',
    en: 'How many times a limited multi-use instrument may be used. One life is used on each dispatch after use.',
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
