import type {SetAsset, Tool} from '../../types/domain';
import type {SheetRows} from '../../core/sheetImport';

/**
 * Bulk import of Sets and instruments from a spreadsheet: one row per instrument (with a quantity
 * for identical ones). Rows naming the same Set (and the same Set barcode, if given) make one Set;
 * rows without a Set are standalone instruments, or Stock when they have no department either.
 */

export type ImportField =
  | 'set'
  | 'setBarcode'
  | 'code'
  | 'name'
  | 'quantity'
  | 'barcode'
  | 'department'
  | 'specialty'
  | 'manufacturer'
  | 'maxUses'
  | 'serialNumber'
  | 'notes';

export const IMPORT_FIELDS: ReadonlyArray<{
  key: ImportField;
  el: string;
  en: string;
  hintEl: string;
  hintEn: string;
  required?: boolean;
  aliases: string[];
}> = [
  {
    key: 'set',
    el: 'Σετ',
    en: 'Set',
    hintEl: 'Όνομα του Σετ· κενό για μεμονωμένο εργαλείο',
    hintEn: 'Set name; empty for a standalone instrument',
    aliases: ['σετ', 'set', 'setname', 'ονομασετ', 'ονομασιασετ', 'κουτι'],
  },
  {
    key: 'setBarcode',
    el: 'Barcode Σετ',
    en: 'Set barcode',
    hintEl: 'Προαιρετικό· αλλιώς δίνεται αυτόματα',
    hintEn: 'Optional; otherwise assigned',
    aliases: ['barcodeσετ', 'setbarcode', 'κωδικοσσετ', 'barcodeset'],
  },
  {
    key: 'code',
    el: 'Κωδικός εργαλείου',
    en: 'Instrument code',
    hintEl: 'Κωδικός κατασκευαστή ή καταλόγου',
    hintEn: 'Manufacturer or catalog code',
    aliases: ['κωδικοσ', 'κωδικοσεργαλειου', 'code', 'toolcode', 'ref', 'catalog', 'catalogno', 'κωδ'],
  },
  {
    key: 'name',
    el: 'Όνομα εργαλείου',
    en: 'Instrument name',
    hintEl: 'Υποχρεωτικό',
    hintEn: 'Required',
    required: true,
    aliases: ['ονομα', 'ονομαεργαλειου', 'περιγραφη', 'name', 'toolname', 'description', 'εργαλειο'],
  },
  {
    key: 'quantity',
    el: 'Ποσότητα',
    en: 'Quantity',
    hintEl: 'Πόσα ίδια κομμάτια· κενό = 1',
    hintEn: 'How many identical pieces; empty = 1',
    aliases: ['ποσοτητα', 'τεμαχια', 'τεμ', 'quantity', 'qty', 'pieces'],
  },
  {
    key: 'barcode',
    el: 'Barcode εργαλείου',
    en: 'Instrument barcode',
    hintEl: 'Προαιρετικό, μόνο για ποσότητα 1',
    hintEn: 'Optional, only for quantity 1',
    aliases: ['barcode', 'barcodeεργαλειου', 'toolbarcode'],
  },
  {
    key: 'department',
    el: 'Τμήμα',
    en: 'Department',
    hintEl: 'Όπως στο Studio· κενό = Stock',
    hintEn: 'As in Studio; empty = Stock',
    aliases: ['τμημα', 'department', 'κλινικη', 'dept'],
  },
  {
    key: 'specialty',
    el: 'Ειδικότητα',
    en: 'Specialty',
    hintEl: '',
    hintEn: '',
    aliases: ['ειδικοτητα', 'specialty', 'speciality'],
  },
  {
    key: 'manufacturer',
    el: 'Κατασκευαστής',
    en: 'Manufacturer',
    hintEl: '',
    hintEn: '',
    aliases: ['κατασκευαστησ', 'manufacturer', 'εταιρεια', 'brand', 'mfr'],
  },
  {
    key: 'maxUses',
    el: 'Μέγιστες χρήσεις',
    en: 'Max uses',
    hintEl: 'Όριο χρήσεων του εργαλείου',
    hintEn: "The instrument's use limit",
    aliases: ['μεγιστεσχρησεισ', 'οριοχρησεων', 'χρησεισ', 'ζωεσ', 'maxuses', 'lifes', 'lives'],
  },
  {
    key: 'serialNumber',
    el: 'Σειριακός αριθμός',
    en: 'Serial number',
    hintEl: 'Μόνο για ποσότητα 1',
    hintEn: 'Only for quantity 1',
    aliases: ['σειριακοσ', 'σειριακοσαριθμοσ', 'serial', 'serialnumber', 'sn'],
  },
  {
    key: 'notes',
    el: 'Σημειώσεις',
    en: 'Notes',
    hintEl: '',
    hintEn: '',
    aliases: ['σημειωσεισ', 'σχολια', 'notes', 'comments'],
  },
];

