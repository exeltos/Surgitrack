import {isoDate} from '../core/sterileExpiry';
import type {
  DeliveryRecord,
  Issue,
  Movement,
  ProcessLoadRecord,
  PurchaseOrder,
  ReceiptRecord,
  SetAsset,
  Tool,
} from '../types/domain';
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

// A fuller demo hospital: Sets in every Sterilization stage, more departments, color markers,
// sterilizer loads, handover history and instruments out of use. Appended after the original
// demo so earlier barcodes stay the same.
type ExtraSet = {
  id: string;
  code: string;
  name: string;
  department: string;
  specialty: string;
  manufacturer: string;
  state: SetAsset['state'];
  count: number;
  category: string;
  colorTapes?: string[];
  uses?: number;
  maxUses?: number;
};
const extraSets: ExtraSet[] = [
  {
    id: 's8',
    code: 'ORTHO-HIP',
    name: 'ΟΡΘΟΠΕΔΙΚΟ ΙΣΧΙΟΥ',
    department: 'Ορθοπεδική Κλινική',
    specialty: 'Ορθοπεδική',
    manufacturer: 'AESCULAP',
    state: 'PENDING_STERILIZATION',
    count: 16,
    category: 'Χειρουργικά Σετ',
    colorTapes: ['solid-02', 'solid-05'],
  },
  {
    id: 's9',
    code: 'IVF-OPU',
    name: 'SET ΩΟΛΗΨΙΑΣ',
    department: 'Μονάδα IVF',
    specialty: 'Γυναικολογική',
    manufacturer: 'KARL STORZ',
    state: 'PENDING_STERILIZATION',
    count: 8,
    category: 'Μαιευτικά Σετ',
    colorTapes: ['solid-11'],
  },
  {
    id: 's10',
    code: 'LAP-CHOLE',
    name: 'ΛΑΠΑΡΟΣΚΟΠΙΚΗ ΧΟΛΟΚΥΣΤΕΚΤΟΜΗ',
    department: 'Χειρουργείο',
    specialty: 'Γενική Χειρουργική',
    manufacturer: 'KARL STORZ',
    state: 'IN_WASHING',
    count: 13,
    category: 'Χειρουργικά Σετ',
    colorTapes: ['solid-03'],
  },
  {
    id: 's11',
    code: 'ER-SUTURE',
    name: 'SET ΣΥΡΡΑΦΗΣ ΤΕΠ',
    department: 'ΤΕΠ',
    specialty: 'Γενική Χειρουργική',
    manufacturer: 'DEWIMED',
    state: 'IN_WASHING',
    count: 7,
    category: 'Μικρά Σετ',
  },
  {
    id: 's12',
    code: 'ORTHO-KNEE',
    name: 'ΟΡΘΟΠΕΔΙΚΟ ΓΟΝΑΤΟΣ',
    department: 'Ορθοπεδική Κλινική',
    specialty: 'Ορθοπεδική',
    manufacturer: 'AESCULAP',
    state: 'IN_PREPARATION',
    count: 15,
    category: 'Χειρουργικά Σετ',
    colorTapes: ['solid-02', 'number-05-2'],
  },
  {
    id: 's13',
    code: 'URO-TUR',
    name: 'ΟΥΡΟΛΟΓΙΚΟ TUR',
    department: 'Χειρουργείο',
    specialty: 'Ουρολογία',
    manufacturer: 'KARL STORZ',
    state: 'IN_PACKAGING',
    count: 11,
    category: 'Χειρουργικά Σετ',
    colorTapes: ['solid-14'],
  },
  {
    id: 's14',
    code: 'GYN-HYST',
    name: 'ΥΣΤΕΡΟΣΚΟΠΗΣΗΣ',
    department: 'Γυναικολογική Κλινική',
    specialty: 'Γυναικολογική',
    manufacturer: 'KARL STORZ',
    state: 'IN_STERILIZATION',
    count: 9,
    category: 'Χειρουργικά Σετ',
    uses: 41,
    maxUses: 60,
  },
  {
    id: 's15',
    code: 'GEN-LAPAROT',
    name: 'ΓΕΝΙΚΗΣ ΛΑΠΑΡΟΤΟΜΙΑΣ',
    department: 'Χειρουργείο',
    specialty: 'Γενική Χειρουργική',
    manufacturer: 'B. BRAUN',
    state: 'IN_STERILIZATION',
    count: 18,
    category: 'Χειρουργικά Σετ',
    colorTapes: ['stripes-01-02'],
  },
  {
    id: 's16',
    code: 'CSECTION-02',
    name: 'SET ΚΑΙΣΑΡΙΚΗΣ ΤΟΜΗΣ Β',
    department: 'Αίθουσα Τοκετών',
    specialty: 'Μαιευτική',
    manufacturer: 'DEWIMED',
    state: 'AWAITING_RELEASE',
    count: 12,
    category: 'Μαιευτικά Σετ',
    uses: 12,
    maxUses: 30,
  },
  {
    id: 's17',
    code: 'NEURO-02',
    name: 'ΝΕΥΡΟΧΕΙΡΟΥΡΓΙΚΟ ΚΡΑΝΙΟΤΟΜΙΑΣ',
    department: 'Χειρουργείο',
    specialty: 'Νευροχειρουργική',
    manufacturer: 'KLS MARTIN',
    state: 'AWAITING_RELEASE',
    count: 14,
    category: 'Χειρουργικά Σετ',
    colorTapes: ['solid-06'],
  },
  {
    id: 's18',
    code: 'ICU-TRACH',
    name: 'SET ΤΡΑΧΕΙΟΣΤΟΜΙΑΣ',
    department: 'ΜΕΘ',
    specialty: 'Γενική Χειρουργική',
    manufacturer: 'AESCULAP',
    state: 'READY_FOR_PICKUP',
    count: 9,
    category: 'Μικρά Σετ',
  },
  {
    id: 's19',
    code: 'IVF-ET',
    name: 'SET ΕΜΒΡΥΟΜΕΤΑΦΟΡΑΣ',
    department: 'Μονάδα IVF',
    specialty: 'Γυναικολογική',
    manufacturer: 'KARL STORZ',
    state: 'IN_DEPARTMENT',
    count: 6,
    category: 'Μαιευτικά Σετ',
    colorTapes: ['solid-11', 'solid-01'],
  },
  {
    id: 's20',
    code: 'ER-MINOR',
    name: 'SET ΜΙΚΡΟΕΠΕΜΒΑΣΕΩΝ ΤΕΠ',
    department: 'ΤΕΠ',
    specialty: 'Γενική Χειρουργική',
    manufacturer: 'DEWIMED',
    state: 'IN_DEPARTMENT',
    count: 10,
    category: 'Μικρά Σετ',
  },
  {
    id: 's21',
    code: 'VASC-01',
    name: 'ΑΓΓΕΙΟΧΕΙΡΟΥΡΓΙΚΟ',
    department: 'Χειρουργείο',
    specialty: 'Γενική Χειρουργική',
    manufacturer: 'B. BRAUN',
    state: 'IN_DEPARTMENT',
    count: 17,
    category: 'Χειρουργικά Σετ',
    colorTapes: ['solid-04'],
    uses: 55,
    maxUses: 60,
  },
  {
    id: 's22',
    code: 'GYN-DC',
    name: 'SET ΑΠΟΞΕΣΗΣ',
    department: 'Γυναικολογική Κλινική',
    specialty: 'Γυναικολογική',
    manufacturer: 'AESCULAP',
    state: 'READY_FOR_PICKUP',
    count: 8,
    category: 'Μικρά Σετ',
  },
];
let setSerial = 327;
for (const extra of extraSets) {
  setSerial++;
  sets.push({
    id: extra.id,
    barcode: `S${String(setSerial).padStart(6, '0')}`,
    code: extra.code,
    name: extra.name,
    department: extra.department,
    specialty: extra.specialty,
    manufacturer: extra.manufacturer,
    state: extra.state,
    expected: extra.count,
    actual: extra.count,
    category: extra.category,
    createdAt: '15/05/2026',
    colorTapes: extra.colorTapes,
    uses: extra.uses,
    maxUses: extra.maxUses,
  });
  for (let i = 0; i < extra.count; i++)
    add(catalog[(i + setSerial) % catalog.length], 'SET_MEMBER', {
      setId: extra.id,
      department: extra.department,
      state: extra.state,
      uses: 6 + ((i * 7) % 30),
    });
}
// Standalone instruments across the Sterilization stages and more departments.
const flowStates: Tool['state'][] = [
  'PENDING_STERILIZATION',
  'IN_WASHING',
  'IN_PREPARATION',
  'IN_PACKAGING',
  'IN_STERILIZATION',
  'READY_FOR_PICKUP',
];
flowStates.forEach((state, i) =>
  add(catalog[i % catalog.length], 'STANDALONE', {department: standDeps[i % standDeps.length], state, uses: 8 + i}),
);
for (let i = 0; i < 6; i++)
  add(catalog[(i + 2) % catalog.length], 'STANDALONE', {department: 'Μονάδα IVF', uses: 5 + i * 3});
