import {screen, within} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {renderPage} from '../../../test/renderPage';
import {sets, tools} from '../../../data/demo';
import SterileExpiryPage from '../SterileExpiryPage';

describe('SterileExpiryPage for a department', () => {
  it('lists only the department’s own sterile Sets and instruments, without a department column', () => {
    renderPage(<SterileExpiryPage />, {
      path: '/expiry?view=ALL',
      signedIn: {id: 'u-or', name: 'Νοσηλεύτρια Χειρουργείου', role: 'DEPARTMENT', department: 'Χειρουργείο'},
    });
    const list = within(screen.getByLabelText('Λήξεις αποστείρωσης'));
    expect(list.queryByRole('columnheader', {name: /Τμήμα/})).not.toBeInTheDocument();
    const rows = list.getAllByRole('row').slice(1);
    expect(rows.length).toBeGreaterThan(0);
    const own = new Set(
      [...sets, ...tools].filter(asset => asset.department === 'Χειρουργείο').map(asset => asset.barcode),
    );
    for (const row of rows) {
      const barcode = row.textContent?.match(/[ST]\d{6}/)?.[0];
      expect(own.has(barcode || '')).toBe(true);
    }
  });
});
