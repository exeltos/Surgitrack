import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {Movement} from '../../../types/domain';
import ItemHistory from '../ItemHistory';
import type {Round} from '../traceModel';

vi.mock('../../../components/assets/useUndoneMovements', () => ({useUndoneMovements: () => new Set<string>()}));

const move = (id: string, at: string): Movement => ({
  id,
  asset: 'S1 · X',
  assetKind: 'SET',
  from: 'Χειρουργείο',
  to: 'Κεντρική Αποστείρωση',
  status: 'Παραλαβή στην Αποστείρωση',
  at,
  by: 'Μαρία',
});
const rounds: Round[] = [
  {key: 'new', moves: [move('2', '20/11/2026 09:00')]},
  {key: 'old', moves: [move('1', '02/11/2026 09:00')]},
];
const shownRounds = () => document.querySelectorAll('.trace-flow-round').length;

describe('ItemHistory', () => {
  it('shows the current round first, every round, or the rounds of the days asked for', () => {
    render(<ItemHistory rounds={rounds} onPatient={vi.fn()} onLoad={vi.fn()} />);
    expect(shownRounds()).toBe(1);
    expect(screen.getByText('20/11/2026 09:00')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: /Όλοι οι γύροι/}));
    expect(shownRounds()).toBe(2);

    fireEvent.click(screen.getByRole('button', {name: /Ημερομηνίες/}));
    fireEvent.change(screen.getByLabelText('Από'), {target: {value: '2026-11-01'}});
    fireEvent.change(screen.getByLabelText('Έως'), {target: {value: '2026-11-05'}});
    expect(shownRounds()).toBe(1);
    expect(screen.getByText('02/11/2026 09:00')).toBeInTheDocument();
  });
});
