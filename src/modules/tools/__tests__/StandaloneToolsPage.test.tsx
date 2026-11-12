import {describe, expect, it} from 'vitest';
import {fireEvent, screen} from '@testing-library/react';
import StandaloneToolsPage from '../StandaloneToolsPage';
import {renderPage} from '../../../test/renderPage';

/** A quick filter next to the search, by its label, and the count it shows. */
const card = (label: string) =>
  [...document.querySelectorAll<HTMLElement>('.quick-filters button')].find(b => b.textContent?.startsWith(label))!;
const value = (label: string) => Number(card(label).querySelector('b')!.textContent);

describe('the individual instruments in use', () => {
  it('counts the cards above the list for what the department chosen leaves, and says what each counts', () => {
    renderPage(<StandaloneToolsPage />);
    const all = value('Όλα');
    const limitedAll = value('Με όριο χρήσεων');
    expect(all).toBeGreaterThan(0);
    // Pick the first department the list offers.
    const departmentFilter = screen.getByRole('button', {name: /Φίλτρα/});
    fireEvent.click(departmentFilter);
    const select = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    const option = [...select.options].find(o => o.value)!;
    fireEvent.change(select, {target: {value: option.value}});
    expect(value('Όλα')).toBeLessThanOrEqual(all);
    expect(value('Με όριο χρήσεων')).toBeLessThanOrEqual(limitedAll);
    expect(card('Με όριο χρήσεων').getAttribute('title')).toMatch(/μέγιστο αριθμό αποστειρώσεων/);
  });

  it('has a new-instruments card and a way to download the list', () => {
    renderPage(<StandaloneToolsPage />);
    expect(card('Αχρησιμοποίητα')).toBeInTheDocument();
    expect(card('Αχρησιμοποίητα').getAttribute('title')).toMatch(/αρχικός αριθμός χρήσεων/);
    expect(screen.getByRole('button', {name: /Λήψη/})).toBeInTheDocument();
  });

  it('groups the pieces by kind with the button, and takes the list both itemised and grouped', () => {
    renderPage(<StandaloneToolsPage />);
    const rowsBefore = document.querySelectorAll('tbody tr').length;
    const toggle = screen.getByRole('button', {name: /Ομαδοποίηση/});
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelectorAll('tbody tr').length).toBeLessThanOrEqual(rowsBefore);
    fireEvent.click(screen.getByRole('button', {name: /Λήψη/}));
    expect(screen.getByRole('menuitem', {name: /Excel \(\.xlsx\) · ομαδοποιημένα/})).toBeInTheDocument();
    expect(screen.getByRole('menuitem', {name: /Excel \(\.xlsx\) · αναλυτικά/})).toBeInTheDocument();
  });
});
