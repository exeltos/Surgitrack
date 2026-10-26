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
    expect(screen.getByText('ΑΡΧΙΚΗ ΤΜΗΜΑΤΟΣ')).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Χειρουργείο'})).toBeInTheDocument();
    for (const label of ['Σετ', 'Μεμονωμένα', 'Στο τμήμα', 'Για παραλαβή'])
      expect(screen.getByRole('link', {name: new RegExp(`^${label}`)})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: /Στο τμήμα/})).toHaveAttribute(
      'href',
      '/department?preset=1&statusFilter=IN_DEPARTMENT',
    );
    expect(screen.getByRole('list', {name: 'Χρειάζεται προσοχή'})).toBeInTheDocument();
    expect(screen.getByRole('list', {name: 'Τελευταίες κινήσεις'})).toBeInTheDocument();
  });
});
