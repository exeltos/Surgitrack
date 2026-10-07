import {describe, expect, it} from 'vitest';
import {nextSterilizerNames, sterilizerMark} from '../sterilizerNaming';

describe('sterilizer naming', () => {
  it('marks with letters or numbers', () => {
    expect([0, 1, 25, 26, 27].map(i => sterilizerMark('LETTERS', i))).toEqual(['A', 'B', 'Z', 'AA', 'AB']);
    expect([0, 3].map(i => sterilizerMark('NUMBERS', i))).toEqual(['1', '4']);
  });
  it('gives the next free names', () => {
    const names = nextSterilizerNames({base: 'Κλίβανος', style: 'LETTERS'}, ['Κλίβανος A', 'κλίβανος  c'], 3);
    expect(names.map(n => n.name)).toEqual(['Κλίβανος B', 'Κλίβανος D', 'Κλίβανος E']);
  });
  it('falls back to the default base name', () => {
    expect(nextSterilizerNames({base: ' ', style: 'NUMBERS'}, [], 2).map(n => n.name)).toEqual([
      'Κλίβανος 1',
      'Κλίβανος 2',
    ]);
  });
});
