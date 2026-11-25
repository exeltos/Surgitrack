import {fireEvent, screen, within} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {renderPage} from '../../../test/renderPage';
import TraceabilityPage from '../TraceabilityPage';

describe('Ιχνηλάτηση › Φορτίο κλιβάνου', () => {
  it('finds a load by sterilizer and cycle, and shows what it held and where each item is now', () => {
    renderPage(<TraceabilityPage />, {path: '/traceability?tab=load'});
    expect(screen.getByRole('tab', {name: /Φορτίο κλιβάνου/})).toHaveAttribute('aria-selected', 'true');
    fireEvent.change(screen.getByLabelText('Κλίβανος'), {target: {value: 'Κλίβανος Ατμού 01'}});
    fireEvent.change(screen.getByLabelText('Κύκλος'), {target: {value: '2026-0928'}});
    fireEvent.click(screen.getByRole('button', {name: 'Αναζήτηση'}));
    expect(screen.getByRole('heading', {name: /Κλίβανος Ατμού 01 · κύκλος #2026-0928/})).toBeInTheDocument();
    const held = screen.getByRole('region', {name: 'Τι ήταν στο φορτίο'});
    expect(within(held).getAllByRole('row')).toHaveLength(3);
    // A released load can be recalled.
    expect(screen.getByRole('button', {name: /Ανάκληση φορτίου/})).toBeInTheDocument();
  });

  it('narrows the list as the sterilizer is chosen and the number typed', () => {
    renderPage(<TraceabilityPage />, {path: '/traceability?tab=load'});
    const list = () => screen.getByRole('complementary', {name: 'Φορτία'}).querySelectorAll('.trace-loads li');
    const all = list().length;
    fireEvent.change(screen.getByLabelText('Κλίβανος'), {target: {value: 'Κλίβανος Ατμού 01'}});
    expect(list().length).toBeLessThan(all);
    [...list()].forEach(row => expect(row.textContent).toContain('Κλίβανος Ατμού 01'));
    fireEvent.change(screen.getByLabelText('Κύκλος'), {target: {value: '2026-0928'}});
    expect(list()).toHaveLength(1);
    expect(screen.getByText('Βρέθηκαν 1')).toBeInTheDocument();
  });

  it('always shows the six cards, saying what was not recorded', () => {
    renderPage(<TraceabilityPage />, {path: '/traceability?tab=load&load=L-DEMO-0928'});
    expect(document.querySelectorAll('.trace-info > div')).toHaveLength(6);
  });

  it('says so when no such cycle was recorded', () => {
    renderPage(<TraceabilityPage />, {path: '/traceability?tab=load'});
    fireEvent.change(screen.getByLabelText('Κύκλος'), {target: {value: '9999'}});
    fireEvent.click(screen.getByRole('button', {name: 'Αναζήτηση'}));
    expect(screen.getByText(/Δεν βρέθηκε κύκλος 9999/)).toBeInTheDocument();
  });

  it('opens a load from an item’s round', () => {
    renderPage(<TraceabilityPage />, {path: '/traceability?tab=load&load=L-DEMO-0928'});
    const held = screen.getByRole('region', {name: 'Τι ήταν στο φορτίο'});
    fireEvent.click(within(held).getAllByRole('button')[0]);
    // The item's trail, with the load among its cycles.
    // The item in the card beside the list, with the tabs above.
    expect(screen.getByRole('tablist', {name: 'Τι ψάχνετε'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: /Καρτέλα (Σετ|εργαλείου)/})).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', {name: 'Φορτίο'})[0]);
    expect(screen.getByRole('heading', {name: /κύκλος #/})).toBeInTheDocument();
  });

  it('for a load not released, says what became of each item: its next cycle, or none yet', () => {
    renderPage(<TraceabilityPage />, {path: '/traceability?tab=load&load=L-DEMO-0911'});
    const held = screen.getByRole('region', {name: 'Τι ήταν στο φορτίο'});
    expect(within(held).getByRole('columnheader', {name: 'Επόμενος κύκλος'})).toBeInTheDocument();
    expect(document.querySelector('.trace-after')).not.toBeNull();
  });

  it('shows no next cycle for a released load', () => {
    renderPage(<TraceabilityPage />, {path: '/traceability?tab=load&load=L-DEMO-0928'});
    const held = screen.getByRole('region', {name: 'Τι ήταν στο φορτίο'});
    expect(within(held).queryByRole('columnheader', {name: 'Επόμενος κύκλος'})).toBeNull();
  });
});
