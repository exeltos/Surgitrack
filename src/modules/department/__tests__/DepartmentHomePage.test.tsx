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
      .map(li => Number(li.querySelector('strong')?.textContent));
    expect(used).toEqual([...used].sort((a, b) => b - a));

    // Its limited-use Sets and instruments: those alerted near their end first, then the fewest left.
    const lives = within(screen.getByRole('list', {name: 'Όριο χρήσεων'})).getAllByRole('listitem');
    expect(lives.length).toBeGreaterThan(0);
    const firstPlain = lives.findIndex(li => !li.classList.contains('near') && !li.classList.contains('out'));
    if (firstPlain >= 0) expect(lives.slice(firstPlain).every(li => !li.classList.contains('near'))).toBe(true);
    // With those, no table of kinds.
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('without limited-use equipment, shows its equipment one line per kind', () => {
    renderPage(<DepartmentHomePage />, {path: '/department/home', signedIn: {...department, department: 'Κανένα'}});
    expect(screen.queryByRole('list', {name: 'Όριο χρήσεων'})).toBeNull();
    expect(screen.getByText('Το τμήμα δεν έχει ακόμα εξοπλισμό.')).toBeInTheDocument();
  });
});
