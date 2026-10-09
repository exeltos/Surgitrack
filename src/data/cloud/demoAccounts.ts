import {supabase} from '../../lib/supabase';
import type {DemoAccount} from '../../core/demoAccounts';
import {DEMO_PACK_VERSION, seedDemoOrganization} from './demoSeed';
import {guideSteps} from '../../core/demoGuide';
import type {UserRole} from '../../store/types';

type DemoRow = {
  id: string;
  organization_id: string;
  hospital_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  notes: string | null;
  status: 'PREPARING' | 'SENT';
  max_extra_users: number;
  seeded_at: string | null;
  invited_at: string | null;
  evaluator_id: string | null;
  created_at: string;
  organization: {name: string; code: string; active: boolean; trial_ends_at: string | null} | null;
};

type SeedRunRow = {organization_id: string; kind: 'SEED' | 'RESET'; records: number; created_at: string};

/** Every evaluation Demo, newest first, with where its prospect and their colleagues stand. */
export const loadDemoAccounts = async (): Promise<DemoAccount[]> => {
  const {data, error} = await supabase
    .from('demo_accounts')
    .select(
      'id,organization_id,hospital_name,contact_name,contact_email,contact_phone,notes,status,max_extra_users,seeded_at,invited_at,evaluator_id,created_at,organization:organizations(name,code,active,trial_ends_at)',
    )
    .order('created_at', {ascending: false});
  if (error) throw error;
  const rows = (data || []) as unknown as DemoRow[];
  type Person = {id: string; name: string; email: string; role: string; active: boolean; user_code: string | null};
  const people = new Map<string, Person[]>();
  const lastRun = new Map<string, SeedRunRow>();
  /** Guide steps done, by person. */
  const stepsDone = new Map<string, Set<string>>();
  if (rows.length) {
    const {data: progress, error: progressError} = await supabase
      .from('demo_guide_progress')
      .select('user_id,step_key')
      .in(
        'organization_id',
        rows.map(row => row.organization_id),
      );
    if (progressError) throw progressError;
    for (const p of (progress || []) as Array<{user_id: string; step_key: string}>)
      stepsDone.set(p.user_id, (stepsDone.get(p.user_id) || new Set()).add(p.step_key));
    const {data: runs, error: runsError} = await supabase
      .from('demo_seed_runs')
      .select('organization_id,kind,records,created_at')
      .in(
        'organization_id',
        rows.map(row => row.organization_id),
      )
      .order('created_at', {ascending: false});
    if (runsError) throw runsError;
    for (const run of (runs || []) as SeedRunRow[])
      if (!lastRun.has(run.organization_id)) lastRun.set(run.organization_id, run);
    const {data: profiles, error: profilesError} = await supabase
      .from('profiles')
      .select('id,name,email,role,active,user_code,organization_id')
      .in(
        'organization_id',
        rows.map(row => row.organization_id),
      );
    if (profilesError) throw profilesError;
    for (const p of (profiles || []) as Array<Person & {organization_id: string}>) {
      const list = people.get(p.organization_id) || [];
      list.push(p);
      people.set(p.organization_id, list);
    }
  }
  return rows.map(row => {
    const members = people.get(row.organization_id) || [];
    const evaluator = members.find(p => p.id === row.evaluator_id);
    const guide = (p: Person) => {
      const steps = guideSteps(p.role as UserRole);
      const done = stepsDone.get(p.id) || new Set<string>();
      return {done: steps.filter(s => done.has(s.key)).length, total: steps.length};
    };
    return {
      id: row.id,
      organizationId: row.organization_id,
      organizationName: row.organization?.name || row.hospital_name,
      code: row.organization?.code || '',
      hospitalName: row.hospital_name,
      contactName: row.contact_name,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone || undefined,
      notes: row.notes || undefined,
      status: row.status,
      maxExtraUsers: row.max_extra_users,
      endsAt: row.organization?.trial_ends_at || undefined,
      active: row.organization?.active ?? false,
      seededAt: row.seeded_at || undefined,
      invitedAt: row.invited_at || undefined,
      createdAt: row.created_at,
      evaluatorId: row.evaluator_id || undefined,
      evaluatorActive: !!evaluator?.active,
      evaluatorCode: evaluator?.user_code || undefined,
      extraUsers: members.filter(p => p.id !== row.evaluator_id).length,
      colleagues: members
        .filter(p => p.id !== row.evaluator_id)
        .map(p => ({
          id: p.id,
          name: p.name,
          email: p.email,
          role: p.role,
          active: p.active,
          userCode: p.user_code || undefined,
          guide: guide(p),
        })),
      evaluatorGuide: evaluator ? guide(evaluator) : undefined,
      lastLoad: lastRun.get(row.organization_id)
        ? {
            kind: lastRun.get(row.organization_id)!.kind,
            at: lastRun.get(row.organization_id)!.created_at,
            records: lastRun.get(row.organization_id)!.records,
          }
        : undefined,
    };
  });
};

