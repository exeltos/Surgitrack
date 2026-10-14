import type {ReactElement} from 'react';
import {render} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {AppPreferencesProvider} from '../core/AppPreferences';
import {LibraryStoreProvider} from '../core/LibraryStore';
import {SurgiProvider} from '../store/SurgiStore';
import {UnsavedChangesProvider} from '../app/UnsavedChanges';
import type {SessionUser} from '../store/types';

/**
 * Each page test starts with nothing remembered: lists keep their search and filters in sessionStorage.
 */
export const forgetPageMemory = () => {
  sessionStorage.clear();
  localStorage.clear();
};

/**
 * Renders a page the way the app does (preferences, libraries, the store), on the Demo sample hospital,
 * at `path` (matched by `route`, for pages that read URL parameters).
 */
export function renderPage(
  page: ReactElement,
  {
    path = '/',
    route = '*',
    signedIn,
    demo,
  }: {
    path?: string;
    route?: string;
    signedIn?: SessionUser;
    /** In the platform's Demo (as entered from Studio). */ demo?: boolean;
  } = {},
) {
  forgetPageMemory();
  if (demo) sessionStorage.setItem('surgitrack-data-mode', 'DEMO');
  // Someone other than the sample hospital's default user (the store reads them from the session).
  if (signedIn) {
    sessionStorage.setItem('surgitrack-demo-role', signedIn.role);
    sessionStorage.setItem('surgitrack-session-user', JSON.stringify(signedIn));
  }
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppPreferencesProvider>
        <LibraryStoreProvider dataMode="DEMO">
          <SurgiProvider dataMode="DEMO">
            <UnsavedChangesProvider>
              <Routes>
                <Route path={route} element={page} />
              </Routes>
            </UnsavedChangesProvider>
          </SurgiProvider>
        </LibraryStoreProvider>
      </AppPreferencesProvider>
    </MemoryRouter>,
  );
}
