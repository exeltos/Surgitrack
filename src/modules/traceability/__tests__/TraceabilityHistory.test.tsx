import {screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {renderPage} from '../../../test/renderPage';
import TraceabilityPage from '../TraceabilityPage';

describe('Traceability › All movements', () => {
  it('shows the hospital history as a tab of Traceability', () => {
    renderPage(<TraceabilityPage />, {path: '/traceability?tab=history'});
    expect(screen.getByRole('tab', {name: /Όλες οι κινήσεις/})).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByText('Αμετάβλητο ιστορικό παραδόσεων, παραλαβών, ελέγχων και μετακινήσεων.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', {level: 1, name: 'Ιχνηλάτηση'})).toBeInTheDocument();
    expect(screen.queryByRole('heading', {level: 1, name: 'Ιστορικό'})).not.toBeInTheDocument();
  });
});