// More stock, and instruments that reached their use limit (kept out of the lists, in reports).
for (let i = 0; i < 8; i++) add(catalog[(i + 3) % catalog.length], 'STOCK', {uses: 0});
for (const [i, department] of ['Χειρουργείο', 'ΤΕΠ', 'Αίθουσα Τοκετών'].entries()) {
  add(catalog[6], 'STANDALONE', {department, uses: 30, maxUses: 30});
  const retired = tools[tools.length - 1];
  retired.state = 'RETIRED';
  retired.retiredAt = `0${i + 2}/09/2026 1${i}:20`;
  retired.retiredReason = 'Συμπλήρωση ορίου χρήσεων';
}
// Resuscitation (Ambu): reusable bags, masks and laryngoscope blades that each take a limited number
// of sterilizations, as their makers set. Two Sets, bags in the departments that resuscitate, one
// bag near its limit, one that reached it, and new ones in Stock.
const ambu = {
  bagAdult: {code: 'AMBU-MK4-A', name: 'ΑΣΚΟΣ ΑΝΑΖΩΟΓΟΝΗΣΗΣ AMBU MARK IV ΕΝΗΛΙΚΩΝ', maxUses: 30},
  bagChild: {code: 'AMBU-MK4-P', name: 'ΑΣΚΟΣ ΑΝΑΖΩΟΓΟΝΗΣΗΣ AMBU MARK IV ΠΑΙΔΙΚΟΣ', maxUses: 30},
  bagBaby: {code: 'AMBU-MK4-N', name: 'ΑΣΚΟΣ ΑΝΑΖΩΟΓΟΝΗΣΗΣ AMBU MARK IV ΝΕΟΓΝΙΚΟΣ', maxUses: 30},
  mask4: {code: 'AMBU-MSK-4', name: 'ΜΑΣΚΑ ΣΙΛΙΚΟΝΗΣ AMBU No 4', maxUses: 50},
  mask5: {code: 'AMBU-MSK-5', name: 'ΜΑΣΚΑ ΣΙΛΙΚΟΝΗΣ AMBU No 5', maxUses: 50},
  mask2: {code: 'AMBU-MSK-2', name: 'ΜΑΣΚΑ ΣΙΛΙΚΟΝΗΣ AMBU No 2', maxUses: 50},
  peep: {code: 'AMBU-PEEP-20', name: 'ΒΑΛΒΙΔΑ PEEP 20 AMBU', maxUses: 40},
  reservoir: {code: 'AMBU-RES-1500', name: 'ΑΣΚΟΣ ΑΠΟΘΕΜΑΤΟΣ Ο2 1500 ML', maxUses: 30},
  blade3: {code: 'MAC-3', name: 'ΛΑΜΑ ΛΑΡΥΓΓΟΣΚΟΠΙΟΥ MACINTOSH No 3', maxUses: 200},
  blade4: {code: 'MAC-4', name: 'ΛΑΜΑ ΛΑΡΥΓΓΟΣΚΟΠΙΟΥ MACINTOSH No 4', maxUses: 200},
  blade1: {code: 'MIL-1', name: 'ΛΑΜΑ ΛΑΡΥΓΓΟΣΚΟΠΙΟΥ MILLER No 1', maxUses: 200},
};
const airway = (item: {code: string; name: string; maxUses: number}): ToolSeed => ({
  ...item,
  manufacturer: item.code.startsWith('AMBU') ? 'AMBU' : 'KARL STORZ',
  specialty: 'Αναισθησιολογία',
});
const resuscitationSets: Array<{
  id: string;
  code: string;
  name: string;
  department: string;
  state: SetAsset['state'];
  items: Array<[keyof typeof ambu, number]>;
}> = [
  {
    id: 's23',
    code: 'RESUS-ADULT',
    name: 'ΣΕΤ ΑΝΑΖΩΟΓΟΝΗΣΗΣ ΕΝΗΛΙΚΩΝ (AMBU)',
    department: 'ΤΕΠ',
    state: 'IN_DEPARTMENT',
    items: [
      ['bagAdult', 26],
      ['mask4', 41],
      ['mask5', 18],
      ['peep', 33],
      ['reservoir', 26],
      ['blade3', 120],
      ['blade4', 96],
    ],
  },
  {
    id: 's24',
    code: 'RESUS-PAED',
    name: 'ΣΕΤ ΑΝΑΖΩΟΓΟΝΗΣΗΣ ΠΑΙΔΙΚΟ (AMBU)',
    department: 'ΜΕΘ',
    state: 'PENDING_STERILIZATION',
    items: [
      ['bagChild', 14],
      ['mask2', 22],
      ['reservoir', 14],
      ['blade1', 61],
    ],
  },
];
for (const resus of resuscitationSets) {
  setSerial++;
  sets.push({
    id: resus.id,
    barcode: `S${String(setSerial).padStart(6, '0')}`,
    code: resus.code,
    name: resus.name,
    department: resus.department,
    specialty: 'Αναισθησιολογία',
    manufacturer: 'AMBU',
    state: resus.state,
    expected: resus.items.length,
    actual: resus.items.length,
    category: 'Σετ Αναζωογόνησης',
    createdAt: '01/06/2026',
    colorTapes: ['solid-01'],
  });
  for (const [key, uses] of resus.items)
    add(airway(ambu[key]), 'SET_MEMBER', {setId: resus.id, department: resus.department, state: resus.state, uses});
}
// Ambu bags kept in the departments, one per resuscitation trolley.
add(airway(ambu.bagAdult), 'STANDALONE', {department: 'ΜΕΘ', uses: 28});
add(airway(ambu.bagAdult), 'STANDALONE', {department: 'Χειρουργείο', uses: 29});
add(airway(ambu.bagAdult), 'STANDALONE', {department: 'ΤΕΠ', uses: 11, state: 'IN_WASHING'});
add(airway(ambu.bagBaby), 'STANDALONE', {department: 'Αίθουσα Τοκετών', uses: 17});
add(airway(ambu.bagBaby), 'STANDALONE', {department: 'Αίθουσα Τοκετών', uses: 24, state: 'READY_FOR_PICKUP'});
add(airway(ambu.mask4), 'STANDALONE', {department: 'ΜΕΘ', uses: 47});
add(airway(ambu.blade3), 'STANDALONE', {department: 'Χειρουργείο', uses: 188});
// New bags in Stock, ready to replace the ones that reach their limit.
for (let i = 0; i < 3; i++) add(airway(i === 2 ? ambu.bagChild : ambu.bagAdult), 'STOCK', {uses: 0});
// A bag that reached its 30 sterilizations: out of use, kept in the reports.
add(airway(ambu.bagAdult), 'STANDALONE', {department: 'ΜΕΘ', uses: 30});
{
  const retired = tools[tools.length - 1];
  retired.state = 'RETIRED';
  retired.retiredAt = '28/09/2026 09:40';
  retired.retiredReason = 'Συμπλήρωση ορίου χρήσεων';
}
// Instruments a Set misses because they are in Service or lost, and kinds the Stock does not hold.
const extraKinds: ToolSeed[] = [
  {code: '05.220.18', name: 'ΨΑΛΙΔΙ METZENBAUM ΚΥΡΤΟ 18 CM', manufacturer: 'AESCULAP', specialty: 'Γενική Χειρουργική'},
  {code: '42.310.02', name: 'ΑΓΚΙΣΤΡΟ FARABEUF', manufacturer: 'DEWIMED', specialty: 'Γενική Χειρουργική'},
  {
    code: '15.140.14',
    name: 'ΑΙΜΟΣΤΑΤΙΚΗ ΛΑΒΙΔΑ PEAN 14 CM',
    manufacturer: 'KLS MARTIN',
    specialty: 'Γενική Χειρουργική',
  },
];
const setOf = (code: string) => sets.find(set => set.code === code)!;
// Each Set's template composition: what it should hold, written from its instruments.
for (const set of sets) {
  const lines = new Map<string, {code: string; name: string; quantity: number}>();
  for (const tool of tools)
    if (tool.setId === set.id) {
      const line = lines.get(tool.code) || {code: tool.code, name: tool.name, quantity: 0};
      line.quantity += 1;
      lines.set(tool.code, line);
    }
  set.compositionTemplate = [...lines.values()];
}
/** One more of this kind in the Set's template than it holds: shown as missing. */
const expectOneMore = (set: SetAsset, seed: ToolSeed) => {
  const line = set.compositionTemplate!.find(l => l.code === seed.code);
  if (line) line.quantity += 1;
  else set.compositionTemplate!.push({code: seed.code, name: seed.name, quantity: 1});
  set.expected += 1;
};
// Two new kinds join the vascular Set; its Metzenbaum is worn and the Stock has none.
const vascular = setOf('VASC-01');
for (const seed of extraKinds.slice(0, 2)) {
  add(seed, 'SET_MEMBER', {setId: vascular.id, department: vascular.department, state: vascular.state, uses: 14});
  expectOneMore(vascular, seed);
  vascular.actual += 1;
}
const wornMetzenbaum = tools[tools.length - 2];
// Taken out of a Set: in Service or lost, so the Set misses one.
const takenOut: Array<{set: SetAsset; seed: ToolSeed; state: 'SERVICE' | 'LOST'; at: string}> = [
  {set: setOf('ORTHO-BASIC'), seed: extraKinds[2], state: 'SERVICE', at: '22/09/2026 10:15'},
  {set: sets.find(set => set.id === 's3')!, seed: catalog[3], state: 'SERVICE', at: '25/09/2026 12:40'},
  {set: sets.find(set => set.id === 's5')!, seed: catalog[4], state: 'LOST', at: '26/09/2026 09:05'},
];
const takenOutTools = takenOut.map(item => {
  add(item.seed, 'STANDALONE', {
    department: item.state === 'SERVICE' ? 'Service' : undefined,
    state: item.state,
    uses: 21,
  });
  expectOneMore(item.set, item.seed);
  return tools[tools.length - 1];
});
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

