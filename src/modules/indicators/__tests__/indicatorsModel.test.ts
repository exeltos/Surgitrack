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
    const w = workload(moves, since, new Date(2026, 10, 30).getTime());
    expect(w.total).toBe(3);
    expect(w.grid[0][9]).toBe(2);
    expect(w.grid[2][14]).toBe(1);
    expect(w.peakHour).toBe(9);
    expect(w.peakDay).toBe(0);
  });

  it('an undo and what it undid count as nothing', () => {
    const moves = [
      move('a', '16/11/2026 09:10', 'Χειρουργείο', 'Κεντρική Αποστείρωση', 'Ηλεκτρονική αποστολή'),
      move('u', '16/11/2026 09:20', 'Κεντρική Αποστείρωση', 'Χειρουργείο', 'Αναίρεση', {undoes: 'a'}),
    ];
    expect(liveMovements(moves, since)).toEqual([]);
  });

  it('turnaround runs from the department’s dispatch until it is back there', () => {
    const moves = [
      move('a', '16/11/2026 08:00', 'Χειρουργείο', 'Κεντρική Αποστείρωση', 'Ηλεκτρονική αποστολή'),
      move('b', '16/11/2026 09:00', 'Κεντρική Αποστείρωση', 'Καθαρισμός', 'Έναρξη καθαρισμού'),
      move('c', '17/11/2026 08:00', 'Κεντρική Αποστείρωση', 'Χειρουργείο', 'Παράδοση στο τμήμα'),
    ];
    const t = turnaround(moves, since);
    expect(t.overall.rounds).toBe(1);
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
    ];
    const u = usage(moves, since);
    expect(u.departments).toEqual([
      {department: 'Χειρουργείο', uses: 2, patients: 2, top: [{name: 'ΟΡΘΟΠΕΔΙΚΟ ΒΑΣΙΚΟ', uses: 2}]},
    ]);
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
  });
});
