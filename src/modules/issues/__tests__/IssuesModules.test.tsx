import {describe, expect, it} from 'vitest';
import {screen} from '@testing-library/react';
import IssuesPage from '../IssuesPage';
import {ModulesContext} from '../../../data/cloud/modulesContext';
import {renderPage} from '../../../test/renderPage';

const admin = {id: 'u-admin', name: 'Διαχειριστής', role: 'ADMIN' as const, department: ''};

describe('Issues and the Replacements & Orders module', () => {
  it('has the Replacements & Orders tab in a hospital that was given the module', () => {
    renderPage(
      <ModulesContext.Provider value={['REPLACEMENTS']}>
        <IssuesPage />
      </ModulesContext.Provider>,
      {path: '/issues', signedIn: admin},
    );
    expect(screen.getByRole('tab', {name: /αντικαταστάσεις/i})).toBeTruthy();
  });

  it('has only the issues in one that was not, even by the address of the replacements', () => {
    renderPage(
      <ModulesContext.Provider value={[]}>
        <IssuesPage />
      </ModulesContext.Provider>,
      {path: '/issues?tab=replacements', signedIn: admin},
    );
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByText(/αντικαταστάσεις/i)).toBeNull();
  });

  it('shows the replacements and the orders each with its own module', () => {
    const {unmount} = renderPage(
      <ModulesContext.Provider value={['REPLACEMENTS']}>
        <IssuesPage />
      </ModulesContext.Provider>,
      {path: '/issues?tab=orders', signedIn: admin},
    );
    expect(screen.getByRole('tab', {name: /αντικαταστάσεις/i})).toBeTruthy();
    expect(screen.queryByRole('tab', {name: /^Παραγγελίες/})).toBeNull();
    // The orders' address falls back to the issues without the module.
    expect(screen.getByRole('tab', {name: /Προβλήματα/}).getAttribute('aria-selected')).toBe('true');
    unmount();
    renderPage(
      <ModulesContext.Provider value={['ORDERS']}>
        <IssuesPage />
      </ModulesContext.Provider>,
      {path: '/issues', signedIn: admin},
    );
    expect(screen.getByRole('tab', {name: /Παραγγελίες/})).toBeTruthy();
    expect(screen.queryByRole('tab', {name: /αντικαταστάσεις/i})).toBeNull();
  });
});
