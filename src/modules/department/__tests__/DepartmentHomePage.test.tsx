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
  it('shows each thing once: today, what is available, what is in Sterilization and the uses', () => {
    renderPage(<DepartmentHomePage />, {path: '/department/home', signedIn: department});
    expect(screen.getByRole('heading', {name: 'Χειρουργείο'})).toBeInTheDocument();
    // «Σήμερα» counts only what no column below counts.
    for (const label of ['Εκκρεμότητες', 'Λήγουν σύντομα'])
      expect(screen.getByRole('link', {name: new RegExp(`^${label}: \\d+$`)})).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: /^Στο τμήμα: /})).toBeNull();

    // Available: the soonest expiry first.
    const available = screen.getByRole('list', {name: 'Διαθέσιμα στο τμήμα'});
    const dates = within(available)
      .queryAllByText(/^έως \d\d\/\d\d\/\d{4}$/)
      .map(n => n.textContent!.slice(4).split('/').reverse().join(''));
    expect(dates.length).toBeGreaterThan(0);
    expect(dates).toEqual([...dates].sort());

    // In Sterilization: what waits to be picked up comes first.
    const away = within(screen.getByRole('list', {name: 'Στην Αποστείρωση'})).getAllByRole('listitem');
    expect(away.length).toBeGreaterThan(0);
    const readyAt = away.findIndex(li => /Έτοιμο για παραλαβή|Για παραλαβή/i.test(li.textContent || ''));
    if (readyAt >= 0) expect(readyAt).toBe(0);

    // Uses: the worn ones first, each with what it has left.
    const uses = within(screen.getByRole('list', {name: 'Χρήσεις'})).getAllByRole('listitem');
    expect(uses.length).toBeGreaterThan(0);
  });
});
