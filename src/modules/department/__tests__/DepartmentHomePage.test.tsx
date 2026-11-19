import {screen, within} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {renderPage} from '../../../test/renderPage';
import DepartmentHomePage from '../DepartmentHomePage';

const department = {
  id: 'u-or',
  name: 'Νοσηλεύτρια Χειρουργείου',
  role: 'DEPARTMENT' as const,
  department: 'Χειρουργείο',
};

describe('Department home', () => {
  it('shows what to do now, then the equipment one line per kind', () => {
    renderPage(<DepartmentHomePage />, {path: '/department/home', signedIn: department});
    expect(screen.getByRole('heading', {name: 'Χειρουργείο'})).toBeInTheDocument();

    // What to do: pick up, expiries, issues — each with its count, opening its list.
    const todo = screen.getByRole('navigation', {name: 'Τι έχω να κάνω'});
    for (const label of ['Παραλαβή', 'Λήξεις', 'Εκκρεμότητες'])
      expect(within(todo).getByRole('link', {name: new RegExp(`^\\d+\\s*${label}`)})).toBeInTheDocument();
    expect(within(todo).getByRole('link', {name: /Εκκρεμότητες/})).toHaveAttribute(
      'href',
      expect.stringContaining('/issues?'),
    );

    // The equipment: one line per kind, Sets then standalone instruments, each line's counts adding up.
    const table = screen.getByRole('table');
    const groups = within(table)
      .getAllByRole('rowheader')
      .filter(h => h.getAttribute('scope') === 'rowgroup')
      .map(h => h.textContent);
    expect(groups[0]).toMatch(/^Σετ/);
    const rows = within(table)
      .getAllByRole('row')
      .filter(r => within(r).queryAllByRole('cell').length === 5);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const [here, away, total] = within(row)
        .getAllByRole('cell')
        .slice(0, 3)
        .map(c => Number.parseInt(c.textContent || '0', 10) || 0);
      expect(here + away).toBeLessThanOrEqual(total);
    }
    // A kind opens the list of its units.
    const first = within(rows[0]).getAllByRole('link')[0];
    expect(first.getAttribute('href')).toMatch(/^\/department(\/tools)?\?preset=1&query=/);
  });
});
