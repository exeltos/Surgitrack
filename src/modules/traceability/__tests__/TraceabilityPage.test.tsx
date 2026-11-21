import {fireEvent, screen, within} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {renderPage} from '../../../test/renderPage';
import TraceabilityPage from '../TraceabilityPage';

const uses = () => screen.getByRole('region', {name: 'Καταγραφές με κωδικό ασθενούς'});
/** The patient code of each listed patient. */
const codes = () => [...uses().querySelectorAll('.trace-recent-list button mark')].map(mark => mark.textContent);

describe('TraceabilityPage', () => {
  it('lists the patients, narrows to one, and opens its trace beside the list', () => {
    renderPage(<TraceabilityPage />, {path: '/traceability?tab=patients'});
    const everyone = codes();
    expect(everyone.length).toBeGreaterThan(0);
    fireEvent.change(within(uses()).getByPlaceholderText('Κωδικός ασθενούς, π.χ. PT-2026-0041'), {
      target: {value: 'pt-2026-0041'},
    });
    expect(codes().length).toBeGreaterThan(0);
    expect(codes().length).toBeLessThan(everyone.length);
    // One line per patient.
    expect(codes()).toEqual(['PT-2026-0041']);
    fireEvent.click(uses().querySelector('.trace-recent-list button')!);
    // The patient opens beside the list, which stays (marked), with the tabs: no «Πίσω».
    expect(screen.getByText('ΚΩΔΙΚΟΣ ΑΣΘΕΝΟΥΣ')).toBeInTheDocument();
    expect(screen.getByRole('tablist', {name: 'Τι ψάχνετε'})).toBeInTheDocument();
    expect(uses().querySelector('[aria-current="true"]')?.textContent).toContain('PT-2026-0041');
    expect(screen.queryByRole('button', {name: 'Πίσω'})).toBeNull();
  });

  it('a patient opened directly shows the list of patients beside it', () => {
    renderPage(<TraceabilityPage />, {path: '/traceability?tab=patients&patient=PT-2026-0041'});
    expect(screen.getByRole('tab', {name: /Ασθενής/})).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('ΚΩΔΙΚΟΣ ΑΣΘΕΝΟΥΣ')).toBeInTheDocument();
    expect(uses().querySelector('[aria-current="true"]')?.textContent).toContain('PT-2026-0041');
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
