import {beforeEach, describe, expect, it, vi} from 'vitest';
import {screen} from '@testing-library/react';
import StudioPage from '../StudioPage';
import {renderPage} from '../../../test/renderPage';

const who = vi.hoisted(() => ({owner: false}));
vi.mock('../../../data/cloud/identity', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../data/cloud/identity')>()),
  actingAsPlatformOwner: () => who.owner,
}));

const admin = {id: 'u-admin', name: 'Διαχειριστής', role: 'ADMIN' as const, department: ''};
const tabNames = () => screen.queryAllByRole('tab').map(tab => tab.textContent);

describe('Studio sections of the platform owner', () => {
  beforeEach(() => {
    who.owner = false;
  });

  it('are not in the hospital admin’s tabs, only the libraries are', () => {
    renderPage(<StudioPage />, {path: '/studio', signedIn: admin});
    const names = tabNames().join('|');
    expect(names).toContain('Βιβλιοθήκες');
    for (const hidden of ['Ροή Αποστείρωσης', 'Ρόλοι & δικαιώματα', 'Ρυθμίσεις']) expect(names).not.toContain(hidden);
  });

  it('are not reached by their address: the hospital admin lands on the libraries', () => {
    renderPage(<StudioPage />, {path: '/studio?tab=roles', signedIn: admin});
    expect(screen.queryByText('Τι μπορεί να κάνει κάθε ρόλος στο νοσοκομείο.')).toBeNull();
    expect(screen.getByText('Οι λίστες του νοσοκομείου: ειδικότητες, κατασκευαστές, κλίβανοι και άλλες.')).toBeTruthy();
  });

  it('are the platform owner’s as before', () => {
    who.owner = true;
    renderPage(<StudioPage />, {path: '/studio?tab=roles', signedIn: admin});
    expect(screen.getByText('Τι μπορεί να κάνει κάθε ρόλος στο νοσοκομείο.')).toBeTruthy();
  });
});
