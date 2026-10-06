import {localizedName} from '../../../core/glossary';
import type {UserRole} from '../../../store/types';
import {STERILIZATION_CODE, roles, roleValue} from '../hospitalPeopleMeta';
import type {Request, Member, Decision} from '../hospitalPeopleMeta';
import type {usePeopleState} from './usePeopleState';
import type {usePeopleData} from './usePeopleData';

export function usePeopleView(p: ReturnType<typeof usePeopleState> & ReturnType<typeof usePeopleData>) {
  const {decisions, departments, el, invitations, lang, members, query, requests, setDecisions} = p;

  const departmentName = (id: string | null) => localizedName(departments.find(d => d.id === id)?.name || '—', lang);
  /** An invited user who has not accepted yet: the account stays inactive until they do. */
  const invitedAt = (m: Member) => (m.active ? undefined : invitations[m.email.toLowerCase()]);
  const roleLabel = (id: string) => {
    const role = roles.find(r => r.id === id);
    return role ? (el ? role.el : role.en) : id;
  };
  const activeDepartments = departments.filter(d => d.active);
  const pending = requests.filter(r => r.status === 'PENDING');
  // Signup invitations not filled in yet, and (older signups) accounts whose email is not confirmed.
  const invitedToSignup = requests.filter(r => r.status === 'PENDING_EMAIL' && !r.user_id);
  const unconfirmed = requests.filter(r => r.status === 'PENDING_EMAIL' && !!r.user_id);
  const signupFormUrl = (token: string) => `${window.location.origin}/#/join/${token}`;
  const date = (iso: string) =>
    new Date(iso).toLocaleString(el ? 'el-GR' : 'en-GB', {dateStyle: 'medium', timeStyle: 'short'});

  // ---- Signups waiting for approval ----
  const suggestedRole = (departmentId: string | null): UserRole =>
    (departments.find(d => d.id === departmentId)?.code || '').toUpperCase() === STERILIZATION_CODE
      ? 'STERILIZATION'
      : 'DEPARTMENT';
  const decisionFor = (r: Request): Decision =>
    decisions[r.id] || {
      role: r.invited_role || suggestedRole(r.department_id),
      departmentId: r.department_id || activeDepartments[0]?.id || '',
      note: '',
    };
  const setDecision = (r: Request, patch: Partial<Decision>) =>
    setDecisions(all => ({...all, [r.id]: {...decisionFor(r), ...patch}}));

  const q = query.trim().toLowerCase();
  const shown = members.filter(
    m =>
      !q ||
      `${m.name} ${m.email} ${m.user_code || ''} ${roleLabel(roleValue(m))} ${departmentName(m.department_id)}`
        .toLowerCase()
        .includes(q),
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
    unconfirmed,
  };
}
