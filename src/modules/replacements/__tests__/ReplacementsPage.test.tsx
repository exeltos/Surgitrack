import {fireEvent, screen, within} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {renderPage} from '../../../test/renderPage';
import ReplacementsPage from '../ReplacementsPage';

const kpi = (label: string) => screen.getByText(label, {selector: '.replacements-kpis span'}).closest('button')!;
const kpiValue = (label: string) => Number(within(kpi(label)).getByRole('strong', {hidden: true}).textContent);
const table = () => screen.getByRole('table');
const rows = () => within(table()).queryAllByRole('row').slice(1);

describe('Replacements', () => {
  it('splits what needs replacing into what Stock has and what it lacks', () => {
    renderPage(<ReplacementsPage />, {path: '/replacements'});
    const needed = kpiValue('Προς αντικατάσταση');
    expect(needed).toBeGreaterThan(0);
    expect(kpiValue('Με απόθεμα') + kpiValue('Χωρίς απόθεμα')).toBe(needed);
  });

  it.each([
    ['Προς αντικατάσταση', null],
    ['Με απόθεμα', /^Ναι · \d+$/],
    ['Χωρίς απόθεμα', /^Όχι$/],
  ] as const)('lists exactly what «%s» counts', (label, stock) => {
    renderPage(<ReplacementsPage />, {path: '/replacements'});
    fireEvent.click(kpi(label));
    expect(kpi(label)).toHaveClass('active');
    expect(rows()).toHaveLength(kpiValue(label));
    if (stock) for (const row of rows()) expect(within(row).getByText(stock)).toBeInTheDocument();
  });

  it('replaces an instrument from Stock once confirmed, and only then', () => {
    renderPage(<ReplacementsPage />, {path: '/replacements'});
    fireEvent.click(kpi('Με απόθεμα'));
    const before = kpiValue('Προς αντικατάσταση');
    fireEvent.click(within(rows()[0]).getByRole('button', {name: /Αντικατάσταση/}));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Αντικατάσταση από το Απόθεμα;')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Ακύρωση'}));
    expect(kpiValue('Προς αντικατάσταση')).toBe(before);
    fireEvent.click(within(rows()[0]).getByRole('button', {name: /Αντικατάσταση/}));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', {name: 'Αντικατάσταση'}));
    expect(kpiValue('Προς αντικατάσταση')).toBe(before - 1);
  });
});
