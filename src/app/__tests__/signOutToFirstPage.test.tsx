import {fireEvent, render, screen} from '@testing-library/react';
import {HashRouter} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {AppPreferencesProvider} from '../../core/AppPreferences';
import {LibraryStoreProvider} from '../../core/LibraryStore';
import {SurgiProvider} from '../../store/SurgiStore';
import type {RealIdentity} from '../../data/cloud/identity';
import App from '../App';

const owner: RealIdentity = {
  id: 'owner-1',
  name: 'Platform Admin',
  role: 'ADMIN',
  platform: true,
  organizationId: null,
  departmentName: '',
};

vi.mock('../../lib/supabase', async importOriginal => ({
  ...(await importOriginal<typeof import('../../lib/supabase')>()),
  supabase: {
    auth: {
      getSession: async () => ({data: {session: null}}),
      onAuthStateChange: () => ({data: {subscription: {unsubscribe: () => undefined}}}),
      signOut: async () => ({}),
    },
    rpc: async () => ({data: null, error: null}),
  },
}));
vi.mock('../../data/cloud/identity', async importOriginal => ({
  ...(await importOriginal<typeof import('../../data/cloud/identity')>()),
  resolveIdentity: async () => ({status: 'ok', identity: owner}),
}));
vi.mock('../../data/cloud/platformContact', () => ({loadPublicContact: async () => ({})}));
// The shell only offers the sign-out.
vi.mock('../../components/layout/AppShell', () => ({
  default: function Shell({onLogout}: {onLogout: (direct?: boolean) => void}) {
    return (
      <button type="button" onClick={() => onLogout(true)}>
        Αποσύνδεση
      </button>
    );
  },
}));

describe('after signing out', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/';
  });

  it('shows the sign-in screen with its goodbye, and the brand there leads to the first page', async () => {
    render(
      <HashRouter>
        <AppPreferencesProvider>
          <LibraryStoreProvider>
            <SurgiProvider dataMode="PRODUCTION">
              <App />
            </SurgiProvider>
          </LibraryStoreProvider>
        </AppPreferencesProvider>
      </HashRouter>,
    );
    fireEvent.click(await screen.findByRole('button', {name: 'Αποσύνδεση'}));
    // The platform owner has no first name: a plain goodbye, not «Καλή συνέχεια, Platform.».
    expect(await screen.findByText('Καλή συνέχεια.')).toBeInTheDocument();
    expect(window.location.hash).toBe('#/login');
    fireEvent.click(screen.getAllByRole('link', {name: /SurgiTrack/})[0]);
    expect(await screen.findByRole('heading', {level: 1, name: /Κάθε εργαλείο/})).toBeInTheDocument();
  });
});
