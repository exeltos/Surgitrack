import {describe, expect, it} from 'vitest';
import {autoMapping, buildImportPlan, findHeaderRow, templateTable} from '../assetImport';

const context = (existing: string[] = []) => ({
  lang: 'el' as const,
  departments: [
    {name: 'Χειρουργείο', code: 'OR'},
    {name: 'Ορθοπαιδική', code: 'ORTH'},
  ],
  existingBarcodes: new Set(existing),
  batch: 'impX',
  now: new Date(2026, 9, 3),
});

const template = templateTable('el');
const sheet = (rows: Array<Array<string | number>>) => [
  [template.title],
  template.headers,
  ...rows.map(r => r.map(String)),
];

const plan = (rows: Array<Array<string | number>>, existing?: string[]) => {
  const all = sheet(rows);
  const header = findHeaderRow(all);
  return buildImportPlan(all.slice(header + 1), header + 2, autoMapping(all[header]), context(existing));
};

describe('asset import', () => {
  it('finds the header row under the title and maps every template column', () => {
    const all = sheet([]);
    expect(findHeaderRow(all)).toBe(1);
    expect(Object.values(autoMapping(all[1]))).toEqual(template.headers.map((_, i) => i));
  });

  it('maps common English and accent-free headers', () => {
    const mapping = autoMapping(['Qty', 'TOOLNAME', 'tmima', 'Τμημα', 'Barcode']);
    expect(mapping.quantity).toBe(0);
    expect(mapping.name).toBe(1);
    expect(mapping.department).toBe(3);
    expect(mapping.barcode).toBe(4);
  });

  it('builds the template example: one Set of six, one Stock instrument', () => {
    const result = plan(template.rows, ['T000041', 'S000007']);
    expect(result.errors).toEqual([]);
    expect(result.sets).toHaveLength(1);
    const [set] = result.sets;
    expect(set).toMatchObject({
      barcode: 'S000008',
      name: 'Βασικό Λαπαροτομίας 1',
      department: 'Χειρουργείο',
      state: 'IN_DEPARTMENT',
      expected: 6,
      actual: 6,
      importBatch: 'impX',
      compositionTemplate: [
        {code: 'BH110R', name: 'Λαβίδα Kocher 14cm', quantity: 4},
        {code: 'BC260R', name: 'Ψαλίδι Metzenbaum 18cm', quantity: 2},
      ],
    });
    expect(result.tools).toHaveLength(7);
    expect(
      result.tools
        .slice(0, 6)
        .every(t => t.setId === set.id && t.mode === 'SET_MEMBER' && t.department === 'Χειρουργείο'),
    ).toBe(true);
    expect(result.tools.map(t => t.barcode)).toEqual([
      'T000042',
      'T000043',
      'T000044',
      'T000045',
      'T000046',
      'T000047',
      'T000048',
    ]);
    expect(result.tools[6]).toMatchObject({
      mode: 'STOCK',
      state: 'IN_STOCK',
      maxUses: 50,
      serialNumber: 'SN12345',
      department: undefined,
    });
    expect(result).toMatchObject({rows: 3, setMembers: 6, standalone: 0, stock: 1});
  });

  it('keeps sets with the same name apart by their Set barcode, and finds departments by code', () => {
    const result = plan([
      ['Βασικό', 'S100', '', 'Λαβίδα', 1, '', 'or', '', '', '', '', ''],
      ['Βασικό', 'S200', '', 'Λαβίδα', 1, '', 'OR', '', '', '', '', ''],
      ['', '', '', 'Οστεοτόμο', 2, '', 'Ορθοπαιδικη', '', '', '', '', ''],
    ]);
    expect(result.errors).toEqual([]);
    expect(result.sets.map(s => s.barcode)).toEqual(['S100', 'S200']);
    expect(result.tools.slice(2).every(t => t.mode === 'STANDALONE' && t.department === 'Ορθοπαιδική')).toBe(true);
  });

  it('reports every problem with its row number and creates nothing to rely on', () => {
    const result = plan(
      [
        ['', '', '', '', 1, '', '', '', '', '', '', ''],
        ['', '', '', 'Λαβίδα', 'δύο', '', 'Καρδιολογική', '', '', '', '', ''],
        ['', '', '', 'Λαβίδα', 3, 'T000001', '', '', '', '', 'SN1', ''],
        ['', '', '', 'Λαβίδα', 1, 'T000009', '', '', '', '0', '', ''],
        ['', '', '', 'Ψαλίδι', 1, 't000009', '', '', '', '', '', ''],
        ['Βασικό', '', '', 'Λαβίδα', 1, '', 'Χειρουργείο', '', '', '', '', ''],
        ['Βασικό', '', '', 'Ψαλίδι', 1, '', 'Ορθοπαιδική', '', '', '', '', ''],
      ],
      ['T000001'],
    );
    expect(result.errors.map(e => e.row)).toEqual([3, 4, 4, 5, 5, 6, 7, 9]);
    expect(result.errors.map(e => e.message).join(' | ')).toMatch(/Λείπει το όνομα/);
    expect(result.errors.find(e => e.row === 4 && /τμήμα/.test(e.message))).toBeTruthy();
    expect(result.errors.find(e => e.row === 7)?.message).toMatch(/και στη γραμμή 6/);
    expect(result.errors.find(e => e.row === 9)?.message).toMatch(/άλλο τμήμα στη γραμμή 8/);
  });

  it('refuses a Set and an instrument sharing one barcode on the same row', () => {
    const result = plan([['Βασικό', 'X900', '', 'Λαβίδα', 1, 'x900', '', '', '', '', '', '']]);
    expect(result.errors).toEqual([{row: 3, message: 'Το Σετ και το εργαλείο έχουν το ίδιο barcode X900.'}]);
  });
});

