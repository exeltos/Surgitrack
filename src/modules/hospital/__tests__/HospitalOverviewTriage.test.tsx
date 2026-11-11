import type {ReactNode} from 'react';
import {render, screen, within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach, describe, expect, it} from 'vitest';
import {AppPreferencesProvider} from '../../../core/AppPreferences';
import {LibraryStoreProvider} from '../../../core/LibraryStore';
import {SurgiProvider} from '../../../store/SurgiStore';
import HospitalOverviewPage from '../HospitalOverviewPage';

const Wrapper = ({children}: {children: ReactNode}) => (
  <MemoryRouter>
    <AppPreferencesProvider>
      <LibraryStoreProvider>
        <SurgiProvider dataMode="DEMO">{children}</SurgiProvider>
      </LibraryStoreProvider>
    </AppPreferencesProvider>
  </MemoryRouter>
);

describe('the overview: what needs attention', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem('surgitrack-demo-role', 'ADMIN');
  });

  it('comes first, one row per kind, each opening the list that holds what it counts', () => {
    render(<HospitalOverviewPage />, {wrapper: Wrapper});
    const list = screen.getByRole('list', {name: 'Χρειάζεται προσοχή'});
    const rows = within(list).getAllByRole('link');
    expect(rows.length).toBeGreaterThan(0);
    // The first card of the page.
    expect(list.closest('.dash-grid')?.firstElementChild).toBe(list.closest('section'));
    // Few uses left: the instrument list filtered on «few left»; none left: the one filtered on «finished».
    for (const row of rows) {
      const href = row.getAttribute('href') || '';
      if (/κοντά στο όριο χρήσεων/.test(row.textContent || '')) expect(href).toMatch(/\/(tools|sets)\?.*usage=LOW/);
      if (/εξαντλημένες χρήσεις/.test(row.textContent || '')) expect(href).toMatch(/\/(tools|sets)\?.*usage=EXHAUSTED/);
    }
    expect(
      within(list)
        .getAllByRole('link')
        .some(row => /κοντά στο όριο χρήσεων/.test(row.textContent || '')),
    ).toBe(true);
  });
});
