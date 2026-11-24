import {fireEvent, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {renderPage} from '../../../test/renderPage';
import IndicatorsPage from '../IndicatorsPage';

describe('Indicators', () => {
  it('says each figure once in «Χρήση» when no instrument was used on its own', () => {
    renderPage(<IndicatorsPage />, {path: '/indicators'});
    fireEvent.click(screen.getByRole('tab', {name: /Χρήση/}));
    // Patients, Sets and instruments repeat the uses in the sample (every use a Set, one patient each): a list of uses.
    expect(document.querySelector('table')).toBeNull();
    expect(screen.getByRole('list', {name: 'Ανά τμήμα'})).toBeInTheDocument();
    expect(screen.queryByText('Εργαλεία', {selector: '.ind-fact-label'})).toBeNull();
    expect(screen.queryByRole('heading', {name: 'Εργαλεία που χρησιμοποιήθηκαν περισσότερο'})).toBeNull();
  });

  it('opens the issues and the loads from the quality figures', () => {
    renderPage(<IndicatorsPage />, {path: '/indicators'});
    fireEvent.click(screen.getByRole('tab', {name: /Ποιότητα/}));
    const links = [...document.querySelectorAll('.ind-facts a')].map(a => a.getAttribute('href'));
    expect(links).toContain('/issues');
    expect(links).toContain('/reports?report=loads');
    // Each count against the period before («+6 από 0», «= όπως πριν»).
    const cycles = document.querySelector('.ind-facts a[href="/reports?report=loads"]') as HTMLElement;
    expect(cycles.querySelector('.ind-chip')).not.toBeNull();
    expect(cycles).toHaveTextContent(/από \d+|όπως πριν/);
  });

  it('shows today alone, without an average per day', () => {
    renderPage(<IndicatorsPage />, {path: '/indicators'});
    expect(screen.getByText('Μέσος όρος ανά ημέρα')).toBeInTheDocument();
    const today = screen.getByRole('button', {name: 'Σήμερα'});
    fireEvent.click(today);
    expect(today).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Μέσος όρος ανά ημέρα')).toBeNull();
    expect(screen.getByText('Κινήσεις')).toBeInTheDocument();
  });
});
