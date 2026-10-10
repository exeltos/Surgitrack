import {fireEvent, screen, within} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {renderPage} from '../../../test/renderPage';
import ReportsPage from '../ReportsPage';

const REPORTS = [
  'Σύνθεση Σετ',
  'Ανά Τμήμα',
  'Ανά Ειδικότητα',
  'Service & Βλάβες',
  'Όρια Χρήσεων',
  'Εργαλεία εκτός χρήσης',
  'Φορτία κλιβάνου',
  'Λήξεις αποστείρωσης',
  'Ιχνηλασιμότητα Ασθενούς',
];

const results = () => screen.getByRole('region', {name: 'Αποτελέσματα'});
/** The "N εγγραφές" next to the results. */
const count = () =>
  Number(/(\d+) εγγραφές/.exec(document.querySelector('.reports-result-head span')!.textContent!)![1]);
const bodyRows = () => within(results()).queryAllByRole('row').slice(1);
const column = (label: string) => {
  const headers = within(results())
    .getAllByRole('columnheader')
    .map(h => h.textContent);
  const index = headers.indexOf(label);
  expect(index).toBeGreaterThanOrEqual(0);
  return bodyRows().map(row => within(row).getAllByRole('cell')[index].textContent);
};
const choose = (report: string) => fireEvent.click(screen.getByRole('button', {name: new RegExp(`^${report}`)}));
const filter = (placeholder: string, value: string) => {
  if (!screen.queryByRole('dialog', {name: 'Φίλτρα'})) fireEvent.click(screen.getByRole('button', {name: /Φίλτρα/}));
  fireEvent.change(screen.getByRole('combobox', {name: placeholder}), {target: {value}});
};

describe('Reports', () => {
  it.each(REPORTS)('opens the report «%s», and its count matches what it lists', report => {
    renderPage(<ReportsPage />);
    choose(report);
    expect(screen.getByRole('heading', {level: 2, name: report})).toBeInTheDocument();
    if (count()) expect(bodyRows().length).toBe(Math.min(count(), bodyRows().length));
    else expect(within(results()).getByText('Δεν υπάρχουν αποτελέσματα')).toBeInTheDocument();
  });

  it('shows the composition of the Set picked', () => {
    renderPage(<ReportsPage />);
    const picker = screen.getByRole('combobox', {name: 'Σετ'}) as HTMLSelectElement;
    const second = picker.options[1];
    fireEvent.change(picker, {target: {value: second.value}});
    const barcode = second.textContent!.split(' · ').pop()!;
    expect(document.querySelector('.reports-result-head strong')!.textContent).toContain(barcode);
    expect(count()).toBe(bodyRows().length);
  });

  it('lists only the department filtered on', () => {
    renderPage(<ReportsPage />);
    choose('Ανά Τμήμα');
    const all = count();
    const department = column('Τμήμα')[0]!;
    filter('Όλα τα τμήματα', department);
    expect(count()).toBeLessThanOrEqual(all);
    expect(new Set(column('Τμήμα'))).toEqual(new Set([department]));
  });

  it('traces by patient code: every coded movement, then only that patient, then nothing for an unknown code', () => {
    renderPage(<ReportsPage />);
    choose('Ιχνηλασιμότητα Ασθενούς');
    const everyone = count();
    expect(everyone).toBeGreaterThan(0);
    const code = screen.getByPlaceholderText('π.χ. PAT-2026-001');
    fireEvent.change(code, {target: {value: 'pt-2026-0041'}});
    expect(count()).toBeGreaterThan(0);
    expect(count()).toBeLessThan(everyone);
    expect(new Set(column('Κωδικός ασθενούς'))).toEqual(new Set(['PT-2026-0041']));
    fireEvent.change(code, {target: {value: 'NOBODY-0000'}});
    expect(count()).toBe(0);
    expect(screen.getByText('Άλλαξε τα φίλτρα ή επίλεξε διαφορετική αναφορά.')).toBeInTheDocument();
  });
});