export type ImportMapping = Record<ImportField, number>;

/** Lower case, no accents, final sigma as sigma, letters and digits only. */
export const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ς/g, 'σ')
    .replace(/[^\p{L}\p{N}]+/gu, '');

const fieldFor = (header: string) => {
  const key = normalize(header);
  return key
    ? IMPORT_FIELDS.find(f => f.aliases.includes(key) || normalize(f.el) === key || normalize(f.en) === key)
    : undefined;
};

/** The header row: among the first rows, the one naming most known columns (the template has a title above). */
export function findHeaderRow(rows: SheetRows) {
  let best = 0;
  let bestScore = 0;
  rows.slice(0, 10).forEach((row, index) => {
    const score = new Set(row.map(fieldFor).filter(Boolean)).size;
    if (score > bestScore) {
      best = index;
      bestScore = score;
    }
  });
  return best;
}

export function autoMapping(headers: string[]): ImportMapping {
  const mapping = Object.fromEntries(IMPORT_FIELDS.map(f => [f.key, -1])) as ImportMapping;
  headers.forEach((header, index) => {
    const field = fieldFor(header);
    if (field && mapping[field.key] < 0) mapping[field.key] = index;
  });
  return mapping;
}

export type ImportContext = {
  lang: 'el' | 'en';
  /** The hospital's active departments. */
  departments: Array<{name: string; code?: string}>;
  /** Every barcode already in the hospital (current and old ones), upper case. */
  existingBarcodes: Set<string>;
  batch: string;
  now?: Date;
};

export type ImportIssue = {row: number; message: string};

export type ImportPlan = {
  sets: SetAsset[];
  tools: Tool[];
  errors: ImportIssue[];
  rows: number;
  standalone: number;
  stock: number;
  setMembers: number;
};

/** The largest instrument or Set number in use, so new barcodes continue from it (as the app does). */
const highest = (barcodes: Iterable<string>, prefix: string) => {
  let max = 0;
  for (const barcode of barcodes)
    if (barcode.startsWith(prefix)) max = Math.max(max, Number(barcode.replace(/\D/g, '')) || 0);
  return max;
};

const MAX_QUANTITY = 500;

