import {useCallback, useEffect} from 'react';
import {supabase} from '../../../lib/supabase';
import type {Request, Member} from '../hospitalPeopleMeta';
import type {usePeopleState} from './usePeopleState';

export function usePeopleData(p: ReturnType<typeof usePeopleState>) {
  const {
    demo,
    libs,
    onChanged,
    organizationId,
    refreshKey,
    setDemoSeats,
    setDepartments,
    setInvitations,
    setMembers,
    setNotice,
    setRequests,
  } = p;

  const load = useCallback(async () => {
    if (demo) {
      setDepartments(
        libs.departments.map(d => ({id: d.id, name: d.el, code: d.code || null, active: d.active !== false})),
      );
      setRequests([]);
      setMembers(
        libs.users.map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          user_code: null,
          role: u.role,
          supervisor: u.role === 'STERILIZATION' && !!u.supervisor,
          active: u.active,
          department_id: libs.departments.find(d => d.el === u.department || d.id === u.department)?.id || null,
          demo_enabled: u.demoEnabled,
        })),
      );
      return;
    }
    if (!organizationId) return;
    const [deps, reqs, profiles, invites, demoAccount, seats] = await Promise.all([
      supabase.from('departments').select('id,name,code,active').eq('organization_id', organizationId).order('name'),
      supabase
        .from('staff_access_requests')
        .select(
          'id,full_name,email,status,department_id,requested_at,user_id,user_code,invite_token,invited_role,supervisor,invited_at',
        )
        .eq('organization_id', organizationId)
        .in('status', ['PENDING', 'PENDING_EMAIL'])
        .order('requested_at'),
      supabase
        .from('profiles')
        .select('id,name,email,user_code,role,supervisor,active,department_id,demo_enabled')
        .eq('organization_id', organizationId)
        .order('name'),
      supabase
        .from('user_invitations')
        .select('email,last_sent_at,invited_at')
        .eq('organization_id', organizationId)
        .eq('status', 'SENT'),
      // A prospect's evaluation Demo: how many colleagues it may hold.
      supabase.from('demo_accounts').select('max_extra_users').eq('organization_id', organizationId).maybeSingle(),
      supabase.rpc('demo_seats_left', {p_org: organizationId}),
    ]);
    const limit = (demoAccount.data as {max_extra_users?: number} | null)?.max_extra_users;
    setDemoSeats(
      typeof limit === 'number' && typeof seats.data === 'number' ? {max: limit, left: Math.max(0, seats.data)} : null,
    );
    // Each part shows what it could load. Requests need the departments (the suggested role and the
    // department picker come from them), so without those they are not shown.
    if (deps.data) setDepartments(deps.data);
    setRequests(deps.data && reqs.data ? (reqs.data as Request[]) : []);
    if (profiles.data) setMembers(profiles.data as Member[]);
    const sent = (invites.data || []) as Array<{email: string; last_sent_at: string | null; invited_at: string | null}>;
    setInvitations(Object.fromEntries(sent.map(i => [i.email.toLowerCase(), i.last_sent_at || i.invited_at || ''])));
    const error = deps.error || reqs.error || profiles.error;
    if (error) setNotice({kind: 'error', text: error.message});
  }, [
    organizationId,
    demo,
    libs.departments,
    libs.users,
    setDepartments,
    setRequests,
    setMembers,
    setInvitations,
    setNotice,
    setDemoSeats,
  ]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  /** After a change: this list reloads, and so does whatever shows counts around it. */
  const changed = async () => {
    await load();
    onChanged?.();
  };
  return {changed};
}
