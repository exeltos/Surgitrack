import type {Issue, Movement, SetAsset, Tool} from '../types/domain';
export const sets: SetAsset[] = [
  {
    id: 's1',
    barcode: 'S000321',
    code: 'ORTHO-BASIC',
    name: 'ΟΡΘΟΠΕΔΙΚΟ ΒΑΣΙΚΟ',
    department: 'Χειρουργείο',
    specialty: 'Ορθοπεδική',
    manufacturer: 'AESCULAP',
    state: 'IN_DEPARTMENT',
    expected: 14,
    actual: 14,
    category: 'Χειρουργικά Σετ',
    createdAt: '10/01/2026',
    uses: 24,
    maxUses: 60,
  },
  {
    id: 's2',
    barcode: 'S000322',
    code: 'LAP-GEN',
    name: 'ΛΑΠΑΡΟΣΚΟΠΙΚΟ ΒΑΣΙΚΟ',
    department: 'Χειρουργείο',
    specialty: 'Γενική Χειρουργική',
    manufacturer: 'KARL STORZ',
    state: 'READY_FOR_PICKUP',
    expected: 12,
    actual: 12,
    category: 'Χειρουργικά Σετ',
    createdAt: '12/02/2026',
    uses: 17,
    maxUses: 50,
  },
  {
    id: 's3',
    barcode: 'S000323',
    code: 'GYN-LAP',
    name: 'ΓΥΝΑΙΚΟΛΟΓΙΚΗΣ ΛΑΠΑΡΟΤΟΜΗΣ',
    department: 'Γυναικολογική Κλινική',
    specialty: 'Γυναικολογική',
    manufacturer: 'DEWIMED',
    state: 'IN_DEPARTMENT',
    expected: 13,
    actual: 13,
    category: 'Χειρουργικά Σετ',
    createdAt: '03/03/2026',
  },
  {
    id: 's4',
    barcode: 'S000324',
    code: 'NEURO-01',
    name: 'ΝΕΥΡΟΧΕΙΡΟΥΡΓΙΚΟ ΒΑΣΙΚΟ',
    department: 'Χειρουργείο',
    specialty: 'Νευροχειρουργική',
    manufacturer: 'KLS MARTIN',
    state: 'IN_PREPARATION',
    expected: 11,
    actual: 10,
    category: 'Χειρουργικά Σετ',
    createdAt: '20/03/2026',
    compositionTemplate: [
      {code: '12.320.20', name: 'KOCHER ΕΥΘΕΙΑ 20 CM', quantity: 2},
      {code: '08.280.18', name: 'ΨΑΛΙΔΙ MAYO ΕΥΘΥ 18 CM', quantity: 2},
      {code: '24.180.20', name: 'ΒΕΛΟΝΟΚΑΤΟΧΟ MAYO-HEGAR 20 CM', quantity: 2},
      {code: '10.110.16', name: 'ΛΑΒΙΔΑ ΑΝΑΤΟΜΙΚΗ 16 CM', quantity: 2},
      {code: '11.410.16', name: 'ΛΑΒΙΔΑ ΧΕΙΡΟΥΡΓΙΚΗ 16 CM', quantity: 1},
      {code: '42.300.01', name: 'ΑΓΚΙΣΤΡΟ LANGENBECK', quantity: 1},
      {code: '70.510.05', name: 'ΛΑΠΑΡΟΣΚΟΠΙΚΗ ΛΑΒΙΔΑ 5MM', quantity: 1},
    ],
  },
  {
    id: 's5',
    barcode: 'S000325',
    code: 'DELIVERY-01',
    name: 'SET ΦΥΣΙΟΛΟΓΙΚΟΥ ΤΟΚΕΤΟΥ',
    department: 'Αίθουσα Τοκετών',
    specialty: 'Μαιευτική',
    manufacturer: 'AESCULAP',
    state: 'IN_DEPARTMENT',
    expected: 10,
    actual: 10,
    category: 'Μαιευτικά Σετ',
    createdAt: '02/04/2026',
    uses: 18,
    maxUses: 50,
  },
  {
    id: 's6',
    barcode: 'S000326',
    code: 'CSECTION-01',
    name: 'SET ΚΑΙΣΑΡΙΚΗΣ ΤΟΜΗΣ',
    department: 'Αίθουσα Τοκετών',
    specialty: 'Μαιευτική',
    manufacturer: 'DEWIMED',
    state: 'READY_FOR_PICKUP',
    expected: 12,
    actual: 12,
    category: 'Μαιευτικά Σετ',
    createdAt: '05/04/2026',
    uses: 27,
    maxUses: 30,
  },
  {
    id: 's7',
    barcode: 'S000327',
    code: 'EPISIO-01',
    name: 'SET ΕΠΙΣΙΟΤΟΜΗΣ',
    department: 'Αίθουσα Τοκετών',
    specialty: 'Μαιευτική',
    manufacturer: 'KLS MARTIN',
    state: 'PENDING_STERILIZATION',
    expected: 8,
    actual: 8,
    category: 'Μαιευτικά Σετ',
    createdAt: '08/04/2026',
  },
];

