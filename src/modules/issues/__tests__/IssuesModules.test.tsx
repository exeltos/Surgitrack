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
    expect(screen.getByRole('tab', {name: /Αντικαταστάσεις/})).toBeTruthy();
  });

  it('has only the issues in one that was not, even by the address of the replacements', () => {
    renderPage(
      <ModulesContext.Provider value={[]}>
        <IssuesPage />
      </ModulesContext.Provider>,
      {path: '/issues?tab=replacements', signedIn: admin},
    );
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByText(/Αντικαταστάσεις/)).toBeNull();
  });
});
