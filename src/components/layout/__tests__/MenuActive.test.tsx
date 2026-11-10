import {describe, expect, it} from 'vitest';
import {screen} from '@testing-library/react';
import {renderPage} from '../../../test/renderPage';
import AppShell from '../AppShell';
import type {SessionUser} from '../../../store/types';

const page = () => (
  <AppShell onLogout={() => undefined}>
    <p>Σελίδα</p>
  </AppShell>
);
const admin: SessionUser = {id: 'u-admin', name: 'Δοκιμή', role: 'ADMIN', department: ''};
/** The menu entry that is lit. */
const lit = () => Array.from(document.querySelectorAll('.sidebar .nav-item.active')).map(a => a.textContent);

describe('the menu lights where the user is', () => {
  it('keeps «Αποστείρωση» lit on the stage that is open (?queue=…)', async () => {
    renderPage(page(), {path: '/sterilization?queue=READY', signedIn: admin, demo: true});
    await screen.findByText('Σελίδα');
    expect(lit()).toEqual(['Αποστείρωση']);
  });

  it('keeps «Κλίβανοι & Συσκευές» lit on the page of a piece of equipment (?equipment=…)', async () => {
    renderPage(page(), {path: '/sterilizers?equipment=lib%3ASTERILIZER%3AΚ1', signedIn: admin, demo: true});
    await screen.findByText('Σελίδα');
    expect(lit()).toEqual(['Κλίβανοι & Συσκευές']);
  });
});
