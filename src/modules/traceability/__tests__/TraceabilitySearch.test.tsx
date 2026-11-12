import {fireEvent, screen, within} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {renderPage} from '../../../test/renderPage';
import TraceabilityPage from '../TraceabilityPage';

const field = () => screen.getByRole('textbox', {name: 'Barcode (S..., T...) ή όνομα Σετ/εργαλείου'});

describe('TraceabilityPage search', () => {
  it('offers the Sets and instruments a typed name fits, and opens the one picked', () => {
    renderPage(<TraceabilityPage />, {path: '/traceability'});
    fireEvent.change(field(), {target: {value: 'ΟΡΘΟΠΕΔΙΚΟ'}});
    const list = screen.getByRole('listbox', {name: 'Προτάσεις'});
    const first = within(list).getAllByRole('option')[0];
    const barcode = first.querySelector('b')!.textContent!;
    fireEvent.click(within(first).getByRole('button'));
    expect(field()).toHaveValue(barcode);
    expect(screen.queryByRole('listbox', {name: 'Προτάσεις'})).not.toBeInTheDocument();
    expect(screen.getByRole('link', {name: /Άνοιγμα καρτέλας/})).toBeInTheDocument();
  });

  it('shows one line of help, not an empty card, before anything is typed', () => {
    renderPage(<TraceabilityPage />, {path: '/traceability'});
    expect(screen.getByText('Σκανάρετε ή πληκτρολογήστε barcode (S..., T...) ή όνομα.')).toBeInTheDocument();
    expect(document.querySelector('.timeline')).toBeNull();
  });
});
