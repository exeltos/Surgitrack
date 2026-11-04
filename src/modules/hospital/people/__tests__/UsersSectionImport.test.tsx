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

describe('the password mark on each person', () => {
  const member = (id: string, name: string, extra: Record<string, unknown>) => ({
    id,
    name,
    email: `${id}@x.gr`,
    user_code: id.toUpperCase(),
    role: 'DEPARTMENT',
    supervisor: false,
    active: true,
    department_id: null,
    demo_enabled: false,
    ...extra,
  });
  it('says who still has the initial password (and until when), who set their own, and who was locked', () => {
    const shown = [
      member('a1', 'ΕΛΕΝΗ', {password_change_required: true, password_change_deadline: '2026-11-10T09:00:00Z'}),
      member('b2', 'ΝΙΚΟΣ', {password_change_required: false}),
      member('c3', 'ΜΑΡΙΑ', {
        password_change_required: true,
        password_change_deadline: '2026-10-30T09:00:00Z',
        active: false,
      }),
    ];
    render(
      inApp(
        <UsersSection
          s={people({
            inviteMenu: false,
            shown,
            members: shown,
            me: {id: 'me'},
            invitedAt: () => undefined,
            departmentName: () => '—',
          })}
        />,
      ),
    );
    expect(screen.getByRole('img', {name: /Αρχικός κωδικός · έως 10\/11/})).toBeInTheDocument();
    expect(screen.getByRole('img', {name: 'Προσωπικός κωδικός'})).toBeInTheDocument();
    expect(screen.getByRole('img', {name: /Δεν άλλαξε κωδικό · κλειδώθηκε/})).toBeInTheDocument();
  });
});
