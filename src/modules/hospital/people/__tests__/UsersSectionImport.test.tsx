import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {ReactElement} from 'react';
import {AppPreferencesProvider} from '../../../../core/AppPreferences';

vi.mock('../../../../lib/supabase', () => ({supabase: {functions: {invoke: vi.fn()}}}));
const {default: UsersSection} = await import('../UsersSection');
const inApp = (ui: ReactElement) => <AppPreferencesProvider>{ui}</AppPreferencesProvider>;
type Props = Parameters<typeof UsersSection>[0]['s'];

/** The people screen's state, with the menu to add a user open. */
const people = (extra: Record<string, unknown>) =>
  ({
    tab: 'USERS',
    L: (el: string) => el,
    el: true,
    lang: 'el',
    activeDepartments: [],
    departments: [],
    members: [],
    shown: [],
    pending: [],
    invitedToSignup: [],
    filters: {department: '', role: '', access: ''},
    setFilters: () => undefined,
    query: '',
    q: '',
    inviteMenu: true,
    setInviteMenu: () => undefined,
    setDrawer: () => undefined,
    setLinkOpen: () => undefined,
    setQuery: () => undefined,
    demo: false,
    demoSeats: null,
    platform: false,
    organizationId: 'org-1',
    roleLabel: (id: string) => id,
    changed: async () => undefined,
    ...extra,
  }) as unknown as Props;

describe('the entry to the staff import', () => {
  it('is offered to the platform owner, in place of the invitations from a CSV file, and opens the import', () => {
    render(inApp(<UsersSection s={people({platform: true})} />));
    expect(screen.queryByRole('menuitem', {name: /Από αρχείο Excel ή CSV/})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', {name: /Εισαγωγή εργαζομένων/}));
    expect(screen.getByRole('dialog', {name: 'Εισαγωγή εργαζομένων'})).toBeInTheDocument();
  });

  it('is not offered to a hospital admin', () => {
    render(inApp(<UsersSection s={people({platform: false})} />));
    expect(screen.getByRole('menuitem', {name: /Από αρχείο Excel ή CSV/})).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', {name: /Εισαγωγή εργαζομένων/})).not.toBeInTheDocument();
  });

  it('is not offered without a hospital picked, or in a Demo', () => {
    const {rerender} = render(inApp(<UsersSection s={people({platform: true, organizationId: undefined})} />));
    expect(screen.queryByRole('menuitem', {name: /Εισαγωγή εργαζομένων/})).not.toBeInTheDocument();
    rerender(inApp(<UsersSection s={people({platform: true, demo: true})} />));
    expect(screen.queryByRole('menuitem', {name: /Εισαγωγή εργαζομένων/})).not.toBeInTheDocument();
  });
});
