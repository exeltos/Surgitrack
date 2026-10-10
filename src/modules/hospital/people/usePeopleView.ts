import {localizedName} from '../../../core/glossary';
import type {UserRole} from '../../../store/types';
import {STERILIZATION_CODE, SUPERVISOR, roles, roleValue} from '../hospitalPeopleMeta';
import type {Request, Member, Decision} from '../hospitalPeopleMeta';
import type {usePeopleState} from './usePeopleState';
import type {usePeopleData} from './usePeopleData';
import {formatDateTime} from '../../../core/displayDate';

export function usePeopleView(p: ReturnType<typeof usePeopleState> & ReturnType<typeof usePeopleData>) {
  const {decisions, departments, el, filters, invitations, lang, members, query, requests, setDecisions} = p;

  const departmentName = (id: string | null) => localizedName(departments.find(d => d.id === id)?.name || '—', lang);
  /** An invited user who has not accepted yet: the account stays inactive until they do. */
  const invitedAt = (m: Member) => (m.active ? undefined : invitations[m.email.toLowerCase()]);
  const roleLabel = (id: string) => {
    const role = roles.find(r => r.id === id);
    return role ? (el ? role.el : role.en) : id;
  };
  const activeDepartments = departments.filter(d => d.active);
  const pending = requests.filter(r => r.status === 'PENDING');
  // Invitations whose person has not signed up yet.
  const invitedToSignup = requests.filter(r => r.status === 'PENDING_EMAIL' && !r.user_id);
  // A signup's account waits among the requests, not among the users; one whose email is not confirmed
  // yet (signed up through the hospital link) is not shown at all until it is.
  const waitingAccounts = new Set(
    requests
      .filter(r => r.status === 'PENDING' || r.status === 'PENDING_EMAIL')
      .map(r => r.user_id)
      .filter(Boolean),
  );
  const signupFormUrl = (token: string) => `${window.location.origin}/#/join/${token}`;
  const date = (iso: string) => formatDateTime(iso);

  // ---- Signups waiting for approval ----
  const suggestedRole = (departmentId: string | null): UserRole =>
    (departments.find(d => d.id === departmentId)?.code || '').toUpperCase() === STERILIZATION_CODE
      ? 'STERILIZATION'
      : 'DEPARTMENT';
  const decisionFor = (r: Request): Decision =>
    decisions[r.id] || {
      role:
        r.invited_role === 'STERILIZATION' && r.supervisor
          ? SUPERVISOR
          : r.invited_role || suggestedRole(r.department_id),
      departmentId: r.department_id || activeDepartments[0]?.id || '',
      note: '',
    };
  const setDecision = (r: Request, patch: Partial<Decision>) =>
    setDecisions(all => ({...all, [r.id]: {...decisionFor(r), ...patch}}));

  const q = query.trim().toLowerCase();
  const shown = members.filter(
    m =>
      !waitingAccounts.has(m.id) &&
      (!filters.department || m.department_id === filters.department) &&
      (!filters.role || roleValue(m) === filters.role) &&
      (!filters.access ||
        (filters.access === 'INVITED'
          ? invitedAt(m) !== undefined
          : filters.access === 'ACTIVE'
            ? m.active
            : !m.active && invitedAt(m) === undefined)) &&
      (!q ||
        `${m.name} ${m.email} ${m.user_code || ''} ${roleLabel(roleValue(m))} ${departmentName(m.department_id)}`
          .toLowerCase()
          .includes(q)),
  );
  return {
    activeDepartments,
    date,
    decisionFor,
    departmentName,
    invitedAt,
    invitedToSignup,
    pending,
    q,
    roleLabel,
    setDecision,
    shown,
    signupFormUrl,
  };
}
