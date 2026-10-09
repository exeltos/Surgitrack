import type {ReactNode} from 'react';
import {render, screen} from '@testing-library/react';
import {HashRouter} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {AppPreferencesProvider} from '../../core/AppPreferences';
import {LibraryStoreProvider} from '../../core/LibraryStore';
import {SurgiProvider, useSurgi} from '../../store/SurgiStore';
import type {RealIdentity} from '../../data/cloud/identity';
import App from '../App';

const identity: RealIdentity = {
  id: 'real-supervisor-7',
  name: 'Μαρία Παπαδοπούλου',
  role: 'STERILIZATION',
  platform: false,
  organizationId: 'org-1',
  departmentName: 'Κεντρική Αποστείρωση',
  supervisor: true,
};

vi.mock('../../lib/supabase', async importOriginal => ({
  ...(await importOriginal<typeof import('../../lib/supabase')>()),
  supabase: {
    auth: {
      getSession: async () => ({data: {session: null}}),
      onAuthStateChange: () => ({data: {subscription: {unsubscribe: () => undefined}}}),
      signOut: async () => ({}),
    },
  },
}));
vi.mock('../../data/cloud/identity', async importOriginal => ({
  ...(await importOriginal<typeof import('../../data/cloud/identity')>()),
  resolveIdentity: async () => ({status: 'ok', identity}),
}));
// The shell only needs to show who the store thinks is signed in.
vi.mock('../../components/layout/AppShell', () => ({
  default: function Shell({children}: {children: ReactNode}) {
    const {currentUser, can} = useSurgi();
    return (
      <>
        <output data-testid="who">{`${currentUser.id} ${currentUser.name}`}</output>
        <output data-testid="can-register">{String(can('asset.create'))}</output>
        {children}
      </>
    );
  },
}));

const renderApp = (dataMode: 'DEMO' | 'PRODUCTION') =>
  render(
    <HashRouter>
      <AppPreferencesProvider>
        <LibraryStoreProvider>
          <SurgiProvider dataMode={dataMode}>
            <App />
          </SurgiProvider>
        </LibraryStoreProvider>
      </AppPreferencesProvider>
    </HashRouter>,
  );

describe('identity on the first load after sign-in', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/nowhere';
  });

  // login() reloads without a stored session user, so the store starts with the default role.
  // The real user has that same role: the store must still switch to them, not keep a demo person.
  it('uses the signed-in user even when their role equals the default role', async () => {
    renderApp('PRODUCTION');
    expect(await screen.findByTestId('who')).toHaveTextContent('real-supervisor-7 Μαρία Παπαδοπούλου');
    expect(screen.getByTestId('who')).not.toHaveTextContent('Demo');
    expect(screen.getByTestId('can-register')).toHaveTextContent('true');
  });

  it('does the same in Demo mode', async () => {
    renderApp('DEMO');
    expect(await screen.findByTestId('who')).toHaveTextContent('real-supervisor-7 Μαρία Παπαδοπούλου');
  });
});
