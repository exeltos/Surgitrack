import {describe, expect, it} from 'vitest';
import {cleanStaffName, maskPhone, matchDepartment, parseStaffSheet, phonePassword} from '../staffImportFile';

const DEPARTMENTS = [
  {id: 'd-or', name: 'ΧΕΙΡΟΥΡΓΕΙΟ', code: 'OR'},
  {id: 'd-ster', name: 'ΑΠΟΣΤΕΙΡΩΣΗ', code: 'CSSD'},
  {id: 'd-mama', name: 'ΜΑΙΕΥΤΙΚΗ', code: null},
  {id: 'd-chir', name: 'ΧΕΙΡΟΥΡΓΙΚΗ', code: null},
  {id: 'd-pat', name: 'ΠΑΘΟΛΟΓΙΚΗ', code: null},
];
const parse = (sheet: string[][], existing: string[] = []) => parseStaffSheet(sheet, DEPARTMENTS, new Set(existing));

describe('the mobile number as the initial password', () => {
  it.each([
    ['6912345678', '6912345678'],
    ['691 234 5678', '6912345678'],
    ['+30 691 234 5678', '6912345678'],
    ['0030 691 234 5678', '6912345678'],
    ['306912345678', '6912345678'],
  ])('reads %s as %s', (given, wanted) => expect(phonePassword(given)).toBe(wanted));
  it.each(['', 'abc', '12345', '1'.repeat(16)])('refuses %j', given => expect(phonePassword(given)).toBeNull());
  it('shows it masked: enough to recognise, not to read', () => {
    expect(maskPhone('6912345678')).toBe('691••••678');
    expect(maskPhone('+30 691 234 5678')).toBe('691••••678');
    expect(maskPhone('abc')).toBe('•••');
    expect(maskPhone('')).toBe('');
  });
});

describe('the departments', () => {
  it('matches by name, with or without accents or case, or by code', () => {
    expect(matchDepartment('Χειρουργείο', DEPARTMENTS)).toBe('d-or');
    expect(matchDepartment('  αποστείρωση ', DEPARTMENTS)).toBe('d-ster');
    expect(matchDepartment('cssd', DEPARTMENTS)).toBe('d-ster');
    expect(matchDepartment('OR', DEPARTMENTS)).toBe('d-or');
  });
  it('matches a name that starts with the cell, only when exactly one does', () => {
    expect(matchDepartment('Παθολ', DEPARTMENTS)).toBe('d-pat');
    expect(matchDepartment('Χειρουργ', DEPARTMENTS)).toBe(''); // ΧΕΙΡΟΥΡΓΕΙΟ and ΧΕΙΡΟΥΡΓΙΚΗ
    expect(matchDepartment('Άγνωστο', DEPARTMENTS)).toBe('');
    expect(matchDepartment('', DEPARTMENTS)).toBe('');
  });
});

describe('reading the list', () => {
  it('uses the header row to find the columns, whatever their order', () => {
    const rows = parse([
      ['Κινητό', 'Τμήμα', 'Ονοματεπώνυμο', 'Email', 'Ρόλος'],
      ['6912345678', 'Χειρουργείο', 'Μαρία Παπαδοπούλου', 'Maria@Hospital.gr', 'Αποστείρωση'],
    ]);
    expect(rows).toEqual([
      {
        id: 0,
        name: 'ΜΑΡΙΑ ΠΑΠΑΔΟΠΟΥΛΟΥ',
        departmentGiven: 'Χειρουργείο',
        departmentId: 'd-or',
        role: 'STERILIZATION',
        phone: '6912345678',
        email: 'maria@hospital.gr',
        problems: [],
        existing: false,
      },
    ]);
  });

  it('joins a surname and a first name column as FIRST SURNAME', () => {
    const rows = parse([
      ['Επώνυμο', 'Όνομα', 'Τμήμα', 'Τηλέφωνο'],
      ['Νικολάου', 'Γιώργος', 'ΜΑΙΕΥΤΙΚΗ', '6987654321'],
    ]);
    expect(rows[0].name).toBe('ΓΙΩΡΓΟΣ ΝΙΚΟΛΑΟΥ');
    expect(rows[0].departmentId).toBe('d-mama');
  });

  it('takes name, department, mobile, email, role by position when there is no header', () => {
    const rows = parse([['Ελένη Κωνσταντίνου', 'Αποστείρωση', '6911111111', '', 'Παρατηρητής']]);
    expect(rows[0]).toMatchObject({
      name: 'ΕΛΕΝΗ ΚΩΝΣΤΑΝΤΙΝΟΥ',
      departmentId: 'd-ster',
      role: 'VIEWER',
      phone: '6911111111',
    });
  });

  it('gives a department user the role by default, and skips blank rows', () => {
    const rows = parse([
      ['Όνομα', 'Τμήμα', 'Κινητό'],
      [],
      ['', '', ''],
      ['Μαρία Ιωάννου', 'Χειρουργείο', '6912345678'],
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe('DEPARTMENT');
  });

  it('says what is wrong with a row, and leaves the good ones alone', () => {
    const rows = parse([
      ['Ονοματεπώνυμο', 'Τμήμα', 'Κινητό', 'Email', 'Ρόλος'],
      ['Μαρία Ιωάννου', 'Χειρουργείο', '6912345678', '', ''],
      ['1234', 'Χειρουργείο', '6912345678', '', ''],
      ['Γιάννης Δήμου', 'Κάπου', '6912345678', '', ''],
      ['Άννα Λάμπρου', 'Χειρουργείο', 'τηλ;', '', ''],
      ['Πέτρος Ράλλης', 'Χειρουργείο', '6912345678', 'not-an-email', ''],
      ['Νίκος Σάββα', 'Χειρουργείο', '6912345678', '', 'Διευθυντής'],
    ]);
    expect(rows.map(r => r.problems)).toEqual([[], ['name'], ['department'], ['phone'], ['email'], ['role']]);
  });

  it('needs no department for an observer', () => {
    const rows = parse([
      ['Ονοματεπώνυμο', 'Τμήμα', 'Κινητό', 'Ρόλος'],
      ['Μαρία Ιωάννου', '', '6912345678', 'Παρατηρητής'],
    ]);
    expect(rows[0].problems).toEqual([]);
  });

  it('marks someone already in the hospital by name', () => {
    const rows = parse(
      [
        ['Ονοματεπώνυμο', 'Τμήμα', 'Κινητό'],
        ['Μαρία Ιωάννου', 'Χειρουργείο', '6912345678'],
      ],
      ['ΜΑΡΙΑ ΙΩΑΝΝΟΥ'],
    );
    expect(rows[0].existing).toBe(true);
    expect(cleanStaffName('  μαρία   ιωάννου ')).toBe('ΜΑΡΙΑ ΙΩΑΝΝΟΥ');
  });
});
