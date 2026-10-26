import {describe, expect, it} from 'vitest';
import {movementsPerDay, statusCard} from '../departmentStatus';

const ready = (state: string) => state === 'READY_FOR_PICKUP';

describe('a department Home status card', () => {
  it('opens the standalone instruments when only instruments are in that status', () => {
    const card = statusCard([{state: 'IN_DEPARTMENT'}], [{state: 'READY_FOR_PICKUP'}], 'READY', ready);
    expect(card).toEqual({value: 1, to: '/department/tools?preset=1&statusFilter=READY', note: undefined});
  });

  it('opens the Sets and names both counts when Sets and instruments are in that status', () => {
    const card = statusCard(
      [{state: 'READY_FOR_PICKUP'}, {state: 'READY_FOR_PICKUP'}],
      [{state: 'READY_FOR_PICKUP'}],
      'READY',
      ready,
    );
    expect(card).toEqual({value: 3, to: '/department?preset=1&statusFilter=READY', note: '2 Σετ · 1 μεμονωμένα'});
  });
});

describe('the department Home charts', () => {
  const now = new Date(2026, 9, 26, 12, 0);
  const movements = [
    {
      at: '26/10/2026 09:00',
      from: 'Χειρουργείο',
      to: 'Κεντρική Αποστείρωση',
      by: 'Άννα',
      status: 'Ηλεκτρονική αποστολή · Άννα',
    },
    {
      at: '25/10/2026 09:00',
      from: 'Χειρουργείο',
      to: 'Κεντρική Αποστείρωση',
      by: 'Άννα',
      status: 'Αποστολή προς αποστείρωση',
    },
    {
      at: '25/10/2026 10:00',
      from: 'Χειρουργείο',
      to: 'Κεντρική Αποστείρωση',
      by: 'Νίκος',
      status: 'Ηλεκτρονική αποστολή',
    },
    // Sterilization recording the receipt is not the department sending.
    {
      at: '25/10/2026 11:00',
      from: 'Χειρουργείο',
      to: 'Κεντρική Αποστείρωση',
      by: 'Αποστείρωση',
      status: 'Παραλαβή στην Αποστείρωση',
    },
    {
      at: '24/10/2026 12:00',
      from: 'Κεντρική Αποστείρωση',
      to: 'Χειρουργείο',
      by: 'Αποστείρωση',
      status: 'Παράδοση στο τμήμα',
    },
    // Older than 30 days, and another department's.
    {
      at: '01/09/2026 09:00',
      from: 'Χειρουργείο',
      to: 'Κεντρική Αποστείρωση',
      by: 'Νίκος',
      status: 'Ηλεκτρονική αποστολή',
    },
    {at: '25/10/2026 09:00', from: 'ΤΕΠ', to: 'Κεντρική Αποστείρωση', by: 'Μαρία', status: 'Ηλεκτρονική αποστολή'},
  ];

  it('counts what the department sent and received per day', () => {
    const days = movementsPerDay(movements, 'Χειρουργείο', now);
    expect(days).toHaveLength(14);
    expect(days.slice(-3).map(d => [d.sent, d.received])).toEqual([
      [0, 1],
      [2, 0],
      [1, 0],
    ]);
  });
});