describe('uses already made and new instruments in the import', () => {
  const COLS = [
    'Σετ',
    'Barcode Σετ',
    'Κωδικός εργαλείου',
    'Όνομα εργαλείου',
    'Ποσότητα',
    'Barcode εργαλείου',
    'Τμήμα',
    'Ειδικότητα',
    'Κατασκευαστής',
    'Μέγιστες χρήσεις',
    'Χρήσεις που έγιναν',
    'Υπόλοιπο χρήσεων',
  ];
  const run = (rows: Array<Array<string | number>>) => {
    const all = [COLS, ...rows.map(r => r.map(String))];
    return buildImportPlan(all.slice(1), 2, autoMapping(COLS), context());
  };
  const line = (max: string, done: string, left: string) => [
    '',
    '',
    'K1',
    'Ψαλίδι',
    1,
    '',
    'Χειρουργείο',
    '',
    '',
    max,
    done,
    left,
  ];

  it('brings an instrument in with the uses it already made, so it does not pass for new (zero uses)', () => {
    const result = run([line('18', '5', '')]);
    expect(result.errors).toEqual([]);
    expect(result.tools[0]).toMatchObject({uses: 5, maxUses: 18});
  });

  it('takes the uses left instead, as the limit less them', () => {
    expect(run([line('18', '', '3')]).tools[0]).toMatchObject({uses: 15, maxUses: 18});
  });

  it('refuses uses made without a limit or over the limit', () => {
    expect(run([line('', '3', '')]).errors).toHaveLength(1);
    expect(run([line('5', '9', '')]).errors).toHaveLength(1);
  });

  it('no longer reads a column named just «Χρήσεις» as the limit', () => {
    expect(autoMapping(['Όνομα εργαλείου', 'Χρήσεις']).maxUses).toBe(-1);
  });
});

describe('a department and specialty for every row', () => {
  it('fills them in when the file has no such column, and a row that says its own keeps it', () => {
    const headers = ['ΕΡΓΑΛΕΙΟ', 'ΤΕΜΑΧΙΑ', 'ΚΩΔΙΚΟΣ'];
    const rows = [
      ['ΔΙΠΟΛΙΚΗ ΜΠΙΛΙΑ', '2', 'PP01'],
      ['ΨΑΛΙΔΙ', '1', 'VZ'],
    ];
    const mapping = autoMapping(headers);
    expect(mapping.department).toBe(-1);
    const result = buildImportPlan(rows, 2, mapping, {
      ...context(),
      fixed: {department: 'Χειρουργείο', specialty: 'Ουρολογία'},
    });
    expect(result.errors).toEqual([]);
    expect(result.tools.map(t => [t.department, t.specialty])).toEqual([
      ['Χειρουργείο', 'Ουρολογία'],
      ['Χειρουργείο', 'Ουρολογία'],
      ['Χειρουργείο', 'Ουρολογία'],
    ]);
    // A file with its own column: a filled cell is kept, an empty one takes the value for every row.
    const withColumn = buildImportPlan(
      [
        ['ΨΑΛΙΔΙ', '1', 'VZ', 'Ορθοπαιδική'],
        ['ΛΑΒΙΔΑ', '1', 'VY', ''],
      ],
      2,
      autoMapping([...headers, 'ΤΜΗΜΑ']),
      {...context(), fixed: {department: 'Χειρουργείο'}},
    );
    expect(withColumn.tools.map(t => t.department)).toEqual(['Ορθοπαιδική', 'Χειρουργείο']);
  });
});

describe('the usage type of the instruments', () => {
  const headers = ['ΕΡΓΑΛΕΙΟ', 'ΤΥΠΟΣ ΧΡΗΣΗΣ', 'ΜΕΓΙΣΤΕΣ ΧΡΗΣΕΙΣ', 'ΧΡΗΣΕΙΣ ΠΟΥ ΕΓΙΝΑΝ'];
  const run = (rows: string[][], fixed?: Record<string, string>) =>
    buildImportPlan(rows, 2, autoMapping(headers), {...context(), fixed});

  it('reads limited uses, a wear check or no limit, from a column or the same for every row', () => {
    const result = run([
      ['ΛΑΒΙΔΑ', 'Πολλαπλών χρήσεων', '20', '3'],
      ['ΨΑΛΙΔΙ', 'Μέχρι τη φθορά', '', '5'],
      ['ΑΓΚΙΣΤΡΟ', 'Χωρίς όριο', '', ''],
    ]);
    expect(result.errors).toEqual([]);
    expect(result.tools.map(t => [t.maxUses, t.wearCheck, t.uses])).toEqual([
      [20, undefined, 3],
      [undefined, true, 5],
      [undefined, undefined, 0],
    ]);
    const wear = buildImportPlan([['ΨΑΛΙΔΙ']], 2, autoMapping(['ΕΡΓΑΛΕΙΟ']), {
      ...context(),
      fixed: {usageType: 'Με έλεγχο φθοράς'},
    });
    expect(wear.tools[0].wearCheck).toBe(true);
  });

  it('says what does not fit the type', () => {
    const result = run([
      ['ΛΑΒΙΔΑ', 'Περιορισμένων χρήσεων', '', ''],
      ['ΨΑΛΙΔΙ', 'Με έλεγχο φθοράς', '10', ''],
      ['ΑΓΚΙΣΤΡΟ', 'κάτι άλλο', '', ''],
    ]);
    expect(result.errors.map(e => e.row)).toEqual([2, 3, 4]);
  });
});