type ToolSeed = {code: string; name: string; manufacturer: string; specialty: string; maxUses?: number};
const catalog: ToolSeed[] = [
  {
    code: '12.320.20',
    name: 'KOCHER ΕΥΘΕΙΑ 20 CM',
    manufacturer: 'DEWIMED',
    specialty: 'Γενική Χειρουργική',
    maxUses: 50,
  },
  {
    code: '08.280.18',
    name: 'ΨΑΛΙΔΙ MAYO ΕΥΘΥ 18 CM',
    manufacturer: 'AESCULAP',
    specialty: 'Γενική Χειρουργική',
    maxUses: 50,
  },
  {
    code: '24.180.20',
    name: 'ΒΕΛΟΝΟΚΑΤΟΧΟ MAYO-HEGAR 20 CM',
    manufacturer: 'DEWIMED',
    specialty: 'Γενική Χειρουργική',
    maxUses: 50,
  },
  {code: '10.110.16', name: 'ΛΑΒΙΔΑ ΑΝΑΤΟΜΙΚΗ 16 CM', manufacturer: 'AESCULAP', specialty: 'Γενική Χειρουργική'},
  {code: '11.410.16', name: 'ΛΑΒΙΔΑ ΧΕΙΡΟΥΡΓΙΚΗ 16 CM', manufacturer: 'KLS MARTIN', specialty: 'Γενική Χειρουργική'},
  {code: '42.300.01', name: 'ΑΓΚΙΣΤΡΟ LANGENBECK', manufacturer: 'AESCULAP', specialty: 'Γενική Χειρουργική'},
  {
    code: '70.510.05',
    name: 'ΛΑΠΑΡΟΣΚΟΠΙΚΗ ΛΑΒΙΔΑ 5MM',
    manufacturer: 'KARL STORZ',
    specialty: 'Γενική Χειρουργική',
    maxUses: 30,
  },
];
let n = 1200;
const tools: Tool[] = [];
let serial = 20000;
const add = (
  seed: ToolSeed,
  mode: Tool['mode'],
  opts: {setId?: string; department?: string; state?: Tool['state']; uses?: number; maxUses?: number} = {},
) => {
  n++;
  serial++;
  tools.push({
    id: `t${n}`,
    barcode: `T${String(n).padStart(6, '0')}`,
    code: seed.code,
    name: seed.name,
    department: opts.department,
    specialty: seed.specialty,
    manufacturer: seed.manufacturer,
    mode,
    setId: opts.setId,
    state: opts.state || (mode === 'STOCK' ? 'IN_STOCK' : 'IN_DEPARTMENT'),
    uses: opts.uses ?? Math.floor((n % 17) + 4),
    sterilizations: (opts.uses ?? 10) + 2,
    maxUses: opts.maxUses ?? seed.maxUses,
    serialNumber: `SN-${serial}`,
    purchaseDate: '15/01/2026',
    warrantyUntil: '15/01/2029',
  });
};
// Set members: deliberately repeated physical instruments with unique barcodes.
for (const cfg of [
  {id: 's1', dep: 'Χειρουργείο', count: 14},
  {id: 's2', dep: 'Χειρουργείο', count: 12},
  {id: 's3', dep: 'Γυναικολογική Κλινική', count: 13},
  {id: 's4', dep: 'Χειρουργείο', count: 10},
  {id: 's5', dep: 'Αίθουσα Τοκετών', count: 10},
  {id: 's6', dep: 'Αίθουσα Τοκετών', count: 12},
  {id: 's7', dep: 'Αίθουσα Τοκετών', count: 8},
])
  for (let i = 0; i < cfg.count; i++)
    add(catalog[i % catalog.length], 'SET_MEMBER', {
      setId: cfg.id,
      department: cfg.dep,
      state: ['s2', 's6'].includes(cfg.id)
        ? 'READY_FOR_PICKUP'
        : cfg.id === 's4'
          ? 'IN_PREPARATION'
          : cfg.id === 's7'
            ? 'PENDING_STERILIZATION'
            : 'IN_DEPARTMENT',
      uses: 10 + (i % 15),
    });
