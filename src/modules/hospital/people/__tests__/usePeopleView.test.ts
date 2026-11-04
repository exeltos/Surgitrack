import {describe, expect, it} from 'vitest';
import {usePeopleView} from '../usePeopleView';

type Input = Parameters<typeof usePeopleView>[0];

const member = (id: string, name: string, active: boolean) => ({
  id,
  name,
  email: `${id}@hospital.gr`,
  user_code: null,
  role: 'DEPARTMENT',
  supervisor: false,
  active,
  department_id: null,
  demo_enabled: false,
});
const request = (id: string, status: string, user_id: string | null) => ({
  id,
  full_name: '',
  email: `${user_id || id}@hospital.gr`,
  status,
  department_id: null,
  requested_at: '2026-10-10T10:00:00Z',
  user_id,
  user_code: null,
  invite_token: null,
  invited_role: null,
  supervisor: false,
  invited_at: null,
});

const useView = (members: unknown[], requests: unknown[], password = '') =>
  usePeopleView({
    decisions: {},
    departments: [],
    el: true,
    invitations: {},
    lang: 'el',
    members,
    query: '',
    filters: {department: '', role: '', access: '', password},
    requests,
    setDecisions: () => undefined,
  } as unknown as Input);

describe('usePeopleView: the users list', () => {
  it('leaves out accounts still waiting: for approval, or for their email to be confirmed', () => {
    const v = useView(
      [
        member('active', 'ACTIVE', true),
        member('approval', 'APPROVAL', false),
        member('unconfirmed', 'UNCONFIRMED', false),
      ],
      [
        request('r1', 'PENDING', 'approval'),
        request('r2', 'PENDING_EMAIL', 'unconfirmed'),
        request('r3', 'PENDING_EMAIL', null),
      ],
    );
    expect(v.shown.map(m => m.id)).toEqual(['active']);
    // Only the approval request is the admin's to decide; the invitation waits for its person.
    expect(v.pending.map(r => r.id)).toEqual(['r1']);
    expect(v.invitedToSignup.map(r => r.id)).toEqual(['r3']);
  });
});

describe('usePeopleView: the password filter', () => {
  const people = [
    {...member('initial', 'INITIAL', true), password_change_required: true},
    {...member('own', 'OWN', true), password_change_required: false},
    {...member('locked', 'LOCKED', false), password_change_required: true},
  ];
  it('finds those who have not changed the initial password, those who have, and those locked', () => {
    expect(useView(people, [], 'INITIAL').shown.map(m => m.id)).toEqual(['initial']);
    expect(useView(people, [], 'OWN').shown.map(m => m.id)).toEqual(['own']);
    expect(useView(people, [], 'LOCKED').shown.map(m => m.id)).toEqual(['locked']);
    expect(useView(people, [], '').shown).toHaveLength(3);
  });
});
