import {supabase} from '../../lib/supabase';

/** Something a prospect did in their evaluation Demo that the platform owner wants to hear about. */
export type DemoEvent = {
  id: string;
  kind: 'SIGNED_UP' | 'EVALUATED';
  at: string;
  hospitalName: string;
  name: string;
  /** The final evaluation's recommendation, 0-10. */
  nps?: number | null;
};

/**
 * What happened in the evaluation Demos after `since`: who finished signing up (an accepted invitation, or a
 * colleague who confirmed their email on the join page) and who sent the final evaluation. Newest last.
 */
export async function loadDemoEvents(since: string): Promise<DemoEvent[]> {
  const {data: demos, error} = await supabase.from('demo_accounts').select('organization_id,hospital_name');
  if (error) throw error;
  const hospitals = new Map(
    ((demos || []) as Array<{organization_id: string; hospital_name: string}>).map(d => [
      d.organization_id,
      d.hospital_name,
    ]),
  );
  const orgs = [...hospitals.keys()];
  if (!orgs.length) return [];
  const [invitations, joins, evaluations] = await Promise.all([
    supabase
      .from('user_invitations')
      .select('id,organization_id,full_name,accepted_at')
      .in('organization_id', orgs)
      .eq('status', 'ACCEPTED')
      .gt('accepted_at', since),
    supabase
      .from('staff_access_requests')
      .select('id,organization_id,full_name,email_confirmed_at')
      .in('organization_id', orgs)
      .gt('email_confirmed_at', since),
    supabase
      .from('demo_feedback')
      .select('organization_id,user_id,nps,updated_at')
      .in('organization_id', orgs)
      .eq('topic', 'final')
      .gt('updated_at', since),
  ]);
  for (const result of [invitations, joins, evaluations]) if (result.error) throw result.error;
  const evaluated = (evaluations.data || []) as Array<{
    organization_id: string;
    user_id: string;
    nps: number | null;
    updated_at: string;
  }>;
  const names = new Map<string, string>();
  if (evaluated.length) {
    const {data: people, error: peopleError} = await supabase
      .from('profiles')
      .select('id,name')
      .in(
        'id',
        evaluated.map(e => e.user_id),
      );
    if (peopleError) throw peopleError;
    for (const p of (people || []) as Array<{id: string; name: string}>) names.set(p.id, p.name);
  }
  const hospital = (org: string) => hospitals.get(org) || '—';
  const events: DemoEvent[] = [
    ...(
      (invitations.data || []) as Array<{id: string; organization_id: string; full_name: string; accepted_at: string}>
    ).map(i => ({
      id: `invitation:${i.id}`,
      kind: 'SIGNED_UP' as const,
      at: i.accepted_at,
      hospitalName: hospital(i.organization_id),
      name: i.full_name,
    })),
    ...(
      (joins.data || []) as Array<{id: string; organization_id: string; full_name: string; email_confirmed_at: string}>
    ).map(j => ({
      id: `join:${j.id}`,
      kind: 'SIGNED_UP' as const,
      at: j.email_confirmed_at,
      hospitalName: hospital(j.organization_id),
      name: j.full_name,
    })),
    ...evaluated.map(e => ({
      id: `evaluation:${e.organization_id}:${e.user_id}:${e.updated_at}`,
      kind: 'EVALUATED' as const,
      at: e.updated_at,
      hospitalName: hospital(e.organization_id),
      name: names.get(e.user_id) || '—',
      nps: e.nps,
    })),
  ];
  return events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}
