import {describe, expect, it} from 'vitest';
import {compositionLines} from '../compositionCheck';

describe('compositionLines', () => {
  const template = [
    {code: 'A1', name: 'ΛΑΒΙΔΑ', quantity: 2},
    {code: '', name: 'Ψαλίδι  Mayo', quantity: 1},
  ];

  it('counts what each template line holds and what is missing', () => {
    const lines = compositionLines(template, [
      {barcode: 'T1', code: 'a1', name: 'ΛΑΒΙΔΑ'},
      {barcode: 'T2', code: 'Z9', name: 'ΑΓΚΙΣΤΡΟ'},
    ]);
    expect(lines.map(l => [l.name, l.expected, l.present, l.missing])).toEqual([
      ['ΛΑΒΙΔΑ', 2, 1, 1],
      ['Ψαλίδι  Mayo', 1, 0, 1],
      ['ΑΓΚΙΣΤΡΟ', undefined, 1, 0],
    ]);
  });

  it('matches a line without code by its name and carries the open issues', () => {
    const lines = compositionLines(
      template,
      [{barcode: 'T3', code: '', name: 'ΨΑΛΙΔΙ MAYO'}],
      new Map([['T3', ['Βλάβη']]]),
    );
    expect(lines[1]).toMatchObject({present: 1, missing: 0, problems: ['Βλάβη']});
  });

  it('groups the instruments when there is no template', () => {
    const lines = compositionLines(undefined, [
      {barcode: 'T1', code: 'A', name: 'X', manufacturer: 'M'},
      {barcode: 'T2', code: 'A', name: 'X', manufacturer: 'M'},
    ]);
    expect(lines).toEqual([{name: 'X', code: 'A', manufacturer: 'M', present: 2, missing: 0, problems: []}]);
  });
});