// History for the fuller demo: movements, issues, sterilizer loads and signed handovers.
const setByCode = (code: string) => sets.find(set => set.code === code)!;

// Sterile shelf life (step 4): dates relative to today, so the demo always has Sets that are fine,
// expiring (last month, or last 10 days for 2 months) and expired.
const demoSterile = (code: string, daysFromToday: number, months: number) => {
  const set = sets.find(item => item.code === code);
  if (!set) return;
  const until = new Date();
  until.setDate(until.getDate() + daysFromToday);
  set.sterileUntil = isoDate(until);
  set.shelfLifeMonths = months;
};
demoSterile('ORTHO-BASIC', 120, 6);
demoSterile('LAP-GEN', 8, 2);
demoSterile('GYN-LAP', -3, 3);
demoSterile('DELIVERY-01', 24, 6);
demoSterile('CSECTION-01', 168, 6);
const label = (set: SetAsset) => `${set.barcode} · ${set.name}`;
const people = {
  ster: 'Demo Χρήστης Αποστείρωσης',
  supervisor: 'Demo Προϊστάμενος Αποστείρωσης',
  or: 'Demo Χρήστης Χειρουργείου',
  ortho: 'Demo Χρήστης Ορθοπεδικής',
  tok: 'Demo Χρήστης Αίθουσας Τοκετών',
  ivf: 'Demo Χρήστης IVF',
  er: 'Demo Χρήστης ΤΕΠ',
  icu: 'Demo Χρήστης ΜΕΘ',
  gyn: 'Demo Χρήστης Γυναικολογικής',
};
const story: Array<[string, string, string, string, string, string, string?]> = [
  // [set code, from, to, status, at, by, patient code]
  [
    'ORTHO-HIP',
    'Ορθοπεδική Κλινική',
    'Κεντρική Αποστείρωση',
    'Αποστολή προς αποστείρωση',
    '29/09/2026 08:10',
    people.ortho,
    'PT-2026-0188',
  ],
  [
    'IVF-OPU',
    'Μονάδα IVF',
    'Κεντρική Αποστείρωση',
    'Αποστολή προς αποστείρωση',
    '29/09/2026 08:32',
    people.ivf,
    'PT-2026-0191',
  ],
  ['LAP-CHOLE', 'Χειρουργείο', 'Κεντρική Αποστείρωση', 'Παραλαβή στην Αποστείρωση', '29/09/2026 07:55', people.ster],
  [
    'LAP-CHOLE',
    'Κεντρική Αποστείρωση',
    'Καθαρισμός & Απολύμανση',
    'Έναρξη καθαρισμού',
    '29/09/2026 08:05',
    people.ster,
  ],
  ['ER-SUTURE', 'ΤΕΠ', 'Κεντρική Αποστείρωση', 'Παραλαβή στην Αποστείρωση', '29/09/2026 08:12', people.ster],
  [
    'ORTHO-KNEE',
    'Καθαρισμός & Απολύμανση',
    'Έλεγχος & Σύνθεση',
    'Ολοκλήρωση καθαρισμού',
    '29/09/2026 07:40',
    people.ster,
  ],
  ['URO-TUR', 'Έλεγχος & Σύνθεση', 'Συσκευασία & Σήμανση', 'Σύνθεση πλήρης', '29/09/2026 07:20', people.ster],
  ['GYN-HYST', 'Συσκευασία & Σήμανση', 'Αποστείρωση', 'Φόρτωση στον Κλίβανο Ατμού 01', '29/09/2026 07:05', people.ster],
  [
    'GEN-LAPAROT',
    'Συσκευασία & Σήμανση',
    'Αποστείρωση',
    'Φόρτωση στον Κλίβανο Ατμού 01',
    '29/09/2026 07:05',
    people.ster,
  ],
  [
    'CSECTION-02',
    'Αποστείρωση',
    'Αποδέσμευση φορτίου',
    'Κύκλος 2026-0931 ολοκληρώθηκε · αναμονή αποδέσμευσης',
    '29/09/2026 06:48',
    people.ster,
  ],
  [
    'NEURO-02',
    'Αποστείρωση',
    'Αποδέσμευση φορτίου',
    'Κύκλος 2026-0931 ολοκληρώθηκε · αναμονή αποδέσμευσης',
    '29/09/2026 06:48',
    people.ster,
  ],
  [
    'ICU-TRACH',
    'Αποδέσμευση φορτίου',
    'Έτοιμο για παραλαβή',
    'Αποδέσμευση φορτίου 2026-0928',
    '28/09/2026 19:30',
    people.supervisor,
  ],
  [
    'GYN-DC',
    'Αποδέσμευση φορτίου',
    'Έτοιμο για παραλαβή',
    'Αποδέσμευση φορτίου 2026-0928',
    '28/09/2026 19:30',
    people.supervisor,
  ],
  [
    'IVF-ET',
    'Κεντρική Αποστείρωση',
    'Μονάδα IVF',
    'Παράδοση στο τμήμα · υπογραφή παραλαμβάνοντα',
    '28/09/2026 14:10',
    people.ster,
  ],
  [
    'ER-MINOR',
    'Κεντρική Αποστείρωση',
    'ΤΕΠ',
    'Παράδοση στο τμήμα · υπογραφή παραλαμβάνοντα',
    '28/09/2026 12:45',
    people.ster,
  ],
  [
    'VASC-01',
    'Κεντρική Αποστείρωση',
    'Χειρουργείο',
    'Παράδοση στο τμήμα · υπογραφή παραλαμβάνοντα',
    '28/09/2026 09:30',
    people.ster,
  ],
  [
    'VASC-01',
    'Χειρουργείο',
    'Κεντρική Αποστείρωση',
    'Αποστολή προς αποστείρωση',
    '27/09/2026 16:20',
    people.or,
    'PT-2026-0177',
  ],
  [
    'ORTHO-BASIC',
    'Κεντρική Αποστείρωση',
    'Χειρουργείο',
    'Παράδοση στο τμήμα · υπογραφή παραλαμβάνοντα',
    '27/09/2026 11:05',
    people.ster,
  ],
  [
    'DELIVERY-01',
    'Αίθουσα Τοκετών',
    'Κεντρική Αποστείρωση',
    'Αποστολή προς αποστείρωση',
    '26/09/2026 22:40',
    people.tok,
    'PT-2026-0170',
  ],
  [
    'DELIVERY-01',
    'Κεντρική Αποστείρωση',
    'Αίθουσα Τοκετών',
    'Παράδοση στο τμήμα · υπογραφή παραλαμβάνοντα',
    '27/09/2026 10:15',
    people.ster,
  ],
  [
    'ICU-TRACH',
    'ΜΕΘ',
    'Κεντρική Αποστείρωση',
    'Αποστολή προς αποστείρωση',
    '27/09/2026 18:05',
    people.icu,
    'PT-2026-0180',
  ],
  [
    'GYN-DC',
    'Γυναικολογική Κλινική',
    'Κεντρική Αποστείρωση',
    'Αποστολή προς αποστείρωση',
    '27/09/2026 13:30',
    people.gyn,
    'PT-2026-0175',
  ],
];
story.forEach(([code, from, to, status, at, by, patientCode], i) => {
  const set = setByCode(code);
  movements.push({id: `m${100 + i}`, asset: label(set), assetKind: 'SET', from, to, status, at, by, patientCode});
});
const outOfUse = tools.filter(tool => tool.state === 'RETIRED');
outOfUse.forEach((tool, i) =>
  movements.push({
    id: `m${200 + i}`,
    asset: `${tool.barcode} · ${tool.name}`,
    assetKind: 'TOOL',
    from: tool.department || 'Τμήμα',
    to: 'Εκτός χρήσης',
    status: 'Συμπλήρωση ορίου χρήσεων',
    at: tool.retiredAt || '01/09/2026 10:00',
    by: people.ster,
  }),
);
issues.push(
  {
    id: 'i4',
    asset: `${setByCode('ORTHO-KNEE').barcode} · ${setByCode('ORTHO-KNEE').name}`,
    type: 'Έλλειψη',
    status: 'OPEN',
    created: '29/09/2026 07:45',
    department: 'Ορθοπεδική Κλινική',
    note: 'Λείπει ένα άγκιστρο Langenbeck από τη σύνθεση.',
  },
  {
    id: 'i5',
    asset: `${setByCode('LAP-CHOLE').barcode} · ${setByCode('LAP-CHOLE').name}`,
    type: 'Φθορά',
    status: 'OPEN',
    created: '29/09/2026 08:06',
    department: 'Χειρουργείο',
    note: 'Φθαρμένη μόνωση σε λαπαροσκοπική λαβίδα 5mm.',
  },
  {
    id: 'i6',
    asset: `${setByCode('ICU-TRACH').barcode} · ${setByCode('ICU-TRACH').name}`,
    type: 'Service',
    status: 'RESOLVED',
    created: '25/09/2026 12:00',
    department: 'ΜΕΘ',
    note: 'Επισκευή ψαλιδιού από τον προμηθευτή. Επέστρεψε.',
  },
  {
    id: 'i7',
    asset: `${setByCode('VASC-01').barcode} · ${setByCode('VASC-01').name}`,
    type: 'Έλλειψη',
    status: 'RESOLVED',
    created: '24/09/2026 09:40',
    department: 'Χειρουργείο',
    note: 'Αντικαταστάθηκε από το stock.',
  },
);
// Instruments to replace: damaged in their Set, in Service, lost.
const damagedMayo = tools.find(tool => tool.setId === 's1' && tool.code === '08.280.18')!;
issues.push(
  {
    id: 'i8',
    asset: `${damagedMayo.barcode} · ${damagedMayo.name}`,
    type: 'Βλάβη',
    status: 'OPEN',
    created: '27/09/2026 15:10',
    department: 'Χειρουργείο',
    note: 'Χαλαρή άρθρωση, δεν κόβει καθαρά.',
  },
  {
    id: 'i9',
    asset: `${wornMetzenbaum.barcode} · ${wornMetzenbaum.name}`,
    type: 'Φθορά',
    status: 'OPEN',
    created: '28/09/2026 11:30',
    department: 'Χειρουργείο',
    note: 'Φθαρμένες λεπίδες στην άκρη.',
  },
  ...takenOut.map((item, i) => {
    const tool = takenOutTools[i];
    return {
      id: `i${10 + i}`,
      asset: `${tool.barcode} · ${tool.name}`,
      type: item.state === 'LOST' ? 'Απώλεια' : 'Βλάβη / Service',
      status: 'OPEN' as const,
      created: item.at,
      department: item.set.department,
      note:
        item.state === 'LOST'
          ? 'Δεν επέστρεψε με το Σετ μετά τον τοκετό.'
          : 'Αποστείρωση · σύνθεση & προετοιμασία: μεταφέρθηκε στα χαλασμένα / Service.',
    };
  }),
  {
    id: 'i13',
    asset: `${setOf('ER-SUTURE').barcode} · ${setOf('ER-SUTURE').name}`,
    type: 'Φθορά',
    status: 'RESOLVED',
    created: '15/09/2026 13:20',
    department: 'ΤΕΠ',
    note: 'Ακονίστηκε το ψαλίδι. Επέστρεψε στη σύνθεση.',
  },
  {
    id: 'i14',
    asset: `${setOf('GYN-HYST').barcode} · ${setOf('GYN-HYST').name}`,
    type: 'Έλλειψη',
    status: 'RESOLVED',
    created: '10/09/2026 08:50',
    department: 'Γυναικολογική Κλινική',
    note: 'Βρέθηκε στο χειρουργείο, επέστρεψε.',
  },
);
takenOut.forEach((item, i) => {
  const tool = takenOutTools[i];
  movements.push({
    id: `m${260 + i}`,
    asset: `${tool.barcode} · ${tool.name}`,
    assetKind: 'TOOL',
    from: `Set ${item.set.barcode}`,
    to: item.state === 'LOST' ? 'Απολεσθέντα' : 'Χαλασμένα / Service',
    status: item.state === 'LOST' ? 'Δήλωση απώλειας' : 'Αφαίρεση από σύνθεση · προς Service',
    at: item.at,
    by: people.ster,
  });
});

