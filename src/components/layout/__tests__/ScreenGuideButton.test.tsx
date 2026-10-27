import {describe, expect, it, vi} from 'vitest';
import {fireEvent, screen} from '@testing-library/react';
import {renderPage} from '../../../test/renderPage';
import AppShell from '../AppShell';
import type {SessionUser} from '../../../store/types';

// Someone signed in to a hospital (without a sign-in the shell is the local owner's).
vi.mock('../../../data/cloud/identity', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../data/cloud/identity')>()),
  actingAsPlatformOwner: () => false,
  getRealIdentity: () => ({
    id: 'real-1',
    name: 'Δοκιμή',
    role: 'ADMIN',
    platform: false,
    organizationId: 'org-1',
    departmentName: '',
  }),
}));

const page = () => (
  <AppShell onLogout={() => undefined}>
    <p>Σελίδα</p>
  </AppShell>
);
const user = (role: SessionUser['role'], department = ''): SessionUser => ({
  id: `u-${role}`,
  name: 'Δοκιμή',
  role,
  department,
});

describe('«Οδηγός οθόνης» in the top bar', () => {
  it('opens the guide of the screen for the hospital admin, and closes it again', async () => {
    renderPage(page(), {path: '/issues', signedIn: user('ADMIN'), demo: true});
    expect(screen.queryByRole('complementary', {name: 'Οδηγός οθόνης'})).toBeNull();
    const button = await screen.findByRole('button', {name: 'Οδηγός οθόνης'});
    fireEvent.click(button);
    expect(screen.getByRole('complementary', {name: 'Οδηγός οθόνης'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Το κατάλαβα'}));
    expect(screen.queryByRole('complementary', {name: 'Οδηγός οθόνης'})).toBeNull();
  });

  it('is there for Sterilization and the departments too', async () => {
    renderPage(page(), {path: '/issues', signedIn: user('STERILIZATION', 'Κεντρική Αποστείρωση'), demo: true});
    expect(await screen.findByRole('button', {name: 'Οδηγός οθόνης'})).toBeInTheDocument();
  });

  it('is not on a screen the manual does not describe', async () => {
    renderPage(page(), {path: '/start', signedIn: user('ADMIN'), demo: true});
    await screen.findByText('Σελίδα');
    expect(screen.queryByRole('button', {name: 'Οδηγός οθόνης'})).toBeNull();
  });
});
