import {screen, within} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {renderPage} from '../../../test/renderPage';
import SterileExpiryPage from '../SterileExpiryPage';

describe('SterileExpiryPage for a department', () => {
  it('lists only the department’s own sterile Sets and instruments', () => {
    renderPage(<SterileExpiryPage />, {
      path: '/expiry?view=ALL',
      signedIn: {id: 'u-or', name: 'Νοσηλεύτρια Χειρουργείου', role: 'DEPARTMENT', department: 'Χειρουργείο'},
    });
    const list = within(screen.getByLabelText('Λήξεις αποστείρωσης'));
    const rows = list.getAllByRole('row').slice(1);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row).toHaveTextContent('Χειρουργείο');
  });
});