// A month of circulation for every Set: sent after a procedure, received, sterilized, delivered back.
const personOf: Record<string, string> = {
  Χειρουργείο: people.or,
  'Ορθοπεδική Κλινική': people.ortho,
  'Αίθουσα Τοκετών': people.tok,
  'Μονάδα IVF': people.ivf,
  ΤΕΠ: people.er,
  ΜΕΘ: people.icu,
  'Γυναικολογική Κλινική': people.gyn,
};
const two = (value: number) => String(value).padStart(2, '0');
const historyReceipts: Array<[SetAsset, string, string]> = [];
const historyDeliveries: Array<[SetAsset, string, string]> = [];
let patient = 100;
sets.forEach((set, index) => {
  for (let k = 0; k < 3; k++) {
    const day = 2 + ((index * 3 + k * 8) % 21);
    const hour = 8 + ((index + k * 5) % 9);
    const sent = `${two(day)}/09/2026 ${two(hour)}:${two((index * 7) % 60)}`;
    const received = `${two(day)}/09/2026 ${two(hour + 1)}:${two((index * 11) % 60)}`;
    const back = `${two(day + 1)}/09/2026 ${two(9 + (index % 5))}:${two((index * 13) % 60)}`;
    const by = personOf[set.department] || people.or;
    patient += 1;
    movements.push(
      {
        id: `mh-${set.id}-${k}-1`,
        asset: label(set),
        assetKind: 'SET',
        from: set.department,
        to: 'Κεντρική Αποστείρωση',
        status: 'Αποστολή προς αποστείρωση',
        at: sent,
        by,
        patientCode: `PT-2026-0${patient}`,
      },
      {
        id: `mh-${set.id}-${k}-2`,
        asset: label(set),
        assetKind: 'SET',
        from: set.department,
        to: 'Κεντρική Αποστείρωση',
        status: 'Παραλαβή στην Αποστείρωση',
        at: received,
        by: people.ster,
      },
      {
        id: `mh-${set.id}-${k}-3`,
        asset: label(set),
        assetKind: 'SET',
        from: 'Κεντρική Αποστείρωση',
        to: set.department,
        status: 'Παράδοση στο τμήμα · υπογραφή παραλαμβάνοντα',
        at: back,
        by: people.ster,
      },
    );
    historyReceipts.push([set, by, received]);
    historyDeliveries.push([set, by, back]);
  }
});
const loadItem = (set: SetAsset) => ({
  assetId: set.id,
  assetKind: 'SET' as const,
  barcode: set.barcode,
  assetName: set.name,
  department: set.department,
});
export const processLoads: ProcessLoadRecord[] = [
  {
    id: 'L-DEMO-0931',
    workflowVersion: 1,
    kind: 'STERILIZATION',
    equipment: 'Κλίβανος Ατμού 02',
    cycleNumber: '2026-0931',
    program: '134°C · 5′',
    status: 'AWAITING_RELEASE',
    items: [loadItem(setByCode('CSECTION-02')), loadItem(setByCode('NEURO-02'))],
    // Chemical and biological indicators in the load; their results are recorded at release.
    chemicalIndicatorResult: 'NOT_RECORDED',
    biologicalIndicatorResult: 'PENDING',
    createdByUserId: 'demo-sterilization',
    createdByName: people.ster,
    createdAt: '29/09/2026 05:55',
    completedAt: '29/09/2026 06:48',
  },
  {
    id: 'L-DEMO-0928',
    workflowVersion: 1,
    kind: 'STERILIZATION',
    equipment: 'Κλίβανος Ατμού 01',
    cycleNumber: '2026-0928',
    program: '134°C · 5′',
    status: 'RELEASED',
    items: [loadItem(setByCode('ICU-TRACH')), loadItem(setByCode('GYN-DC'))],
    chemicalIndicatorResult: 'PASS',
    biologicalIndicatorResult: 'PASS',
    physicalParametersOk: true,
    packagingIntegrityOk: true,
    createdByUserId: 'demo-sterilization',
    createdByName: people.ster,
    createdAt: '28/09/2026 17:40',
    completedAt: '28/09/2026 18:35',
    releasedAt: '28/09/2026 19:30',
  },
  {
    id: 'L-DEMO-0927',
    workflowVersion: 1,
    kind: 'STERILIZATION',
    equipment: 'Κλίβανος Ατμού 02',
    cycleNumber: '2026-0927',
    program: '121°C · 20′',
    status: 'RELEASED',
    items: [loadItem(setByCode('IVF-ET')), loadItem(setByCode('ER-MINOR')), loadItem(setByCode('VASC-01'))],
    chemicalIndicatorResult: 'PASS',
    biologicalIndicatorResult: 'NOT_REQUIRED',
    physicalParametersOk: true,
    packagingIntegrityOk: true,
    createdByUserId: 'demo-sterilization',
    createdByName: people.ster,
    createdAt: '28/09/2026 06:10',
    completedAt: '28/09/2026 07:05',
    releasedAt: '28/09/2026 07:40',
  },
];
const handover = {workflowVersion: 1, assetKind: 'SET' as const};
export const receipts: ReceiptRecord[] = [
  ['LAP-CHOLE', people.or, 'Χειρουργείο', '29/09/2026 07:55'],
  ['ER-SUTURE', people.er, 'ΤΕΠ', '29/09/2026 08:12'],
  ['VASC-01', people.or, 'Χειρουργείο', '27/09/2026 16:40'],
].map(([code, deliveredByName, department, at], i) => {
  const set = setByCode(code);
  return {
    ...handover,
    id: `rc-demo-${i + 1}`,
    assetId: set.id,
    barcode: set.barcode,
    assetName: set.name,
    fromDepartment: department,
    toDepartment: 'Κεντρική Αποστείρωση',
    deliveredByUserId: `demo-${i + 1}`,
    deliveredByName,
    deliveredByDepartment: department,
    receivedByUserId: 'demo-sterilization',
    receivedByName: people.ster,
    receivedByDepartment: 'Κεντρική Αποστείρωση',
    at,
    visibleDeviation: false,
  };
});
export const deliveries: DeliveryRecord[] = [
  ['IVF-ET', people.ivf, 'Μονάδα IVF', '28/09/2026 14:10'],
  ['ER-MINOR', people.er, 'ΤΕΠ', '28/09/2026 12:45'],
  ['VASC-01', people.or, 'Χειρουργείο', '28/09/2026 09:30'],
  ['ORTHO-BASIC', people.or, 'Χειρουργείο', '27/09/2026 11:05'],
  ['DELIVERY-01', people.tok, 'Αίθουσα Τοκετών', '27/09/2026 10:15'],
].map(([code, receivedByName, department, at], i) => {
  const set = setByCode(code);
  return {
    ...handover,
    id: `dl-demo-${i + 1}`,
    assetId: set.id,
    barcode: set.barcode,
    assetName: set.name,
    department,
    deliveredByUserId: 'demo-sterilization',
    deliveredByName: people.ster,
    deliveredByDepartment: 'Κεντρική Αποστείρωση',
    receivedByUserId: `demo-r-${i + 1}`,
    receivedByName,
    receivedByDepartment: department,
    at,
  };
});

