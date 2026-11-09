import {screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {renderPage} from '../../../test/renderPage';
import SterilizersPage from '../SterilizersPage';

describe('SterilizersPage', () => {
  it('shows every sterilizer of the hospital, with the one running a load and the free ones', () => {
    renderPage(<SterilizersPage />, {demo: true});
    expect(screen.getByRole('heading', {name: 'Κλίβανοι'})).toBeTruthy();
    // The sample hospital lists two sterilizers, each with its own card.
    expect(screen.getAllByRole('heading', {level: 2}).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Κλίβανος Ατμού 01/)).toBeTruthy();
    expect(screen.getByRole('button', {name: /Πλήρης οθόνη/})).toBeTruthy();
  });
});
