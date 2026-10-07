import {describe, expect, it} from 'vitest';
import {countDepartments, countsAtDepartment} from '../surgicalCount';
import {countFormBody} from '../../components/department/printCountForm';

describe('surgical count departments', () => {
  it('defaults to the operating theatres and follows the Studio list once set', () => {
    expect(countsAtDepartment('Χειρουργείο')).toBe(true);
    expect(countsAtDepartment('Κεντρικό Χειρουργείο')).toBe(true);
    expect(countsAtDepartment('ΜΕΘ')).toBe(false);
    expect(countsAtDepartment('Χειρουργείο', ['ΜΕΘ'])).toBe(false);
    expect(countsAtDepartment('ΜΕΘ', ['ΜΕΘ'])).toBe(true);
    expect(countDepartments(['Χειρουργείο', 'ΤΕΠ', 'Χειρουργείο Ημέρας'])).toEqual([
      'Χειρουργείο',
      'Χειρουργείο Ημέρας',
    ]);
  });
});

describe('count form', () => {
  const items = [
    {id: 't1', barcode: 'T1', name: 'KOCHER'},
    {id: 't2', barcode: 'T2', name: 'ΨΑΛΙΔΙ'},
  ];
  it('prints part B blank before the count and filled in once signed', () => {
    const blank = countFormBody({asset: {barcode: 'S1', name: 'ΒΑΣΙΚΟ'}, items});
    expect(blank).toContain('Εκκρεμεί υπογραφή');
    expect(blank).toContain('Καταμετρήθηκαν ___ από 2');
    const signed = countFormBody({
      asset: {barcode: 'S1', name: 'ΒΑΣΙΚΟ'},
      items,
      count: {
        id: 'c1',
        setId: 's1',
        patientCode: 'PT-1',
        expected: 2,
        counted: 1,
        result: 'MISSING',
        note: '',
        at: '07/10/2026 10:00',
        by: 'Νίκος',
        signed: true,
        checkedToolIds: ['t1'],
        missing: ['T2'],
        sterileUntil: '2027-02-04',
        sterilizedOn: '2026-08-04',
        sterilizedTime: '10:30',
      },
    });
    expect(signed).toContain('Υπογεγραμμένη 07/10/2026 10:00');
    expect(signed).toContain('Καταμετρήθηκαν 1 από 2 · Λείπουν: T2');
    expect(signed).toContain('04/08/2026, 10:30');
    expect(signed).toContain('PT-1');
  });
});
