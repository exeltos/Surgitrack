import {fireEvent, screen, within} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {renderPage} from '../../../test/renderPage';
import TraceabilityPage from '../TraceabilityPage';

const uses = () => screen.getByRole('region', {name: 'Χρήσεις σε ασθενείς'});
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
    expect(screen.getByRole('tab', {name: /Αναζήτηση/})).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('ΚΩΔΙΚΟΣ ΑΣΘΕΝΟΥΣ')).toBeInTheDocument();
  });

  it('shows nothing for an unknown patient code', () => {
    renderPage(<TraceabilityPage />, {path: '/traceability?tab=patients'});
    fireEvent.change(within(uses()).getByPlaceholderText('Κωδικός ασθενούς, π.χ. PT-2026-0041'), {
      target: {value: 'NOBODY-0000'},
    });
    expect(codes()).toEqual([]);
    expect(screen.getByText('Δεν βρέθηκαν χρήσεις σε ασθενείς')).toBeInTheDocument();
  });
});
