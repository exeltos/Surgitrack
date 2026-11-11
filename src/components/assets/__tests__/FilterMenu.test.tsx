import {describe, expect, it} from 'vitest';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {AppPreferencesProvider} from '../../../core/AppPreferences';
import FilterMenu from '../FilterMenu';

const filters = [
  {
    key: 'role',
    value: '',
    placeholder: 'Όλοι οι ρόλοι',
    options: [{value: 'ADMIN', label: 'Διαχειριστής'}],
    onChange: () => {},
  },
];

describe('the filters button', () => {
  it('opens a panel that floats over the page, so a card with clipped or scrolling edges cannot cut it off', async () => {
    render(
      <AppPreferencesProvider>
        <div style={{overflow: 'hidden', height: 40}}>
          <FilterMenu filters={filters} />
        </div>
      </AppPreferencesProvider>,
    );
    await userEvent.click(screen.getByRole('button', {name: /Φίλτρα/}));
    const panel = screen.getByRole('dialog', {name: 'Φίλτρα'});
    expect(panel.style.position).toBe('fixed');
    // Escape closes it
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', {name: 'Φίλτρα'})).not.toBeInTheDocument();
  });
});
