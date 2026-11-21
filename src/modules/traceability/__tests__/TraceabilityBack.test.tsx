import {fireEvent, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {renderPage} from '../../../test/renderPage';
import TraceabilityPage from '../TraceabilityPage';

const field = () => screen.getByRole('searchbox', {name: 'Barcode (S..., T...) ή όνομα Σετ/εργαλείου'});

describe('Ιχνηλάτηση and its «Πίσω»', () => {
  it('opens a Set on a screen of its own (no tabs, no search), and «Πίσω» returns to the tab’s list', async () => {
    renderPage(<TraceabilityPage />, {path: '/traceability'});
    expect(screen.getByRole('tablist', {name: 'Τι ψάχνετε'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Πίσω'})).toBeNull();
    fireEvent.change(field(), {target: {value: 'S000321'}});
    fireEvent.submit(field().closest('form')!);
    expect(await screen.findByRole('link', {name: /Καρτέλα (Σετ|εργαλείου)/})).toBeInTheDocument();
    expect(screen.queryByRole('tablist', {name: 'Τι ψάχνετε'})).toBeNull();
    expect(screen.queryByRole('searchbox')).toBeNull();
    // Into a patient of that Set, then back to the Set, then back to the empty search.
    const patientLink = screen.queryAllByRole('button', {name: /^PT-|^Ασθενής /})[0];
    if (patientLink) {
      fireEvent.click(patientLink);
      expect(await screen.findByText('ΚΩΔΙΚΟΣ ΑΣΘΕΝΟΥΣ')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', {name: 'Πίσω'}));
      expect(await screen.findByRole('link', {name: /Καρτέλα (Σετ|εργαλείου)/})).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole('button', {name: 'Πίσω'}));
    await screen.findByRole('region', {name: 'Κινήθηκαν πρόσφατα'});
    expect(field()).toHaveValue('');
    expect(screen.getByRole('tablist', {name: 'Τι ψάχνετε'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Πίσω'})).toBeNull();
  });

  it('a recent search picked again opens its item again', async () => {
    renderPage(<TraceabilityPage />, {path: '/traceability'});
    fireEvent.change(field(), {target: {value: 'S000321'}});
    fireEvent.submit(field().closest('form')!);
    fireEvent.click(await screen.findByRole('button', {name: 'Πίσω'}));
    fireEvent.click(await screen.findByRole('button', {name: 'S000321'}));
    expect(await screen.findByRole('link', {name: /Καρτέλα (Σετ|εργαλείου)/})).toBeInTheDocument();
  });
});
