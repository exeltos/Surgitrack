import {describe, expect, it} from 'vitest';
import {cleanName, cleanUps, codeGroups, nameKey, namesByCode} from '../nameCheck';

describe('cleanName', () => {
  it('writes capitals without accents and one space between words', () => {
    expect(cleanName('  Χειρουργική   λαβίδα 20 cm ')).toBe('ΧΕΙΡΟΥΡΓΙΚΗ ΛΑΒΙΔΑ 20 CM');
    expect(cleanName('Ξέστρα No 3')).toBe('ΞΕΣΤΡΑ NO 3');
  });

  it('puts each word in one alphabet', () => {
    // Latin H at the end of a Greek word; Greek Η and Α at the start of a Latin word.
    expect(cleanName('MOSQUITOE ΚΥΡΤH')).toBe('MOSQUITOE ΚΥΡΤΗ');
    expect(cleanName('MOSQUITOE ΗΑLSTED')).toBe('MOSQUITOE HALSTED');
    expect(cleanName('AΝΑΤΟΜΙΚH STANDARD')).toBe('ΑΝΑΤΟΜΙΚΗ STANDARD');
    expect(cleanName('ΛΑΒΙΔA ΚELLY')).toBe('ΛΑΒΙΔΑ KELLY');
    expect(cleanName('KELLY')).toBe('KELLY');
  });

  it('writes lengths and spaced dashes the same way', () => {
    expect(cleanName('MOSQUITOE ΚΥΡΤΟ 12cm')).toBe('MOSQUITOE ΚΥΡΤΟ 12 CM');
    expect(cleanName('MOSQUITOE ΚΥΡΤΟ 12,5 cm')).toBe('MOSQUITOE ΚΥΡΤΟ 12,5 CM');
    expect(cleanName('ΛΑΒΙΔΑ POTTS -ΘΥΡ')).toBe('ΛΑΒΙΔΑ POTTS - ΘΥΡ');
    expect(cleanName('HALSTED-MOSQUITO')).toBe('HALSTED-MOSQUITO');
  });

  it('keeps a clean name as it is', () => {
    expect(cleanName('ΨΑΛΙΔΙ METZENBAUM ΚΥΡΤΟ 18 CM')).toBe('ΨΑΛΙΔΙ METZENBAUM ΚΥΡΤΟ 18 CM');
    expect(nameKey('ΚΟΥΤΙ-ΚΑΠΑΚΙ')).toBe(nameKey('ΚΟΥΤΙ - ΚΑΠΑΚΙ'));
  });
});

describe('cleanUps', () => {
  it('lists each name that changes, with its instruments', () => {
    const items = [
      {id: '1', name: 'CRILE ΚΥΡΤΗ 16cm'},
      {id: '2', name: 'CRILE ΚΥΡΤΗ 16cm'},
      {id: '3', name: 'CRILE ΚΥΡΤΗ 16 CM'},
    ];
    expect(cleanUps(items)).toEqual([{from: 'CRILE ΚΥΡΤΗ 16cm', to: 'CRILE ΚΥΡΤΗ 16 CM', items: items.slice(0, 2)}]);
  });
});

describe('codeGroups', () => {
  const items = [
    {id: '1', code: '08.281.18', name: 'ΨΑΛΙΔΙ METZENBAUM ΚΥΡΤΟ 18 CM'},
    {id: '2', code: '08.281.18', name: 'ΨΑΛΙΔΙ METZENBAUM ΚΥΡΤΟ 18 cm'},
    {id: '3', code: '08.281.18', name: 'ΨΑΛΙΔΙ METZEBAUM'},
    {id: '4', code: '08.281.18 ', name: 'ΛΑΒΙΔΑ ΡΟΥΧΩΝ'},
    {id: '5', code: '10.102.16', name: 'ΑΝΑΤΟΜΙΚΗ'},
    {id: '6', code: '', name: 'ΑΛΛΟ'},
  ];

  it('groups the names of one code after the clean-up and suggests the most used', () => {
    const [group] = codeGroups(items);
    expect(group.code).toBe('08.281.18');
    expect(group.total).toBe(4);
    expect(group.suggested).toBe('ΨΑΛΙΔΙ METZENBAUM ΚΥΡΤΟ 18 CM');
    expect(group.names.map(n => [n.name, n.count])).toEqual([
      ['ΨΑΛΙΔΙ METZENBAUM ΚΥΡΤΟ 18 CM', 2],
      ['ΨΑΛΙΔΙ METZEBAUM', 1],
      ['ΛΑΒΙΔΑ ΡΟΥΧΩΝ', 1],
    ]);
  });

  it('marks a name sharing no word with the suggestion as odd', () => {
    const [group] = codeGroups(items);
    expect(group.names.find(n => n.name === 'ΛΑΒΙΔΑ ΡΟΥΧΩΝ')?.odd).toBe(true);
    expect(group.names.find(n => n.name === 'ΨΑΛΙΔΙ METZEBAUM')?.odd).toBe(false);
  });

  it('leaves out codes with one name and instruments without a code', () => {
    expect(codeGroups(items)).toHaveLength(1);
  });

  it('knows the name the hospital uses for each code', () => {
    expect(namesByCode(items).get('08.281.18')).toBe('ΨΑΛΙΔΙ METZENBAUM ΚΥΡΤΟ 18 CM');
  });
});
