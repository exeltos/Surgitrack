import {fireEvent, screen, within} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {renderPage} from '../../../test/renderPage';
import TraceabilityPage from '../TraceabilityPage';

describe('Traceability › All movements', () => {
  it('shows the hospital history as a tab of Traceability', () => {
    renderPage(<TraceabilityPage />, {path: '/traceability?tab=history'});
    expect(screen.getByRole('tab', {name: /Όλες οι κινήσεις/})).toHaveAttribute('aria-selected', 'true');
    // The explanation is the tooltip of «Οι εγγραφές δεν αλλάζουν»; the download sits on the search line.
    expect(screen.getByText('Οι εγγραφές δεν αλλάζουν').closest('small')).toHaveAttribute(
      'title',
      'Αμετάβλητο ιστορικό παραδόσεων, παραλαβών, ελέγχων και μετακινήσεων.',
    );
    // Looked for in the search line only: every row of the list is a button too, and a search over all of them is slow.
    const searchLine = document.querySelector('.movement-filter-bar') as HTMLElement;
    expect(within(searchLine).getByRole('button', {name: /Λήψη/})).toBeInTheDocument();
    expect(screen.getByRole('heading', {level: 1, name: 'Ιχνηλάτηση'})).toBeInTheDocument();
    expect(screen.queryByRole('heading', {level: 1, name: 'Ιστορικό'})).not.toBeInTheDocument();
  });

  it('opens a movement in the search with its barcode', () => {
    renderPage(<TraceabilityPage />, {path: '/traceability?tab=history'});
    const row = document.querySelector('.ledger-row') as HTMLElement;
    fireEvent.click(row);
    fireEvent.click(screen.getByRole('link', {name: /^Ιχνηλάτηση$/}));
    expect(screen.getByRole('tab', {name: /Σετ \/ εργαλείο/})).toHaveAttribute('aria-selected', 'true');
    const box = screen.getByPlaceholderText('Barcode (S..., T...) ή όνομα Σετ/εργαλείου') as HTMLInputElement;
    expect(box.value).toMatch(/^[ST]\d+/);
  });
});
