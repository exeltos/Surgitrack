import {fireEvent, screen, within} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {renderPage} from '../../../test/renderPage';
import ReportsPage from '../ReportsPage';
import {reportGroups, reports} from '../reportsMeta';

const REPORTS = [
  'Απογραφή εξοπλισμού',
  'Service & βλάβες',
  'Χρήσεις & αποσύρσεις',
  'Φορτία κλιβάνου',
  'Λήξεις αποστείρωσης',
  'Παραδόσεις & παραλαβές',
];

const results = () => screen.getByRole('region', {name: 'Αποτελέσματα'});
/** The "N εγγραφές" next to the results. */
const count = () =>
  Number(/(\d+) εγγραφές/.exec(document.querySelector('.reports-result-head span')!.textContent!)![1]);
/** A report lists everything at once; a card or a group narrows it, and «Εμφάνιση όλων» brings it all back. */
const bodyRows = () => within(results()).queryAllByRole('row').slice(1);
const column = (label: string) => {
  const headers = within(results())
    .getAllByRole('columnheader')
    .map(h => h.textContent);
  const index = headers.indexOf(label);
  expect(index).toBeGreaterThanOrEqual(0);
  // The "more rows" marker at the end of a long list is a single cell, not a record.
  return bodyRows()
    .map(row => within(row).getAllByRole('cell'))
    .filter(cells => cells.length > index)
    .map(cells => cells[index].textContent);
};
const choose = (report: string) => {
  // A report sits under its category: open the category first.
  const meta = reports.find(r => report.startsWith(r.title))!;
  const category = reportGroups.find(g => g.id === meta.group)!;
  fireEvent.click(screen.getByRole('button', {name: new RegExp(`^${category.title}\\d`)}));
  fireEvent.click(screen.getByRole('button', {name: new RegExp(`^${report}`)}));
};
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

  it('has six reports: Set composition prints from the Set card', () => {
    renderPage(<ReportsPage />);
    // The six reports sit under three categories; each category lists only its own.
    expect(document.querySelectorAll('.reports-category')).toHaveLength(3);
    const total = reportGroups.reduce((n, g) => {
      fireEvent.click(screen.getByRole('button', {name: new RegExp(`^${g.title}\\d`)}));
      return n + document.querySelectorAll('.reports-catalog-item').length;
    }, 0);
    expect(total).toBe(6);
    expect(screen.queryByRole('button', {name: /^Σύνθεση Σετ/})).not.toBeInTheDocument();
  });

  it('groups the inventory by department or by specialty', () => {
    renderPage(<ReportsPage />);
    const headers = () => {
      return within(results())
        .getAllByRole('columnheader')
        .map(h => h.textContent);
    };
    expect(headers()[0]).toBe('Τμήμα');
    filter('Ομαδοποίηση ανά τμήμα', 'specialty');
    expect(headers()[0]).toBe('Ειδικότητα');
    expect(headers()).not.toContain('Τμήμα');
  });

  it('lists the instruments in service and those taken out of service, each from its card', () => {
    renderPage(<ReportsPage />);
    choose('Χρήσεις & αποσύρσεις');
    const card = (name: RegExp) => within(screen.getByRole('list', {name: 'Σύνολα'})).getByRole('button', {name});
    fireEvent.click(card(/Σε χρήση/));
    expect(new Set(column('Κατάσταση'))).toEqual(new Set(['Σε χρήση']));
    fireEvent.click(card(/Εκτός χρήσης/));
    expect(new Set(column('Κατάσταση'))).toEqual(new Set(['Εκτός χρήσης']));
    filter('Σε χρήση & εκτός χρήσης', 'RETIRED');
    expect(new Set(column('Κατάσταση'))).toEqual(new Set(['Εκτός χρήσης']));
  });

  it('lists only the department filtered on', () => {
    renderPage(<ReportsPage />);
    choose('Απογραφή εξοπλισμού');
    const all = count();
    const department = column('Τμήμα')[0]!;
    filter('Όλα τα τμήματα', department);
    expect(count()).toBeLessThanOrEqual(all);
    expect(new Set(column('Τμήμα'))).toEqual(new Set([department]));
  });

  it('has no patient traceability: it lives in Traceability', () => {
    renderPage(<ReportsPage />);
    expect(screen.queryByText('Ιχνηλασιμότητα ασθενούς')).not.toBeInTheDocument();
  });

  it('lists handovers with the other party signature, and filters to the unconfirmed ones', () => {
    renderPage(<ReportsPage />);
    choose('Παραδόσεις & παραλαβές');
    const all = count();
    expect(all).toBeGreaterThan(2);
    const signatures = column('Υπογραφή άλλου μέρους');
    expect(signatures).toContain('Επιβεβαιωμένη');
    expect(signatures).toContain('Μη επιβεβαιωμένη');
    filter('Όλες οι υπογραφές', 'UNVERIFIED');
    expect(count()).toBe(2);
    expect(new Set(column('Υπογραφή άλλου μέρους'))).toEqual(new Set(['Μη επιβεβαιωμένη']));
    expect(new Set(column('Κίνηση'))).toEqual(new Set(['Παραλαβή', 'Παράδοση']));
    for (const cell of within(results()).getAllByText('Μη επιβεβαιωμένη')) expect(cell).toHaveClass('report-cell-warn');
  });

  it('lists everything at once, and a total narrows the list', () => {
    renderPage(<ReportsPage />);
    expect(within(screen.getByRole('list', {name: 'Σύνολα'})).getAllByRole('button').length).toBeGreaterThan(1);
    const everything = bodyRows().length;
    expect(everything).toBeGreaterThan(0);
    fireEvent.click(within(screen.getByRole('list', {name: 'Σύνολα'})).getByRole('button', {name: /Σετ/}));
    expect(new Set(column('Τύπος'))).toEqual(new Set(['Σετ']));
    expect(bodyRows().length).toBeLessThan(everything);
    fireEvent.click(screen.getByRole('button', {name: 'Εμφάνιση όλων'}));
    expect(new Set(column('Τύπος')).size).toBeGreaterThan(1);
    // The split by department is gone: the Filters cover it.
    expect(screen.queryByRole('group', {name: 'Ανά τμήμα'})).not.toBeInTheDocument();
  });
});
