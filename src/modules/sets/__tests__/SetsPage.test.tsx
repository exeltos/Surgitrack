import {fireEvent, screen, within} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {renderPage} from '../../../test/renderPage';
import SetsPage from '../SetsPage';

const list = () => screen.getByRole('region', {name: 'Λίστα Σετ εργαλείων'});
const rows = () => within(list()).queryAllByRole('row').slice(1);
const kpi = (label: string) => screen.getByRole('button', {name: new RegExp(`^${label} \\d+$`)});
const kpiValue = (label: string) => Number(kpi(label).textContent!.replace(/\D+/g, ' ').trim().split(' ').pop());
const cells = (label: string) => {
  const headers = within(list())
    .getAllByRole('columnheader')
    .map(h => h.textContent?.trim());
  const index = headers.findIndex(h => h === label);
  expect(index).toBeGreaterThanOrEqual(0);
  return rows().map(row => within(row).getAllByRole('cell')[index].textContent?.trim());
};

describe('Sets', () => {
  it('lists every Set, as many as the total says', () => {
    renderPage(<SetsPage />, {path: '/sets'});
    expect(rows().length).toBe(kpiValue('Όλα'));
    expect(rows().length).toBeGreaterThan(0);
  });

  it('finds a Set by barcode', () => {
    renderPage(<SetsPage />, {path: '/sets'});
    const barcode = within(rows()[1]).getByRole('link', {name: /^S\d+$/}).textContent!;
    fireEvent.change(screen.getByPlaceholderText('Όνομα Σετ, κωδικός ή barcode...'), {target: {value: barcode}});
    expect(rows()).toHaveLength(1);
    expect(within(rows()[0]).getByRole('link', {name: barcode})).toBeInTheDocument();
  });

  it('shows what each count names when it is pressed, and everything again under «Όλα»', () => {
    renderPage(<SetsPage />, {path: '/sets'});
    const all = rows().length;
    for (const [label, state] of [
      ['Στο τμήμα', 'Στο τμήμα'],
      ['Έτοιμα για παραλαβή', 'Έτοιμο για παραλαβή'],
    ]) {
      const expected = kpiValue(label);
      fireEvent.click(kpi(label));
      expect(kpi(label)).toHaveAttribute('aria-pressed', 'true');
      expect(rows()).toHaveLength(expected);
      expect(new Set(cells('Κατάσταση'))).toEqual(new Set([state]));
      fireEvent.click(kpi('Όλα'));
      expect(kpi('Όλα')).toHaveAttribute('aria-pressed', 'true');
      expect(rows()).toHaveLength(all);
    }
  });

  it('shows only Sets with missing instruments under «Με έλλειψη»', () => {
    renderPage(<SetsPage />, {path: '/sets'});
    fireEvent.click(kpi('Με έλλειψη'));
    expect(rows()).toHaveLength(kpiValue('Με έλλειψη'));
    for (const text of cells('Εργαλεία')) {
      const [actual, expected] = text!.split('/').map(n => Number(n.trim()));
      expect(actual).toBeLessThan(expected);
    }
  });

  it('says so when nothing matches', () => {
    renderPage(<SetsPage />, {path: '/sets'});
    fireEvent.change(screen.getByPlaceholderText('Όνομα Σετ, κωδικός ή barcode...'), {
      target: {value: 'ΔΕΝ-ΥΠΑΡΧΕΙ-ΤΕΤΟΙΟ'},
    });
    expect(rows()).toHaveLength(0);
  });
});
