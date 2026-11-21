import {describe, expect, it} from 'vitest';
import type {Movement, ProcessLoadRecord, SterilizationCycleRecord, Tool} from '../../../types/domain';
import {cyclesOf, daysUntil, firstUseAfter, roundsBetween, roundsOf, type CycleEntry} from '../traceModel';

const move = (id: string, at: string, patientCode?: string): Movement =>
  ({id, asset: 'S1 · Set', assetKind: 'SET', from: 'A', to: 'B', status: id, at, by: 'X', patientCode}) as Movement;
const cycle = (id: string, at: string): CycleEntry => ({
  id,
  start: at,
  at,
  sterilizer: 'K1',
  cycleNumber: id,
  label: 'Επιτυχία',
  tone: 'ok',
});

describe('roundsOf', () => {
  it('closes a round at a use on a patient, with the cycle before it, newest first', () => {
    const rounds = roundsOf(
      [
        move('receive-1', '01/11/2026 08:00'),
        move('deliver-1', '01/11/2026 12:00'),
        move('use-1', '02/11/2026 09:00', 'P1'),
        // The same use recorded again when it is sent back: it stays in the first round.
        move('send-1', '02/11/2026 11:00', 'P1'),
        move('receive-2', '03/11/2026 08:00'),
      ],
      [cycle('c1', '01/11/2026 10:00'), cycle('c2', '03/11/2026 10:00')],
    );
    expect(rounds.map(r => [r.cycle?.id, r.moves.map(m => m.id)])).toEqual([
      ['c2', ['receive-2']],
      ['c1', ['receive-1', 'deliver-1', 'use-1', 'send-1']],
    ]);
  });

  it('starts a new round at a second cycle with no use between', () => {
    const rounds = roundsOf([], [cycle('c1', '01/11/2026 10:00'), cycle('c2', '02/11/2026 10:00')]);
    expect(rounds.map(r => r.cycle?.id)).toEqual(['c2', 'c1']);
  });
});

describe('daysUntil', () => {
  it('counts the days to a date, negative once past', () => {
    const today = new Date(2026, 10, 14);
    expect(daysUntil('2026-11-24', today)).toBe(10);
    expect(daysUntil('2026-11-10', today)).toBe(-4);
    expect(daysUntil(undefined, today)).toBeUndefined();
  });
});

describe('firstUseAfter', () => {
  const item = {assetId: 'set-1', assetKind: 'SET', barcode: 'S1', assetName: 'Set', department: 'A'} as const;
  const load = (id: string, at: string) =>
    ({id, kind: 'STERILIZATION', createdAt: at, completedAt: at, items: [item]}) as unknown as ProcessLoadRecord;
  const a = load('A', '01/11/2026 10:00');
  const b = load('B', '05/11/2026 10:00');

  it('gives a use to the load before it, not to an earlier one the item left unused', () => {
    const uses = [move('use', '06/11/2026 09:00', 'P1')];
    expect(firstUseAfter(a, item, [a, b], uses)).toBeUndefined();
    expect(firstUseAfter(b, item, [a, b], uses)?.patientCode).toBe('P1');
  });

  it('finds the first use between this cycle and the next', () => {
    const uses = [move('late', '04/11/2026 09:00', 'P2'), move('early', '02/11/2026 09:00', 'P1')];
    expect(firstUseAfter(a, item, [a, b], uses)?.patientCode).toBe('P1');
  });
});

describe('cyclesOf', () => {
  it('keeps one cycle for a load recorded twice (reopened and completed again), its item out of the Set since', () => {
    const tool = {id: 't1', barcode: 'T1', name: 'Λαβίδα', mode: 'STANDALONE'} as Tool;
    const record = (id: string, at: string) =>
      ({
        id,
        loadId: 'L1',
        assetId: 's1',
        barcode: 'S1',
        toolIds: ['t1'],
        sterilizer: 'ΚΛΙΒΑΝΟΣ Α',
        cycleNumber: 'Α1',
        completedAt: at,
        result: 'PASSED',
      }) as unknown as SterilizationCycleRecord;
    const cycles = cyclesOf(tool, [], [], [record('c1', '19/11/2026 10:00'), record('c2', '19/11/2026 11:00')]);
    expect(cycles).toHaveLength(1);
    expect(cycles[0].loadId).toBe('L1');
  });
});

describe('roundsBetween', () => {
  const at = (id: string, when: string) => move(id, when);
  const rounds = [
    {key: 'b', moves: [at('2', '20/11/2026 09:00')]},
    {key: 'a', moves: [at('1', '01/11/2026 23:30'), at('1b', '03/11/2026 08:00')]},
  ];
  it('keeps every round without dates, and the rounds with a day in the period, both days included', () => {
    expect(roundsBetween(rounds, '', '')).toHaveLength(2);
    expect(roundsBetween(rounds, '2026-11-15', '').map(r => r.key)).toEqual(['b']);
    expect(roundsBetween(rounds, '', '2026-11-01').map(r => r.key)).toEqual(['a']);
    expect(roundsBetween(rounds, '2026-11-02', '2026-11-03').map(r => r.key)).toEqual(['a']);
    expect(roundsBetween(rounds, '2026-11-04', '2026-11-19')).toHaveLength(0);
  });
});