// Stock: multiple identical instruments available for replacement/new sets.
for (let i = 0; i < 14; i++) add(catalog[i % 5], 'STOCK', {uses: 0});
// Standalone instruments in use by departments, including limited-use alerts.
const standDeps = ['ΜΕΘ', 'ΤΕΠ', 'Γυναικολογική Κλινική', 'Ορθοπεδική Κλινική', 'Χειρουργείο'];
for (let i = 0; i < 10; i++)
  add(catalog[i % catalog.length], 'STANDALONE', {department: standDeps[i % standDeps.length], uses: 12 + i});
add(catalog[6], 'STANDALONE', {department: 'Χειρουργείο', uses: 27, maxUses: 30});
add(catalog[6], 'STANDALONE', {department: 'Χειρουργείο', uses: 28, maxUses: 30});
add(catalog[1], 'STOCK', {uses: 49, maxUses: 50});
add(catalog[0], 'STANDALONE', {department: 'ΤΕΠ', uses: 50, maxUses: 50});
// Department Workspace demo: enough assets in Αίθουσα Τοκετών to test filters, reports and electronic transfer.
add(catalog[0], 'STANDALONE', {department: 'Αίθουσα Τοκετών', uses: 12, maxUses: 50});
add(catalog[1], 'STANDALONE', {department: 'Αίθουσα Τοκετών', uses: 22, maxUses: 50});
add(catalog[2], 'STANDALONE', {department: 'Αίθουσα Τοκετών', uses: 47, maxUses: 50});
add(catalog[3], 'STANDALONE', {department: 'Αίθουσα Τοκετών', uses: 9});
add(catalog[6], 'STANDALONE', {department: 'Αίθουσα Τοκετών', uses: 28, maxUses: 30});
// Put one standalone instrument already in the sterilization flow and one ready for pickup.
tools[tools.length - 2].state = 'PENDING_STERILIZATION';
tools[tools.length - 1].state = 'READY_FOR_PICKUP';
export {tools};
export const movements: Movement[] = [
  {
    id: 'm1',
    asset: 'S000322 · ΛΑΠΑΡΟΣΚΟΠΙΚΟ ΒΑΣΙΚΟ',
    assetKind: 'SET',
    from: 'Κεντρική Αποστείρωση',
    to: 'Καθαρός χώρος',
    status: 'Ολοκλήρωση κύκλου αποστείρωσης',
    at: '13/08/2026 17:42',
    by: 'Μαρία Παπαδοπούλου',
  },
  {
    id: 'm2',
    asset: 'S000324 · ΝΕΥΡΟΧΕΙΡΟΥΡΓΙΚΟ ΒΑΣΙΚΟ',
    assetKind: 'SET',
    from: 'Χειρουργείο',
    to: 'Κεντρική Αποστείρωση',
    status: 'Παραλαβή και έλεγχος',
    at: '13/08/2026 16:25',
    by: 'Μαρία Παπαδοπούλου',
  },
  {
    id: 'm3',
    asset: 'T001261 · ΛΑΠΑΡΟΣΚΟΠΙΚΗ ΛΑΒΙΔΑ 5MM',
    assetKind: 'TOOL',
    from: 'Χειρουργείο',
    to: 'Κεντρική Αποστείρωση',
    status: 'Αποστολή προς αποστείρωση',
    at: '13/08/2026 15:08',
    by: 'Νίκος Δημητρίου',
  },
  {
    id: 'm4',
    asset: 'S000327 · SET ΕΠΙΣΙΟΤΟΜΗΣ',
    assetKind: 'SET',
    from: 'Αίθουσα Τοκετών',
    to: 'Κεντρική Αποστείρωση',
    status: 'Ηλεκτρονικά προωθημένο · αναμονή φυσικής παράδοσης',
    at: '14/08/2026 09:20',
    by: 'Demo Χρήστης Τμήματος',
    patientCode: 'PT-2026-0041',
  },
  {
    id: 'm5',
    asset: 'S000326 · SET ΚΑΙΣΑΡΙΚΗΣ ΤΟΜΗΣ',
    assetKind: 'SET',
    from: 'Κεντρική Αποστείρωση',
    to: 'Αίθουσα Τοκετών',
    status: 'Κλιβανισμός ολοκληρώθηκε · έτοιμο για παραλαβή',
    at: '14/08/2026 08:45',
    by: 'Demo Χρήστης Αποστείρωσης',
  },
  {
    id: 'm6',
    asset: 'T001311 · ΛΑΒΙΔΑ ΑΝΑΤΟΜΙΚΗ 16 CM',
    assetKind: 'TOOL',
    from: 'Αίθουσα Τοκετών',
    to: 'Κεντρική Αποστείρωση',
    status: 'Ηλεκτρονικά προωθημένο · αναμονή φυσικής παράδοσης',
    at: '14/08/2026 09:28',
    by: 'Demo Χρήστης Τμήματος',
    patientCode: 'PT-2026-0041',
  },
];
export const issues: Issue[] = [
  {
    id: 'i1',
    asset: 'S000324 · ΝΕΥΡΟΧΕΙΡΟΥΡΓΙΚΟ ΒΑΣΙΚΟ',
    type: 'Έλλειψη',
    status: 'OPEN',
    created: '13/08/2026 16:30',
    department: 'Χειρουργείο',
    note: 'Αναμενόμενα 11 / διαθέσιμα 10 εργαλεία.',
  },
  {
    id: 'i2',
    asset: 'T001205 · ΛΑΒΙΔΑ ΧΕΙΡΟΥΡΓΙΚΗ 16 CM',
    type: 'Service',
    status: 'OPEN',
    created: '12/08/2026 11:15',
    department: 'Χειρουργείο',
    note: 'Απαιτείται τεχνικός έλεγχος άρθρωσης.',
  },
  {
    id: 'i3',
    asset: 'S000325 · SET ΦΥΣΙΟΛΟΓΙΚΟΥ ΤΟΚΕΤΟΥ',
    type: 'Φθορά',
    status: 'OPEN',
    created: '14/08/2026 10:05',
    department: 'Αίθουσα Τοκετών',
    note: 'Παρατηρήθηκε φθορά σε ένα εργαλείο της σύνθεσης. Demo αναφορά για έλεγχο της ροής.',
  },
];
