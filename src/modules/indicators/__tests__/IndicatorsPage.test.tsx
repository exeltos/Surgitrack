import {fireEvent, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {renderPage} from '../../../test/renderPage';
import IndicatorsPage from '../IndicatorsPage';

describe('Indicators', () => {
  it('says each figure once in «Χρήση» when no instrument was used on its own', () => {
    renderPage(<IndicatorsPage />, {path: '/indicators'});
    fireEvent.click(screen.getByRole('tab', {name: /Χρήση/}));
    // Patients, Sets and instruments repeat the uses in the sample (every use a Set, one patient each): a list of uses.
    expect(document.querySelector('.ind-table')).toBeNull();
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
  });
});
