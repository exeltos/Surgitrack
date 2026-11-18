import {fireEvent, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {renderPage} from '../../../test/renderPage';
import TraceabilityPage from '../TraceabilityPage';

const field = () => screen.getByRole('textbox', {name: 'Barcode (S..., T...) ή όνομα Σετ/εργαλείου'});

describe('Ιχνηλάτηση and its «Πίσω»', () => {
  it('steps back through the tabs and the searches, one at a time', async () => {
    renderPage(<TraceabilityPage />, {path: '/traceability'});
    fireEvent.change(field(), {target: {value: 'S000321'}});
    fireEvent.submit(field().closest('form')!);
    fireEvent.click(screen.getByRole('tab', {name: /Ασθενής/}));
    expect(screen.queryByRole('textbox', {name: 'Barcode (S..., T...) ή όνομα Σετ/εργαλείου'})).toBeNull();
    // Back: the search and its result, as left.
    fireEvent.click(screen.getByRole('button', {name: 'Πίσω'}));
    expect(await screen.findByRole('link', {name: /Καρτέλα (Σετ|εργαλείου)/})).toBeInTheDocument();
    expect(field()).toHaveValue('S000321');
    // Back again: the empty search, where there is nothing to go back to (no «Πίσω»).
    fireEvent.click(screen.getByRole('button', {name: 'Πίσω'}));
    await screen.findByRole('region', {name: 'Κινήθηκαν πρόσφατα'});
    expect(field()).toHaveValue('');
    expect(screen.queryByRole('button', {name: 'Πίσω'})).toBeNull();
  });

  it('a recent search picked again fills the field, even when it is the one in the address', () => {
    renderPage(<TraceabilityPage />, {path: '/traceability'});
    fireEvent.change(field(), {target: {value: 'S000321'}});
    fireEvent.submit(field().closest('form')!);
    fireEvent.change(field(), {target: {value: ''}});
    fireEvent.click(screen.getByRole('button', {name: 'S000321'}));
    expect(field()).toHaveValue('S000321');
  });
});