/** Checks every row and builds the Sets and instruments to create; nothing is created while errors remain. */
export function buildImportPlan(
  dataRows: SheetRows,
  firstRowNumber: number,
  mapping: ImportMapping,
  context: ImportContext,
): ImportPlan {
  const L = (el: string, en: string) => (context.lang === 'el' ? el : en);
  const errors: ImportIssue[] = [];
  const value = (row: string[], field: ImportField) => (mapping[field] >= 0 ? (row[mapping[field]] || '').trim() : '');
  const departmentByKey = new Map<string, string>();
  for (const d of context.departments) {
    departmentByKey.set(normalize(d.name), d.name);
    if (d.code) departmentByKey.set(normalize(d.code), d.name);
  }
  const usedBarcodes = new Map<string, number>();
  const claimBarcode = (barcode: string, rowNumber: number) => {
    const key = barcode.toUpperCase();
    if (context.existingBarcodes.has(key))
      errors.push({
        row: rowNumber,
        message: L(
          `Το barcode ${barcode} υπάρχει ήδη στο νοσοκομείο.`,
          `Barcode ${barcode} already exists in the hospital.`,
        ),
      });
    // Each barcode is claimed once (a Set's when the Set first appears), so any repeat is a clash,
    // also a Set and an instrument sharing one on the same row.
    else if (usedBarcodes.has(key))
      errors.push({
        row: rowNumber,
        message:
          usedBarcodes.get(key) === rowNumber
            ? L(
                `Το Σετ και το εργαλείο έχουν το ίδιο barcode ${barcode}.`,
                `The Set and the instrument share barcode ${barcode}.`,
              )
            : L(
                `Το barcode ${barcode} υπάρχει και στη γραμμή ${usedBarcodes.get(key)}.`,
                `Barcode ${barcode} is also on row ${usedBarcodes.get(key)}.`,
              ),
      });
    else usedBarcodes.set(key, rowNumber);
  };

  type Line = {
    rowNumber: number;
    code: string;
    name: string;
    quantity: number;
    barcode: string;
    department?: string;
    specialty: string;
    manufacturer: string;
    maxUses?: number;
    serialNumber: string;
    notes: string;
  };
  type Group = {
    name: string;
    barcode: string;
    rowNumber: number;
    department?: string;
    departmentRow?: number;
    lines: Line[];
  };
  const groups = new Map<string, Group>();
  const singles: Line[] = [];
  let rows = 0;

  dataRows.forEach((row, index) => {
    if (!row.some(cell => cell.trim())) return;
    rows++;
    const rowNumber = firstRowNumber + index;
    const name = value(row, 'name');
    if (!name)
      errors.push({row: rowNumber, message: L('Λείπει το όνομα του εργαλείου.', 'The instrument name is missing.')});
    const quantityText = value(row, 'quantity');
    const quantity = quantityText ? Number(quantityText.replace(',', '.')) : 1;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY)
      errors.push({
        row: rowNumber,
        message: L(
          `Η ποσότητα «${quantityText}» δεν είναι αριθμός από 1 έως ${MAX_QUANTITY}.`,
          `Quantity “${quantityText}” is not a number from 1 to ${MAX_QUANTITY}.`,
        ),
      });
    const maxUsesText = value(row, 'maxUses');
    const maxUses = maxUsesText ? Number(maxUsesText.replace(',', '.')) : undefined;
    if (maxUses !== undefined && (!Number.isInteger(maxUses) || maxUses < 1))
      errors.push({
        row: rowNumber,
        message: L(
          `Οι μέγιστες χρήσεις «${maxUsesText}» δεν είναι θετικός ακέραιος.`,
          `Max uses “${maxUsesText}” is not a positive whole number.`,
        ),
      });
    const departmentText = value(row, 'department');
    const department = departmentText ? departmentByKey.get(normalize(departmentText)) : undefined;
    if (departmentText && !department)
      errors.push({
        row: rowNumber,
        message: L(
          `Το τμήμα «${departmentText}» δεν υπάρχει στο νοσοκομείο.`,
          `Department “${departmentText}” does not exist in the hospital.`,
        ),
      });
    const barcode = value(row, 'barcode');
    const serialNumber = value(row, 'serialNumber');
    if (quantity > 1 && barcode)
      errors.push({
        row: rowNumber,
        message: L('Barcode εργαλείου μπαίνει μόνο με ποσότητα 1.', 'An instrument barcode needs quantity 1.'),
      });
    else if (barcode) claimBarcode(barcode, rowNumber);
    if (quantity > 1 && serialNumber)
      errors.push({
        row: rowNumber,
        message: L('Σειριακός αριθμός μπαίνει μόνο με ποσότητα 1.', 'A serial number needs quantity 1.'),
      });
    const line: Line = {
      rowNumber,
      code: value(row, 'code'),
      name,
      quantity: Number.isInteger(quantity) && quantity > 0 ? Math.min(quantity, MAX_QUANTITY) : 1,
      barcode,
      department,
      specialty: value(row, 'specialty'),
      manufacturer: value(row, 'manufacturer'),
      maxUses: maxUses !== undefined && Number.isInteger(maxUses) && maxUses > 0 ? maxUses : undefined,
      serialNumber,
      notes: value(row, 'notes'),
    };
    const setName = value(row, 'set');
    const setBarcode = value(row, 'setBarcode');
    if (!setName) {
      if (setBarcode)
        errors.push({
          row: rowNumber,
          message: L('Υπάρχει barcode Σετ χωρίς όνομα Σετ.', 'A Set barcode without a Set name.'),
        });
      singles.push(line);
      return;
    }
    const key = `${normalize(setName)}|${setBarcode.toUpperCase()}`;
    let group = groups.get(key);
    if (!group) {
      group = {name: setName, barcode: setBarcode, rowNumber, lines: []};
      groups.set(key, group);
      if (setBarcode) claimBarcode(setBarcode, rowNumber);
    }
    if (department) {
      if (group.department && group.department !== department)
        errors.push({
          row: rowNumber,
          message: L(
            `Το Σετ «${setName}» έχει άλλο τμήμα στη γραμμή ${group.departmentRow} (${group.department}).`,
            `Set “${setName}” has another department on row ${group.departmentRow} (${group.department}).`,
          ),
        });
      else if (!group.department) {
        group.department = department;
        group.departmentRow = rowNumber;
      }
    }
    group.lines.push(line);
  });

  const allBarcodes = [...context.existingBarcodes, ...usedBarcodes.keys()];
  let nextTool = highest(allBarcodes, 'T');
  let nextSet = highest(allBarcodes, 'S');
  const newBarcode = (prefix: 'T' | 'S') =>
    `${prefix}${String(prefix === 'T' ? ++nextTool : ++nextSet).padStart(6, '0')}`;
  const createdAt = (context.now || new Date()).toLocaleDateString('el-GR');
  let toolNumber = 0;
  const tools: Tool[] = [];
  const pieces = (line: Line, make: (barcode: string) => Tool) => {
    for (let i = 0; i < line.quantity; i++) tools.push(make(line.barcode || newBarcode('T')));
  };
  const toolBase = (line: Line) => ({
    code: line.code,
    name: line.name,
    specialty: line.specialty,
    manufacturer: line.manufacturer || undefined,
    uses: 0,
    sterilizations: 0,
    maxUses: line.maxUses,
    serialNumber: line.serialNumber || undefined,
    notes: line.notes || undefined,
    importBatch: context.batch,
  });

  const sets: SetAsset[] = [];
  let setMembers = 0;
  for (const group of groups.values()) {
    const id = `set-${context.batch}-${sets.length + 1}`;
    const state = group.department ? 'IN_DEPARTMENT' : 'IN_STOCK';
    const count = group.lines.reduce((sum, line) => sum + line.quantity, 0);
    const template = new Map<string, {code: string; name: string; quantity: number}>();
    for (const line of group.lines) {
      const key = `${line.code}|${line.name}`;
      const item = template.get(key) || {code: line.code, name: line.name, quantity: 0};
      item.quantity += line.quantity;
      template.set(key, item);
    }
    const first = (pick: (line: Line) => string) => group.lines.map(pick).find(Boolean) || '';
    sets.push({
      id,
      barcode: group.barcode || newBarcode('S'),
      code: group.name,
      name: group.name,
      department: group.department || '',
      specialty: first(line => line.specialty),
      manufacturer: first(line => line.manufacturer) || undefined,
      compositionTemplate: [...template.values()],
      state,
      expected: count,
      actual: count,
      category: 'Χειρουργικά Set',
      createdAt,
      uses: 0,
      importBatch: context.batch,
    });
    setMembers += count;
    for (const line of group.lines)
      pieces(line, barcode => ({
        ...toolBase(line),
        id: `tool-${context.batch}-${++toolNumber}`,
        barcode,
        department: group.department,
        mode: 'SET_MEMBER',
        setId: id,
        state,
        colorMode: 'SET',
      }));
  }
  let standalone = 0;
  let stock = 0;
  for (const line of singles) {
    if (line.department) standalone += line.quantity;
    else stock += line.quantity;
    pieces(line, barcode => ({
      ...toolBase(line),
      id: `tool-${context.batch}-${++toolNumber}`,
      barcode,
      department: line.department,
      mode: line.department ? 'STANDALONE' : 'STOCK',
      state: line.department ? 'IN_DEPARTMENT' : 'IN_STOCK',
    }));
  }
  errors.sort((a, b) => a.row - b.row);
  return {sets, tools, errors, rows, standalone, stock, setMembers};
}

