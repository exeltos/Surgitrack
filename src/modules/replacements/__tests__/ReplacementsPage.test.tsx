import {fireEvent, screen, within} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {renderPage} from '../../../test/renderPage';
import ReplacementsPage from '../ReplacementsPage';

const kpi = (label: string) =>
  screen.getAllByRole('button').find(b => b.closest('.quick-filters') && b.textContent?.startsWith(label))!;
const kpiValue = (label: string) => Number(kpi(label).querySelector('b')!.textContent);
/** The instruments listed on the left, one line each. */
const rows = () => [...document.querySelectorAll<HTMLElement>('.replacements-list li.pickable')];
const card = () => screen.getByRole('region', {name: 'Αντικατάσταση'});

describe('Replacements', () => {
  it('splits what needs replacing into what Stock has and what it lacks', () => {
    renderPage(<ReplacementsPage />, {path: '/replacements'});
    const needed = kpiValue('Προς αντικατάσταση');
    expect(needed).toBeGreaterThan(0);
    expect(kpiValue('Με απόθεμα') + kpiValue('Χωρίς απόθεμα')).toBe(needed);
  });

  it.each([
    ['Προς αντικατάσταση', null],
    ['Με απόθεμα', /^Απόθεμα \d+$/],
    ['Χωρίς απόθεμα', /^Χωρίς απόθεμα$/],
  ] as const)('lists exactly what «%s» counts', (label, stock) => {
    renderPage(<ReplacementsPage />, {path: '/replacements'});
    fireEvent.click(kpi(label));
    expect(kpi(label)).toHaveAttribute('aria-pressed', 'true');
    expect(rows()).toHaveLength(kpiValue(label));
    if (stock) for (const row of rows()) expect(within(row).getByText(stock)).toBeInTheDocument();
  });

  it('replaces an instrument from Stock once confirmed, and only then', () => {
    renderPage(<ReplacementsPage />, {path: '/replacements'});
    fireEvent.click(kpi('Με απόθεμα'));
    const before = kpiValue('Προς αντικατάσταση');
    // The first instrument opens in the card beside the list, with its replacement from Stock.
    fireEvent.click(within(rows()[0]).getByRole('button'));
    fireEvent.click(within(card()).getByRole('button', {name: /Αντικατάσταση από Απόθεμα/}));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Αντικατάσταση από το Απόθεμα;')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Ακύρωση'}));
    expect(kpiValue('Προς αντικατάσταση')).toBe(before);
    fireEvent.click(within(card()).getByRole('button', {name: /Αντικατάσταση από Απόθεμα/}));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', {name: 'Αντικατάσταση'}));
    expect(kpiValue('Προς αντικατάσταση')).toBe(before - 1);
  });
});
