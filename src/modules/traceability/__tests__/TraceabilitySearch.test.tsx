import {fireEvent, screen, within} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {renderPage} from '../../../test/renderPage';
import TraceabilityPage from '../TraceabilityPage';

const field = () => screen.getByRole('searchbox', {name: 'Barcode (S..., T...) ή όνομα Σετ/εργαλείου'});

describe('TraceabilityPage search', () => {
  it('offers the Sets and instruments a typed name fits, and opens the one picked', () => {
    renderPage(<TraceabilityPage />, {path: '/traceability'});
    fireEvent.change(field(), {target: {value: 'ΟΡΘΟΠΕΔΙΚΟ'}});
    const list = screen.getByRole('listbox', {name: 'Προτάσεις'});
    const first = within(list).getAllByRole('option')[0];
    const barcode = first.querySelector('b')!.textContent!;
    fireEvent.click(within(first).getByRole('button'));
    expect(screen.queryByRole('listbox', {name: 'Προτάσεις'})).not.toBeInTheDocument();
    expect(screen.getByRole('link', {name: /Καρτέλα (Σετ|εργαλείου)/})).toBeInTheDocument();
    expect(document.querySelector('.trace-item-head .mono')?.textContent).toBe(barcode);
  });

  it('offers the items that moved last, as a list, before anything is typed', () => {
    renderPage(<TraceabilityPage />, {path: '/traceability'});
    const recent = screen.getByRole('region', {name: 'Κινήθηκαν πρόσφατα'});
    expect(recent.querySelectorAll('li').length).toBeGreaterThan(0);
    expect(screen.queryByRole('region', {name: 'Ιστορικό'})).toBeNull();
  });

  it('keeps the last searches in the empty field, not in the list', () => {
    renderPage(<TraceabilityPage />, {path: '/traceability'});
    fireEvent.change(field(), {target: {value: 'S000341'}});
    fireEvent.submit(field().closest('form')!);
    fireEvent.change(field(), {target: {value: ''}});
    fireEvent.blur(field());
    expect(screen.queryByRole('list', {name: 'Πρόσφατες αναζητήσεις'})).toBeNull();
    fireEvent.focus(field());
    const menu = screen.getByRole('list', {name: 'Πρόσφατες αναζητήσεις'});
    // Tab from the field to a recent search keeps the menu open.
    const button = within(menu).getByRole('button', {name: /S000341/});
    fireEvent.blur(field(), {relatedTarget: button});
    expect(screen.getByRole('list', {name: 'Πρόσφατες αναζητήσεις'})).toBeInTheDocument();
    fireEvent.click(within(menu).getByRole('button', {name: /S000341/}));
    expect(document.querySelector('.trace-item-head .mono')?.textContent).toBe('S000341');
  });
});
