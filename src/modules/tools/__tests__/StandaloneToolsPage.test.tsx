import {describe, expect, it} from 'vitest';
import {fireEvent, screen, within} from '@testing-library/react';
import StandaloneToolsPage from '../StandaloneToolsPage';
import {renderPage} from '../../../test/renderPage';

const card = (label: string) => screen.getByText(label, {selector: 'small'}).closest('.kpi-item') as HTMLElement;
const value = (label: string) => Number(within(card(label)).getByText(/^\d+$/).textContent);

describe('the individual instruments in use', () => {
  it('counts the cards above the list for what the department chosen leaves, and says what each counts', () => {
    renderPage(<StandaloneToolsPage />);
    const all = value('Σε χρήση');
    const limitedAll = value('Με όριο χρήσεων');
    expect(all).toBeGreaterThan(0);
    // Pick the first department the list offers.
    const departmentFilter = screen.getByRole('button', {name: /Φίλτρα/});
    fireEvent.click(departmentFilter);
    const select = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    const option = [...select.options].find(o => o.value)!;
    fireEvent.change(select, {target: {value: option.value}});
    expect(value('Σε χρήση')).toBeLessThanOrEqual(all);
    expect(value('Με όριο χρήσεων')).toBeLessThanOrEqual(limitedAll);
    expect(card('Με όριο χρήσεων').getAttribute('title')).toMatch(/μέγιστο αριθμό αποστειρώσεων/);
  });

  it('has a new-instruments card and a way to download the list', () => {
    renderPage(<StandaloneToolsPage />);
    expect(card('Καινούργια')).toBeInTheDocument();
    expect(card('Καινούργια').getAttribute('title')).toMatch(/αρχικός αριθμός χρήσεων/);
    expect(screen.getByRole('button', {name: /Λήψη/})).toBeInTheDocument();
  });
});
