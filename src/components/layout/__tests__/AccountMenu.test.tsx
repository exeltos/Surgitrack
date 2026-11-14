import {describe, expect, it, vi} from 'vitest';
import {fireEvent, screen, within} from '@testing-library/react';
import {renderPage} from '../../../test/renderPage';
import AppShell from '../AppShell';
import type {SessionUser} from '../../../store/types';

const page = (onLogout: () => void) => (
  <AppShell onLogout={onLogout}>
    <p>Σελίδα</p>
  </AppShell>
);

describe('the account menu (the initials)', () => {
  it('holds the only «Αποσύνδεση»: no second sign-out button beside it', async () => {
    const onLogout = vi.fn();
    const admin: SessionUser = {id: 'u-admin', name: 'Μαρία Παπαδάκη', role: 'ADMIN', department: ''};
    renderPage(page(onLogout), {path: '/issues', signedIn: admin, demo: true});
    expect(screen.queryByRole('button', {name: 'Αποσύνδεση'})).toBeNull();
    fireEvent.click(await screen.findByRole('button', {name: 'Ο λογαριασμός μου'}));
    const menu = screen.getByRole('menu');
    expect(within(menu).getByText('Μαρία Παπαδάκη')).toBeInTheDocument();
    fireEvent.click(within(menu).getByRole('menuitem', {name: /Αποσύνδεση/}));
    await vi.waitFor(() => expect(onLogout).toHaveBeenCalled());
  });

  it('names the platform owner in Greek', async () => {
    const owner: SessionUser = {id: 'u-owner', name: 'Platform Admin', role: 'ADMIN', department: 'Platform'};
    renderPage(
      page(() => undefined),
      {path: '/issues', signedIn: owner, demo: true},
    );
    fireEvent.click(await screen.findByRole('button', {name: 'Ο λογαριασμός μου'}));
    const menu = screen.getByRole('menu');
    expect(within(menu).getByText('Διαχειριστής πλατφόρμας')).toBeInTheDocument();
    expect(within(menu).getByText('Πλατφόρμα')).toBeInTheDocument();
    expect(within(menu).queryByText('Platform Admin')).toBeNull();
  });
});
