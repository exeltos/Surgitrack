import {describe, expect, it} from 'vitest';
import {electronicDispatch} from '../electronicDispatch';
import type {Movement} from '../../types/domain';

const move = (id: string, at: string, status: string, extra: Partial<Movement> = {}): Movement => ({
  id,
  asset: 'S000341 · ΑΓΓΕΙΟΧΕΙΡΟΥΡΓΙΚΟ',
  assetKind: 'SET',
  from: 'ΧΕΙΡΟΥΡΓΕΙΟ',
  to: 'Κεντρική Αποστείρωση',
  status,
  at,
  by: 'Μαρία',
  ...extra,
});

describe('electronicDispatch', () => {
  it('finds the latest dispatch of the item, not one undone', () => {
    const movements = [
      move('u', '17/11/2026 12:41', 'Αναίρεση', {undoes: 'm3'}),
      move('m3', '17/11/2026 12:40', 'Ηλεκτρονική αποστολή · Νίκος', {by: 'Νίκος'}),
      move('m2', '17/11/2026 12:39', 'Ηλεκτρονική αποστολή · Ελένη', {by: 'Ελένη'}),
      move('m1', '17/11/2026 10:00', 'Παραλαβή'),
      move('x', '17/11/2026 12:50', 'Ηλεκτρονική αποστολή', {asset: 'S000342 · ΑΛΛΟ', by: 'Άλλος'}),
    ];
    expect(electronicDispatch(movements, 'S000341')).toEqual({
      by: 'Ελένη',
      at: '17/11/2026 12:39',
      department: 'ΧΕΙΡΟΥΡΓΕΙΟ',
    });
  });
  it('is nothing for an item never sent', () => {
    expect(electronicDispatch([], 'S000341')).toBeUndefined();
  });
});
