import {describe, expect, it} from 'vitest';
import type {Movement, ProcessLoadRecord} from '../../../types/domain';
import {
  equipmentLoad,
  liveMovements,
  median,
  percentile,
  quality,
  turnaround,
  usage,
  workload,
} from '../indicatorsModel';

const move = (id: string, at: string, from: string, to: string, status: string, extra: Partial<Movement> = {}) =>
  ({
    id,
    asset: 'S000001 · ΟΡΘΟΠΕΔΙΚΟ ΒΑΣΙΚΟ',
    assetKind: 'SET',
    from,
    to,
    status,
    at,
    by: 'Άννα',
    ...extra,
  }) as Movement;
const since = new Date(2026, 10, 1).getTime();

describe('indicators', () => {
  it('median and percentile', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90)).toBe(9);
    expect(median([])).toBe(0);
  });

  it('workload counts each movement in its weekday and hour, and finds the busiest', () => {
    // 16/11/2026 is a Monday.
    const moves = [
      move('a', '16/11/2026 09:10', 'Χειρουργείο', 'Κεντρική Αποστείρωση', 'Ηλεκτρονική αποστολή'),
      move('b', '16/11/2026 09:40', 'Χειρουργείο', 'Κεντρική Αποστείρωση', 'Ηλεκτρονική αποστολή'),
      move('c', '18/11/2026 14:00', 'Κεντρική Αποστείρωση', 'Χειρουργείο', 'Παράδοση'),
      move('old', '01/10/2026 09:00', 'Χειρουργείο', 'Κεντρική Αποστείρωση', 'Ηλεκτρονική αποστολή'),
    ];
    const w = workload(moves, since, 30);
    expect(w.total).toBe(3);
    expect(w.grid[0][9]).toBe(2);
    expect(w.grid[2][14]).toBe(1);
    expect(w.peakHour).toBe(9);
    expect(w.peakDay).toBe(0);
    expect(w.perDay).toBe(0.1);
  });

  it('an undo and what it undid count as nothing', () => {
    const moves = [
      move('a', '16/11/2026 09:10', 'Χειρουργείο', 'Κεντρική Αποστείρωση', 'Ηλεκτρονική αποστολή'),
      move('u', '16/11/2026 09:20', 'Κεντρική Αποστείρωση', 'Χειρουργείο', 'Αναίρεση', {undoes: 'a'}),
    ];
    expect(liveMovements(moves, since)).toEqual([]);
    // What the undone dispatch caused (a retirement) counts as nothing too.
    const caused = move('r', '16/11/2026 09:10', 'Χειρουργείο', 'Εκτός λειτουργίας', 'Απόσυρση', {causedBy: 'a'});
    expect(liveMovements([...moves, caused], since)).toEqual([]);
  });

  it('turnaround runs from the department’s dispatch until it is back there', () => {
    const moves = [
      move('a', '16/11/2026 08:00', 'Χειρουργείο', 'Κεντρική Αποστείρωση', 'Ηλεκτρονική αποστολή'),
      move('b', '16/11/2026 09:00', 'Κεντρική Αποστείρωση', 'Καθαρισμός', 'Έναρξη καθαρισμού'),
      move('c', '17/11/2026 08:00', 'Κεντρική Αποστείρωση', 'Χειρουργείο', 'Παράδοση στο τμήμα'),
    ];
    const t = turnaround(moves, since);
    expect(t.overall.rounds).toBe(1);
    // An undone dispatch is no round, and its undo (back to the department) no return.
    const undone = [
      move('x', '18/11/2026 08:00', 'Χειρουργείο', 'Κεντρική Αποστείρωση', 'Ηλεκτρονική αποστολή'),
      move('y', '18/11/2026 08:05', 'Κεντρική Αποστείρωση', 'Χειρουργείο', 'Αναίρεση', {undoes: 'x'}),
    ];
    expect(turnaround(undone, since).overall.rounds).toBe(0);
    // The count signed with the dispatch, in the same minute (newest first, as history comes), is no return.
    const signed = [
      move('s', '19/11/2026 08:00', 'Χειρουργείο', 'Κεντρική Αποστείρωση', 'Ηλεκτρονική αποστολή'),
      move('k', '19/11/2026 08:00', 'Χειρουργείο', 'Χειρουργείο', 'Καταμέτρηση'),
    ];
    expect(turnaround(signed, since).overall.rounds).toBe(0);
    expect(t.departments).toEqual([{department: 'Χειρουργείο', median: 24, p90: 24, rounds: 1}]);
  });

  it('use counts the patient-coded movements by department and by Set', () => {
    const moves = [
      move('a', '16/11/2026 08:00', 'Χειρουργείο', 'Κεντρική Αποστείρωση', 'Ηλεκτρονική αποστολή', {
        patientCode: 'PT-1',
      }),
      move('b', '17/11/2026 08:00', 'Χειρουργείο', 'Κεντρική Αποστείρωση', 'Ηλεκτρονική αποστολή', {
        patientCode: 'PT-2',
      }),
      move('c', '17/11/2026 09:00', 'Χειρουργείο', 'Κεντρική Αποστείρωση', 'Ηλεκτρονική αποστολή'),
      // The count signed for the same use carries the same patient code: still one use.
      move('d', '17/11/2026 07:55', 'Χειρουργείο', 'Χειρουργείο', 'Καταμέτρηση εργαλείων υπογεγραμμένη · 10/10', {
        patientCode: 'PT-2',
      }),
      // A recall of the load carries the last patient's code: no use.
      move('rc', '18/11/2026 09:00', 'Κεντρική Αποστείρωση', 'Χειρουργείο', 'Ανάκληση φορτίου', {patientCode: 'PT-9'}),
      // An instrument retired as its Set went: caused by the dispatch, «from» the Set — no use, no department.
      move('e', '17/11/2026 08:00', 'Set S000001', 'Εκτός λειτουργίας', 'Απόσυρση', {
        patientCode: 'PT-2',
        causedBy: 'b',
      }),
    ];
    const u = usage(moves, since);
    expect(u.departments).toEqual([{department: 'Χειρουργείο', uses: 2, sets: 2, tools: 0, patients: 2}]);
    expect(u.sets).toEqual([{name: 'ΟΡΘΟΠΕΔΙΚΟ ΒΑΣΙΚΟ', uses: 2, departments: ['Χειρουργείο']}]);
    expect(u.tools).toEqual([]);
    // A dispatch is recorded without its kind: the Set is known by its barcode.
    const untyped = moves.map(m => ({...m, assetKind: undefined}) as unknown as Movement);
    expect(usage(untyped, since, b => b === 'S000001').sets[0]?.uses).toBe(2);
  });

  it('equipment and quality count the cycles in the period and the failed ones', () => {
    const load = (id: string, equipment: string, status: ProcessLoadRecord['status'], createdAt = '17/11/2026 08:00') =>
      ({id, kind: 'STERILIZATION', equipment, status, createdAt, items: []}) as unknown as ProcessLoadRecord;
    const loads = [
      load('1', 'Α', 'RELEASED'),
      load('2', 'Α', 'FAILED'),
      load('3', 'Β', 'RECALLED'),
      load('4', 'Β', 'RELEASED', '01/10/2026 08:00'),
    ];
    expect(equipmentLoad(loads, since).map(e => [e.name, e.cycles, e.failed])).toEqual([
      ['Α', 2, 1],
      ['Β', 1, 1],
    ]);
    expect(quality(loads, since)).toEqual({cycles: 3, washes: 0, failed: 1, reprocess: 0, recalled: 1});
    // A load from before the period, recalled in it, is a recall of the period.
    const late = {...load('5', 'Β', 'RECALLED', '01/10/2026 08:00'), recalledAt: '18/11/2026 10:00'};
    expect(quality([...loads, late], since).recalled).toBe(2);
  });
});
