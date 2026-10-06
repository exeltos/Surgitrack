import {render, screen} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {beforeEach, describe, expect, it} from 'vitest';
import {AppPreferencesProvider} from '../../../core/AppPreferences';
import {LibraryStoreProvider} from '../../../core/LibraryStore';
import {SurgiProvider} from '../../../store/SurgiStore';
import ProtectedRoute from '../ProtectedRoute';

const setup = (role: string, path: string) => {
  sessionStorage.setItem('surgitrack-demo-role', role);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppPreferencesProvider>
        <LibraryStoreProvider>
          <SurgiProvider dataMode="DEMO">
            <Routes>
              <Route
                path="/studio"
                element={
                  <ProtectedRoute permission="studio.manage">
                    <p>studio page</p>
                  </ProtectedRoute>
                }
              />
              <Route path="/department" element={<p>department home</p>} />
            </Routes>
          </SurgiProvider>
        </LibraryStoreProvider>
      </AppPreferencesProvider>
    </MemoryRouter>,
  );
};

describe('ProtectedRoute', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('sends a role without the permission to its own home', () => {
    setup('DEPARTMENT', '/studio');
    expect(screen.getByText('department home')).toBeInTheDocument();
    expect(screen.queryByText('studio page')).not.toBeInTheDocument();
  });
});
