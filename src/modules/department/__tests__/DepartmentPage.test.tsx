import {screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {renderPage} from '../../../test/renderPage';
import DepartmentPage from '../DepartmentPage';

const department = {
  id: 'u-or',
  name: 'Νοσηλεύτρια Χειρουργείου',
  role: 'DEPARTMENT' as const,
  department: 'Χειρουργείο',
};

describe('Department page', () => {
  it('shows only the Sets at /department, without a Sets / instruments switch', () => {
    renderPage(<DepartmentPage />, {path: '/department', signedIn: department});
    expect(screen.getByText('ΣΕΤ ΕΡΓΑΛΕΙΩΝ')).toBeInTheDocument();
    expect(document.querySelector('.department-category-tabs')).toBeNull();
  });

  it('shows the standalone instruments at /department/tools', () => {
    renderPage(<DepartmentPage />, {path: '/department/tools', signedIn: department});
    expect(screen.getByText('ΜΕΜΟΝΩΜΕΝΑ ΕΡΓΑΛΕΙΑ')).toBeInTheDocument();
  });
});