historyReceipts.forEach(([set, deliveredByName, at], i) =>
  receipts.push({
    ...handover,
    id: `rc-hist-${i + 1}`,
    assetId: set.id,
    barcode: set.barcode,
    assetName: set.name,
    fromDepartment: set.department,
    toDepartment: 'Κεντρική Αποστείρωση',
    deliveredByUserId: `demo-h-${i + 1}`,
    deliveredByName,
    deliveredByDepartment: set.department,
    receivedByUserId: 'demo-sterilization',
    receivedByName: people.ster,
    receivedByDepartment: 'Κεντρική Αποστείρωση',
    at,
    visibleDeviation: false,
  }),
);
historyDeliveries.forEach(([set, receivedByName, at], i) =>
  deliveries.push({
    ...handover,
    id: `dl-hist-${i + 1}`,
    assetId: set.id,
    barcode: set.barcode,
    assetName: set.name,
    department: set.department,
    deliveredByUserId: 'demo-sterilization',
    deliveredByName: people.ster,
    deliveredByDepartment: 'Κεντρική Αποστείρωση',
    receivedByUserId: `demo-hr-${i + 1}`,
    receivedByName,
    receivedByDepartment: set.department,
    at,
  }),
);

// Purchase orders for replacements: one received, one waiting for the supplier.
const retiredLap = outOfUse.filter(tool => tool.code === '70.510.05');
const retiredBag = outOfUse.filter(tool => tool.code !== '70.510.05');
const orderLine = (list: Tool[]) => ({
  code: list[0].code,
  name: list[0].name,
  manufacturer: list[0].manufacturer,
  quantity: list.length,
  reason: 'Εκτός χρήσης',
  toolIds: list.map(tool => tool.id),
  barcodes: list.map(tool => tool.barcode),
});
export const purchaseOrders: PurchaseOrder[] = [
  {
    id: 'po-demo-2',
    number: 'ΠΑ-2026-002',
    status: 'ORDERED',
    supplier: 'Προμηθευτής Δοκιμής',
    note: 'Επείγον για το καρότσι ανάνηψης της ΜΕΘ.',
    lines: [orderLine(retiredBag)],
    createdAt: '28/09/2026 10:05',
    createdByName: people.supervisor,
    orderedAt: '28/09/2026 12:30',
  },
  {
    id: 'po-demo-1',
    number: 'ΠΑ-2026-001',
    status: 'RECEIVED',
    supplier: 'Προμηθευτής Δοκιμής',
    lines: [orderLine(retiredLap.slice(0, 2))],
    createdAt: '04/09/2026 09:20',
    createdByName: people.supervisor,
    orderedAt: '04/09/2026 11:00',
    receivedAt: '18/09/2026 08:45',
  },
];

// Histories are read newest first (live records are prepended), so keep the demo in that order.
const newestFirst = (value: string) => {
  const [date = '', time = '00:00'] = value.split(' ');
  const [day, month, year] = date.split('/');
  return `${year}${month}${day}${time}`;
};
movements.sort((a, b) => newestFirst(b.at).localeCompare(newestFirst(a.at)));
issues.sort((a, b) => newestFirst(b.created).localeCompare(newestFirst(a.created)));
receipts.sort((a, b) => newestFirst(b.at).localeCompare(newestFirst(a.at)));
deliveries.sort((a, b) => newestFirst(b.at).localeCompare(newestFirst(a.at)));
