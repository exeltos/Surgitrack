import {fireEvent, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {renderPage} from '../../../test/renderPage';
import TraceabilityPage from '../TraceabilityPage';

const field = () => screen.getByRole('searchbox', {name: 'Barcode (S..., T...) ή όνομα Σετ/εργαλείου'});

describe('Ιχνηλάτηση › Σετ / εργαλείο: the list beside the card', () => {
  it('opens a Set in the card beside the list, which stays with its search and tabs', async () => {
    renderPage(<TraceabilityPage />, {path: '/traceability'});
    expect(screen.getByRole('tablist', {name: 'Τι ψάχνετε'})).toBeInTheDocument();
    fireEvent.change(field(), {target: {value: 'S000321'}});
    fireEvent.submit(field().closest('form')!);
    expect(await screen.findByRole('link', {name: /Καρτέλα (Σετ|εργαλείου)/})).toBeInTheDocument();
    // The list and the search stay; no «Πίσω» is needed to pick another.
    expect(screen.getByRole('tablist', {name: 'Τι ψάχνετε'})).toBeInTheDocument();
    expect(field()).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Πίσω'})).toBeNull();
    const list = screen.getByRole('region', {name: 'Κινήθηκαν πρόσφατα'});
    expect(list.querySelector('[aria-current="true"]')?.textContent).toContain('S000321');
  });

  it('picks another item from the list, changing only the card', async () => {
    renderPage(<TraceabilityPage />, {path: '/traceability?q=S000321'});
    const list = screen.getByRole('region', {name: 'Κινήθηκαν πρόσφατα'});
    const other = [...list.querySelectorAll('button')].find(b => !b.textContent?.includes('S000321'))!;
    const code = other.querySelector('.trace-code')!.textContent!.trim();
    fireEvent.click(other);
    expect(await screen.findByRole('link', {name: /Καρτέλα (Σετ|εργαλείου)/})).toBeInTheDocument();
    expect(document.querySelector('.trace-item-head .mono')?.textContent).toBe(code);
    expect(screen.getByRole('region', {name: 'Κινήθηκαν πρόσφατα'})).toBeInTheDocument();
  });
});
