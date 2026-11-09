import {fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import ListExport from '../ListExport';

const table = () => ({title: 'T', headers: ['A'], rows: [['x']]});
const open = () => render(<ListExport table={table} pickDay />);

describe('the day of a download', () => {
  afterEach(() => vi.restoreAllMocks());

  it('opens the calendar when the button is clicked, not only the icon inside the field', () => {
    const showPicker = vi.fn();
    Object.defineProperty(HTMLInputElement.prototype, 'showPicker', {value: showPicker, configurable: true});
    open();
    fireEvent.click(screen.getByLabelText('Ημερομηνία για την κατάσταση της λήψης'));
    expect(showPicker).toHaveBeenCalledTimes(1);
  });

  it('still works where the browser has no showPicker, or refuses it', () => {
    Object.defineProperty(HTMLInputElement.prototype, 'showPicker', {
      value: () => {
        throw new Error('NotAllowedError');
      },
      configurable: true,
    });
    open();
    expect(() => fireEvent.click(screen.getByLabelText('Ημερομηνία για την κατάσταση της λήψης'))).not.toThrow();
    delete (HTMLInputElement.prototype as {showPicker?: unknown}).showPicker;
    expect(() => fireEvent.click(screen.getByLabelText('Ημερομηνία για την κατάσταση της λήψης'))).not.toThrow();
  });

  it('shows the chosen day and clears it', () => {
    open();
    expect(screen.getByText('Σήμερα')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Ημερομηνία για την κατάσταση της λήψης'), {target: {value: '2026-10-30'}});
    expect(screen.queryByText('Σήμερα')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Καθαρισμός ημερομηνίας'}));
    expect(screen.getByText('Σήμερα')).toBeInTheDocument();
  });
});
