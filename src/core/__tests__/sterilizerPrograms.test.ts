import {describe, expect, it} from 'vitest';
import {isPlasma, programsOf} from '../sterilizerPrograms';

describe('programsOf', () => {
  it('offers the programs without their whole length on a sterilizer ended by hand', () => {
    const programs = ['134°C · 5 min · σύνολο 45 min'];
    expect(programsOf({el: 'ΚΛΙΒΑΝΟΣ Α', programs, cycleEnd: 'MANUAL'})).toEqual(['134°C · 5 min']);
    expect(programsOf({el: 'ΚΛΙΒΑΝΟΣ Α', programs, cycleEnd: 'AUTO'})).toEqual(programs);
  });

  it('offers a sterilizer its own programs', () => {
    expect(programsOf({el: 'ΚΛΙΒΑΝΟΣ Α', programs: ['134°C · 7 min', ' ']})).toEqual(['134°C · 7 min']);
  });

  it('offers the usual steam programs, or 60°C for a plasma sterilizer', () => {
    expect(programsOf({el: 'ΚΛΙΒΑΝΟΣ Γ'})).toEqual(['134°C · 5 min', '121°C · 18 min']);
    expect(programsOf({el: 'ΠΛΑΣΜΑ STERAD 100'})).toEqual(['60°C']);
    expect(programsOf(undefined)).toEqual(['134°C · 5 min', '121°C · 18 min']);
  });

  it('knows a plasma sterilizer by its name', () => {
    expect(['Πλάσμα 1', 'STERRAD NX', 'Plasma', 'ΠΛΑΣΜΑ'].every(isPlasma)).toBe(true);
    expect(isPlasma('Κλίβανος Ατμού 01')).toBe(false);
  });
});
