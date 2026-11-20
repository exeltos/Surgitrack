import {fireEvent, screen, within} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {renderPage} from '../../../test/renderPage';
import TraceabilityPage from '../TraceabilityPage';

const uses = () => screen.getByRole('region', {name: 'Καταγραφές με κωδικό ασθενούς'});
/** The patient code of each listed use. */
const codes = () => [...uses().querySelectorAll('.ledger-row mark')].map(mark => mark.textContent);

describe('TraceabilityPage', () => {
  it('lists every use with a patient code, narrows to one patient, and opens that patient’s trace', () => {
    renderPage(<TraceabilityPage />, {path: '/traceability?tab=patients'});
    const everyone = codes();
    expect(everyone.length).toBeGreaterThan(0);
    fireEvent.change(within(uses()).getByPlaceholderText('Κωδικός ασθενούς, π.χ. PT-2026-0041'), {
      target: {value: 'pt-2026-0041'},
    });
    expect(codes().length).toBeGreaterThan(0);
    expect(codes().length).toBeLessThan(everyone.length);
    expect(new Set(codes())).toEqual(new Set(['PT-2026-0041']));
    fireEvent.click(uses().querySelector('.ledger-row')!);
    // Inside the patient: «Πίσω» in place of the tabs.
    expect(screen.getByText('ΚΩΔΙΚΟΣ ΑΣΘΕΝΟΥΣ')).toBeInTheDocument();
    expect(screen.getByRole('tablist', {name: 'Τι ψάχνετε'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Πίσω'}));
    expect(screen.getByRole('region', {name: 'Καταγραφές με κωδικό ασθενούς'})).toBeInTheDocument();
    expect(screen.getByRole('tab', {name: /Ασθενής/})).toHaveAttribute('aria-selected', 'true');
  });

  it('a patient opened directly goes «Πίσω» to the list of patients, not to another tab', () => {
    renderPage(<TraceabilityPage />, {path: '/traceability?tab=patients&patient=PT-2026-0041', browserHistory: true});
    fireEvent.click(screen.getByRole('button', {name: 'Πίσω'}));
    expect(screen.getByRole('tab', {name: /Ασθενής/})).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('region', {name: 'Καταγραφές με κωδικό ασθενούς'})).toBeInTheDocument();
    // Nothing behind it any more: no «Πίσω» that would reopen the patient.
    expect(screen.queryByRole('button', {name: 'Πίσω'})).toBeNull();
  });

  it('shows nothing for an unknown patient code', () => {
    renderPage(<TraceabilityPage />, {path: '/traceability?tab=patients'});
    fireEvent.change(within(uses()).getByPlaceholderText('Κωδικός ασθενούς, π.χ. PT-2026-0041'), {
      target: {value: 'NOBODY-0000'},
    });
    expect(codes()).toEqual([]);
    expect(screen.getByText('Δεν βρέθηκαν καταγραφές με κωδικό ασθενούς')).toBeInTheDocument();
  });
});
