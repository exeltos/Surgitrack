import {describe, expect, it} from 'vitest';
import {screen} from '@testing-library/react';
import StockPage from '../StockPage';
import {ModulesContext} from '../../../data/cloud/modulesContext';
import {renderPage} from '../../../test/renderPage';

const admin = {id: 'u-admin', name: 'Διαχειριστής', role: 'ADMIN' as const, department: ''};

describe('Stock and the Minimum stock module', () => {
  it('has the Minimum stock tab and card in a hospital that was given the module', () => {
    renderPage(
      <ModulesContext.Provider value={['STOCK_MINIMUMS']}>
        <StockPage />
      </ModulesContext.Provider>,
      {path: '/stock', signedIn: admin},
    );
    expect(screen.getByRole('tab', {name: /Ελάχιστα αποθέματα/})).toBeTruthy();
    expect(screen.getByText('Κάτω από το ελάχιστο')).toBeTruthy();
  });

  it('has only the list in one that was not, even by the address of the minimums', () => {
    renderPage(
      <ModulesContext.Provider value={[]}>
        <StockPage />
      </ModulesContext.Provider>,
      {path: '/stock?view=minimums', signedIn: admin},
    );
    expect(screen.queryByRole('tab', {name: /Ελάχιστα αποθέματα/})).toBeNull();
    expect(screen.queryByText('Κάτω από το ελάχιστο')).toBeNull();
    expect(screen.getByText('Εργαλεία Αποθέματος')).toBeTruthy();
  });
});
