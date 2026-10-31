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
    expect(screen.getByRole('tab', {name: /Ασθενής/})).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('ΚΩΔΙΚΟΣ ΑΣΘΕΝΟΥΣ')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: /Όλοι οι ασθενείς/}));
    expect(screen.getByRole('region', {name: 'Καταγραφές με κωδικό ασθενούς'})).toBeInTheDocument();
  });

  it('offers the download on one patient’s page and on a Set’s trail, next to its list', () => {
    renderPage(<TraceabilityPage />, {path: '/traceability?tab=patients&patient=PT-2026-0041'});
    expect(screen.getByText('ΚΩΔΙΚΟΣ ΑΣΘΕΝΟΥΣ')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /Λήψη/})).toBeInTheDocument();
  });

  it('lists a Set’s moves as a table with the download beside the search', () => {
    renderPage(<TraceabilityPage />, {path: '/traceability?q=S000329'});
    expect(document.querySelectorAll('.trace-ledger .ledger-row').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', {name: /Λήψη/})).toBeInTheDocument();
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