/** The template: the columns in order, with two example rows (a Set of two lines and a Stock instrument). */
export const templateTable = (lang: 'el' | 'en') => ({
  title: lang === 'el' ? 'Πρότυπο εισαγωγής εργαλείων' : 'Instrument import template',
  subtitle:
    lang === 'el'
      ? 'Μία γραμμή ανά εργαλείο. Ίδιο όνομα Σετ = ίδιο Σετ. Κενό Σετ = μεμονωμένο εργαλείο· κενό τμήμα = Stock.'
      : 'One row per instrument. Same Set name = same Set. No Set = standalone instrument; no department = Stock.',
  headers: IMPORT_FIELDS.map(f => (lang === 'el' ? f.el : f.en)),
  rows: [
    [
      'Βασικό Λαπαροτομίας 1',
      '',
      'BH110R',
      'Λαβίδα Kocher 14cm',
      4,
      '',
      'Χειρουργείο',
      'Γενική Χειρουργική',
      'Aesculap',
      '',
      '',
      '',
    ],
    [
      'Βασικό Λαπαροτομίας 1',
      '',
      'BC260R',
      'Ψαλίδι Metzenbaum 18cm',
      2,
      '',
      'Χειρουργείο',
      'Γενική Χειρουργική',
      'Aesculap',
      '',
      '',
      '',
    ],
    ['', '', 'GN100', 'Λαβίδα βιοψίας', 1, '', '', 'Γαστρεντερολογία', 'Olympus', 50, 'SN12345', ''],
  ],
});
