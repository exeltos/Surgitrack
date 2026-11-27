import {describe, expect, it} from 'vitest';
import {compositionLines, templateWithAdded} from '../compositionCheck';

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

describe('the template after instruments are put into a Set by hand', () => {
  const template = [
    {code: '12.223.10', name: 'MOSQUITOE ΚΥΡΤΟ', quantity: 2},
    {code: '13.385.13', name: 'KOCHER ΛΕΠΤΗ ΚΥΡΤΗ 10 CM', quantity: 1},
    {code: '20.106.11', name: 'ΜΗΛΗ ΣΤΡΟΓΓΥΛΗ', quantity: 1},
  ];
  const mosquito = {code: '12.223.10', name: 'MOSQUITOE ΚΥΡΤΟ'};
  const probe = {code: '20.106.11', name: 'ΜΗΛΗ ΣΤΡΟΓΓΥΛΗ'};
  const kocher = {code: '12.231.12', name: 'KOCHER ΚΥΡΤΗ'};

  it('lets a replacement with another code take the missing one’s line, in its place', () => {
    const next = templateWithAdded(template, [mosquito, mosquito, probe], [kocher]);
    expect(next).toEqual([template[0], {code: '12.231.12', name: 'KOCHER ΚΥΡΤΗ', quantity: 1}, template[2]]);
    // The composition sheet then misses nothing.
    expect(
      compositionLines(
        next,
        [mosquito, mosquito, probe, kocher].map((tool, i) => ({...tool, barcode: `T${i}`})),
      ).every(line => !line.missing),
    ).toBe(true);
  });

  it('picks the missing one most alike by name', () => {
    const next = templateWithAdded(template, [mosquito], [kocher]);
    // A MOSQUITOE and the KOCHER are missing: the KOCHER takes the KOCHER's line, the MOSQUITOE stays missing.
    expect(next?.map(line => line.code)).toEqual(['12.223.10', '12.231.12', '20.106.11']);
  });

  it('fills the instrument’s own line and changes nothing when the template asks for it', () => {
    expect(templateWithAdded(template, [mosquito, probe], [mosquito])).toEqual(template);
  });

  it('grows by an instrument it does not ask for when nothing is missing', () => {
    const next = templateWithAdded(template, [mosquito, mosquito, probe, {code: '13.385.13', name: 'x'}], [kocher]);
    expect(next).toEqual([...template, {code: '12.231.12', name: 'KOCHER ΚΥΡΤΗ', quantity: 1}]);
  });

  it('takes one of a line of two for a replacement with another code', () => {
    const next = templateWithAdded(template, [mosquito, probe, {code: '13.385.13', name: 'x'}], [kocher]);
    expect(next).toEqual([
      {...template[0], quantity: 1},
      template[1],
      template[2],
      {code: '12.231.12', name: 'KOCHER ΚΥΡΤΗ', quantity: 1},
    ]);
  });

  it('adds up the lines that share a code before calling an instrument extra', () => {
    const twoLines = [
      {code: 'A1', name: 'KOCHER', quantity: 1},
      {code: 'A1', name: 'KOCHER', quantity: 1},
    ];
    const a = {code: 'A1', name: 'KOCHER'};
    expect(templateWithAdded(twoLines, [a], [a])).toEqual(twoLines);
  });

  it('gives the incoming instruments their own lines first, whatever their order', () => {
    const empty = [
      {code: 'A', name: 'KOCHER', quantity: 1},
      {code: 'B', name: 'CURVED', quantity: 1},
      {code: 'C', name: 'KOCHER STRAIGHT', quantity: 1},
    ];
    const x = {code: 'X', name: 'KOCHER CURVED'};
    const a = {code: 'A', name: 'KOCHER'};
    const one = templateWithAdded(empty, [], [x, a]);
    const other = templateWithAdded(empty, [], [a, x]);
    expect(one).toEqual(other);
    // A keeps its own line; X takes the place of one still missing (B or C), never A's.
    expect(one?.map(line => line.code)).toContain('A');
    expect(one?.map(line => line.code)).toContain('X');
    expect(one?.reduce((sum, line) => sum + line.quantity, 0)).toBe(3);
  });

  it('keeps a Set without a template without one', () => {
    expect(templateWithAdded(undefined, [], [kocher])).toBeUndefined();
  });
});
