import {beforeEach, describe, expect, it} from 'vitest';
import {fireEvent, screen} from '@testing-library/react';
import {renderPage} from '../../../test/renderPage';
import AppShell from '../AppShell';
import type {SessionUser} from '../../../store/types';

const page = () => (
  <AppShell onLogout={() => undefined}>
    <p>Σελίδα</p>
  </AppShell>
);
const admin: SessionUser = {id: 'u-admin', name: 'Δοκιμή', role: 'ADMIN', department: ''};
const shell = () => document.querySelector('.app-shell') as HTMLElement;

describe('the menu: open, or a thin rail of icons', () => {
  beforeEach(() => localStorage.clear());

  it('is open at first, and the pin at its top collapses it to the rail and opens it again', async () => {
    renderPage(page(), {path: '/issues', signedIn: admin, demo: true});
    const collapse = await screen.findByRole('button', {name: 'Μάζεμα του μενού'});
    expect(shell()).not.toHaveClass('menu-rail');
    fireEvent.click(collapse);
    expect(shell()).toHaveClass('menu-rail');
    // The rail keeps every entry (as an icon with its name as the tooltip).
    expect(screen.getAllByRole('link', {name: 'Εκκρεμότητες'}).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', {name: 'Καρφίτσωμα του μενού'}));
    expect(shell()).not.toHaveClass('menu-rail');
  });

  it('remembers the choice on this device', async () => {
    renderPage(page(), {path: '/issues', signedIn: admin, demo: true});
    fireEvent.click(await screen.findByRole('button', {name: 'Μάζεμα του μενού'}));
    expect(localStorage.getItem('surgitrack-menu-pinned')).toBe('no');
    fireEvent.click(screen.getByRole('button', {name: 'Καρφίτσωμα του μενού'}));
    expect(localStorage.getItem('surgitrack-menu-pinned')).toBe('yes');
  });
});