export type NewDemo = {
  hospitalName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  notes?: string;
  endsAt: string;
};

/** Opens the Demo hospital, its departments and its row in one step (still PREPARING). */
export const createDemoAccount = async (demo: NewDemo) => {
  const {data, error} = await supabase.rpc('platform_create_demo_account', {
    p_hospital: demo.hospitalName,
    p_contact_name: demo.contactName,
    p_contact_email: demo.contactEmail,
    p_contact_phone: demo.contactPhone || '',
    p_ends_at: demo.endsAt,
    p_notes: demo.notes || null,
  });
  if (error) throw error;
  return data as {id: string; organization_id: string; code: string};
};

/** Fills the Demo with the sample hospital (dates moved to today) and records the load. */
export const seedDemoAccount = async (
  demo: Pick<DemoAccount, 'id' | 'organizationId'>,
  onProgress?: (done: number, total: number) => void,
  kind: 'SEED' | 'RESET' = 'SEED',
) => {
  const seeded = await seedDemoOrganization(demo.organizationId, {evaluation: true, onProgress});
  const now = new Date().toISOString();
  const {error} = await supabase.from('demo_accounts').update({seeded_at: now, updated_at: now}).eq('id', demo.id);
  if (error) throw error;
  // The record of the load is for the owner's view; a failure here does not undo the Demo.
  await supabase.from('demo_seed_runs').insert({
    organization_id: demo.organizationId,
    kind,
    pack_version: DEMO_PACK_VERSION,
    shifted_days: seeded.shiftedDays,
    records: seeded.records,
  });
};

export type DemoInviteResult = {ok: true; user_code: string; emailed: boolean; url?: string};

/** Sends (or sends again) the prospect's account email; refused until the sample data is in. */
export const sendDemoInvite = async (demoId: string): Promise<DemoInviteResult> => {
  const {data, error} = await supabase.functions.invoke('demo-account', {
    body: {action: 'invite', demo_account_id: demoId, redirect_to: window.location.origin},
  });
  if (error) {
    // The function's own message (e.g. "Sample data not ready") is in the response body.
    const context = (error as {context?: Response}).context;
    const body = context && typeof context.json === 'function' ? await context.json().catch(() => null) : null;
    throw new Error(body?.error || error.message);
  }
  return data as DemoInviteResult;
};

/** A new end date: the database locks the Demo once it passes and reopens it when moved later. */
export const setDemoEnd = async (organizationId: string, endsAt: string) => {
  const {error} = await supabase.from('organizations').update({trial_ends_at: endsAt}).eq('id', organizationId);
  if (error) throw error;
};

/** Wipes the Demo's records and fills it again with the sample hospital (people stay). */
export const resetDemoAccount = async (demo: Pick<DemoAccount, 'id' | 'organizationId'>) => {
  const {error} = await supabase.rpc('platform_reset_demo_organization', {p_org: demo.organizationId});
  if (error) throw error;
  await seedDemoAccount(demo, undefined, 'RESET');
};

/** How many colleagues the prospect may add (the database refuses accounts over it). */
export const setDemoUserLimit = async (demoId: string, limit: number) => {
  const {error} = await supabase
    .from('demo_accounts')
    .update({max_extra_users: limit, updated_at: new Date().toISOString()})
    .eq('id', demoId);
  if (error) throw error;
};
