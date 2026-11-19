import {screen} from '@testing-library/react';
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
  it('shows the department at a glance: its counts, what needs attention and its latest movements', () => {
    renderPage(<DepartmentHomePage />, {path: '/department/home', signedIn: department});
    expect(screen.getByText('Αρχική τμήματος')).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Χειρουργείο'})).toBeInTheDocument();
    // Today's figures, each opening its list.
    for (const label of ['Στο τμήμα', 'Σε αποστείρωση', 'Για παραλαβή', 'Εκκρεμότητες'])
      expect(screen.getByRole('link', {name: new RegExp(`^${label}: \\d+$`)})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: /^Στο τμήμα: /})).toHaveAttribute(
      'href',
      '/department?preset=1&statusFilter=IN_DEPARTMENT',
    );
    expect(screen.getByRole('list', {name: 'Χρειάζεται προσοχή'})).toBeInTheDocument();
    expect(screen.getByRole('list', {name: 'Τελευταίες κινήσεις'})).toBeInTheDocument();
    // The most used, Sets and instruments together, the busiest first.
    const used = screen.getByRole('list', {name: 'Πιο πολυχρησιμοποιημένα'});
    const counts = [...used.querySelectorAll('strong')].map(n => Number(n.textContent));
    expect(counts.length).toBeGreaterThan(0);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });
});
