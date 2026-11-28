import {describe, expect, it} from 'vitest';
import {codeLabel, isNoCode, normalizeCode} from '../toolCode';
import {compositionLines} from '../compositionCheck';

describe('an instrument with no code', () => {
  it('is any «no code», however it was typed, and an empty one', () => {
    for (const code of ['', '  ', 'ΧΩΡΙΣ ΚΩΔΙΚΟΣ', 'XΩΡΙΣ ΚΩΔΙΚΟ', 'ΧΩΡΙΣ ΚΩΔΙKΟ', 'Χωρίς κωδικό', 'χωρίς κωδικό'])
      expect(isNoCode(code)).toBe(true);
    expect(isNoCode('No code')).toBe(true);
    expect(isNoCode('NO CODE')).toBe(true);
    expect(isNoCode('10.180.12')).toBe(false);
    expect(isNoCode(undefined)).toBe(true);
  });

  it('is stored empty and shown as «Χωρίς κωδικό»', () => {
    expect(normalizeCode('XΩΡΙΣ ΚΩΔΙΚΟ')).toBe('');
    expect(normalizeCode(' 12.320.20 ')).toBe('12.320.20');
    expect(codeLabel('')).toBe('Χωρίς κωδικό');
    expect(codeLabel('ΧΩΡΙΣ ΚΩΔΙΚΟΣ')).toBe('Χωρίς κωδικό');
    expect(codeLabel('12.320.20')).toBe('12.320.20');
  });

  it('is matched to the composition by name, not lumped with every other one without a code', () => {
    const template = [
      {code: 'ΧΩΡΙΣ ΚΩΔΙΚΟΣ', name: 'ΛΑΒΙΔΕΣ', quantity: 2},
      {code: 'ΧΩΡΙΣ ΚΩΔΙΚΟΣ', name: 'ΧΩΝΑΚΙ', quantity: 1},
    ];
    const tools = [
      {barcode: 'T1', code: '', name: 'ΛΑΒΙΔΕΣ'},
      {barcode: 'T2', code: '', name: 'ΛΑΒΙΔΕΣ'},
      {barcode: 'T3', code: '', name: 'ΧΩΝΑΚΙ'},
    ];
    const lines = compositionLines(template, tools);
    expect(lines.map(l => [l.name, l.present, l.missing])).toEqual([
      ['ΛΑΒΙΔΕΣ', 2, 0],
      ['ΧΩΝΑΚΙ', 1, 0],
    ]);
    expect(lines[0].code).toBe('Χωρίς κωδικό');
  });
});
