import {describe, expect, it} from 'vitest';
import {fireEvent, screen, within} from '@testing-library/react';
import IssuesPage from '../IssuesPage';
import {ModulesContext} from '../../../data/cloud/modulesContext';
import {renderPage} from '../../../test/renderPage';

const admin = {id: 'u-admin', name: 'Διαχειριστής', role: 'ADMIN' as const, department: ''};

describe('«Εκκρεμότητες»: the instruments out of order above the tabs', () => {
  it('counts them by reason, and a figure opens the instruments to replace for that reason', async () => {
    renderPage(
      <ModulesContext.Provider value={['REPLACEMENTS']}>
        <IssuesPage />
      </ModulesContext.Provider>,
      {path: '/issues', signedIn: admin},
    );
    const figures = screen.getByRole('list', {name: 'Εξοπλισμός με πρόβλημα'});
    for (const label of ['Βλάβη / φθορά', 'Service', 'Απώλεια', 'Εκτός χρήσης', 'Κοντά στο όριο χρήσεων'])
      expect(within(figures).getByText(label)).toBeInTheDocument();
    fireEvent.click(within(figures).getByRole('button', {name: /^Απώλεια/}));
    expect(await screen.findByRole('tab', {name: /Αντικαταστάσεις/, selected: true})).toBeInTheDocument();
    expect(within(figures).getByRole('button', {name: /^Απώλεια/})).toHaveAttribute('aria-pressed', 'true');
    const rows = await screen.findAllByRole('row');
    // Only the lost instruments: every listed row says why.
    const reasons = rows.slice(1).map(r => r.textContent || '');
    expect(reasons.length).toBeGreaterThan(0);
    expect(reasons.every(t => t.includes('Απώλεια'))).toBe(true);
    // A figure opens what it counts, whatever the list was showing (here the instruments already on order).
    fireEvent.click(screen.getByRole('button', {name: /^Σε παραγγελία/}));
    fireEvent.click(within(figures).getByRole('button', {name: /^Απώλεια/}));
    expect(screen.getByRole('button', {name: /^Προς αντικατάσταση/})).toHaveAttribute('aria-pressed', 'true');
    // The list's own reason filter and the figures stay one: clearing it there unmarks the figure.
    fireEvent.click(within(figures).getByRole('button', {name: /^Service/}));
    expect(within(figures).getByRole('button', {name: /^Service/})).toHaveAttribute('aria-pressed', 'true');
    expect(within(figures).getByRole('button', {name: /^Απώλεια/})).toHaveAttribute('aria-pressed', 'false');
  });
});
