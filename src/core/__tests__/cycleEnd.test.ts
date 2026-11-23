import {describe, expect, it} from 'vitest';
import {autoEndAt, autoEnded, openCycleOn} from '../cycleEnd';
import {
  programBase,
  programFields,
  programFromFields,
  programTotalMinutes,
  withTotalMinutes,
} from '../sterilizerPrograms';
import {planFor} from '../cycleSimulator';
import type {ProcessLoadRecord} from '../../types/domain';

const load = (over: Partial<ProcessLoadRecord> = {}): ProcessLoadRecord => ({
  id: 'L1',
  workflowVersion: 1,
  kind: 'STERILIZATION',
  equipment: 'ΚΛΙΒΑΝΟΣ Α',
  cycleNumber: 'S-1',
  program: '134°C · 5 min · σύνολο 45 min',
  status: 'OPEN',
  items: [],
  createdByUserId: 'u',
  createdByName: 'Τ',
  createdAt: '23/11/2026 09:00',
  ...over,
});

describe('a program with the whole cycle length', () => {
  it('reads, writes and drops the total, and the exposure stays the exposure', () => {
    expect(programTotalMinutes('134°C · 5 min · σύνολο 45 min')).toBe(45);
    expect(programTotalMinutes('134°C · 5 min')).toBeUndefined();
    expect(programBase('134°C · 5 min · σύνολο 45 min')).toBe('134°C · 5 min');
    expect(withTotalMinutes('134°C · 5 min', 50)).toBe('134°C · 5 min · σύνολο 50 min');
    expect(withTotalMinutes('134°C · 5 min · σύνολο 50 min', undefined)).toBe('134°C · 5 min');
    expect(planFor('60°C · σύνολο 47 min').holdMinutes).toBe(5);
    expect(planFor('134°C · 7 min · σύνολο 45 min').holdMinutes).toBe(7);
  });
});

describe('the end of a cycle', () => {
  const start = new Date(2026, 10, 23, 9, 0).getTime();

  it('is known from the program, counted from the exact start, and passed once its time has come', () => {
    const exact = load({startedAtMs: start + 59_000});
    expect(autoEndAt(exact)).toBe(start + 59_000 + 45 * 60_000);
    expect(autoEnded(exact, start + 45 * 60_000)).toBe(false);
    expect(autoEnded(exact, start + 59_000 + 45 * 60_000)).toBe(true);
    // Only the minute known: from the end of that minute, never short.
    expect(autoEndAt(load())).toBe(start + 46 * 60_000);
  });

  it('is by hand for a program with no total, a simulated cycle or a load no longer in the sterilizer', () => {
    expect(autoEndAt(load({program: '134°C · 5 min'}))).toBeUndefined();
    expect(autoEndAt(load({simulation: {scenario: 'PASS', startedAt: start, speed: 20}}))).toBeUndefined();
    expect(autoEndAt(load({status: 'AWAITING_RELEASE'}))).toBeUndefined();
    // Sent back into the sterilizer after being ended by hand: by hand from then on.
    expect(autoEndAt(load({reopenedAt: '23/11/2026 10:00'}))).toBeUndefined();
  });

  it('finds the cycle still running in a sterilizer', () => {
    const loads = [load({id: 'A', status: 'AWAITING_RELEASE'}), load({id: 'B'}), load({id: 'C', equipment: 'Β'})];
    expect(openCycleOn(loads, 'ΚΛΙΒΑΝΟΣ Α')?.id).toBe('B');
    expect(openCycleOn(loads, 'ΚΛΙΒΑΝΟΣ Γ')).toBeUndefined();
  });
});

describe('a program in its parts', () => {
  it('splits the text into fields and writes it back the same', () => {
    expect(programFields('134°C · 5 min · σύνολο 45 min')).toEqual({
      name: '',
      temperature: '134',
      exposure: '5',
      total: '45',
    });
    expect(programFields('Prion · 134°C · 18 min')).toEqual({
      name: 'Prion',
      temperature: '134',
      exposure: '18',
      total: '',
    });
    expect(programFields('60°C')).toEqual({name: '', temperature: '60', exposure: '', total: ''});
    for (const text of ['134°C · 5 min', '121°C · 18 min', '60°C', 'Prion · 134°C · 18 min · σύνολο 60 min'])
      expect(programFromFields(programFields(text))).toBe(text);
    expect(programFromFields({name: '', temperature: '', exposure: '', total: '40'})).toBe('σύνολο 40 min');
  });
});
