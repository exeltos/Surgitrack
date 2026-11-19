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
  it('shows «Σήμερα», the limited-use equipment and the most frequent uses', () => {
    renderPage(<DepartmentHomePage />, {path: '/department/home', signedIn: department});
    expect(screen.getByRole('heading', {name: 'Χειρουργείο'})).toBeInTheDocument();

    // «Σήμερα», as on the Overview: what to pick up, what expires, the open issues — each opening its list.
    for (const label of ['Για παραλαβή', 'Λήγουν σύντομα', 'Εκκρεμότητες'])
      expect(screen.getByRole('link', {name: new RegExp(`^${label}: \\d+$`)})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: /^Εκκρεμότητες: /})).toHaveAttribute(
      'href',
      expect.stringContaining('/issues?'),
    );
    // The most frequent uses, the busiest first.
    const used = within(screen.getByRole('list', {name: 'Συχνότερες χρήσεις'}))
      .getAllByRole('listitem')
      .map(li => Number(li.querySelector('b')?.textContent));
    expect(used).toEqual([...used].sort((a, b) => b - a));

    // Its limited-use Sets and instruments near their end (3 uses left or fewer), the fewest left first.
    const left = within(screen.getByRole('list', {name: 'Κοντά στο όριο'}))
      .getAllByRole('listitem')
      .map(li => Number(/απομένουν (\d+)/.exec(li.textContent || '')?.[1] ?? 0));
    expect(left.length).toBeGreaterThan(0);
    expect(left.every(n => n <= 3)).toBe(true);
    expect(left).toEqual([...left].sort((a, b) => a - b));
    // And the uses of those only counted.
    expect(screen.getByRole('list', {name: 'Καταμέτρηση χρήσεων'})).toBeInTheDocument();
    // With those, no table of kinds.
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('without limited-use equipment, shows its equipment one line per kind', () => {
    renderPage(<DepartmentHomePage />, {path: '/department/home', signedIn: {...department, department: 'Κανένα'}});
    expect(screen.queryByRole('list', {name: 'Κοντά στο όριο'})).toBeNull();
    expect(screen.getByText('Το τμήμα δεν έχει ακόμα εξοπλισμό.')).toBeInTheDocument();
  });
});
