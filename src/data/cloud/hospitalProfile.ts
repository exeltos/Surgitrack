import {supabase} from '../../lib/supabase';
import {modulesOf, type HospitalModule} from '../../core/hospitalModules';
import type {Organization} from '../../core/libraryTypes';

/** The open hospital's record as the platform owner sets it (name, code, use, modules). */
export async function loadHospital(id: string): Promise<Organization | undefined> {
  const {data, error} = await supabase
    .from('organizations')
    .select('id,name,code,active,demo_enabled,plan,trial_ends_at,modules')
    .eq('id', id)
    .single();
  if (error || !data) return undefined;
  return {
    id: data.id,
    name: data.name,
    code: data.code || '',
    active: data.active ?? true,
    demoEnabled: !!data.demo_enabled,
    plan: data.plan === 'TRIAL' ? 'TRIAL' : 'STANDARD',
    trialEndsAt: data.trial_ends_at || undefined,
    modules: modulesOf(data.modules),
  };
}

/**
 * Saves what the platform owner changed of a hospital, as Studio → Hospitals does: name and code, standard use or
 * a trial with its end, and its modules (the database lets only the owner). Returns the error, if any.
 */
export async function saveHospital(
  org: Organization,
  data: {name: string; code: string; plan: 'STANDARD' | 'TRIAL'; trialEndsAt?: string; modules: HospitalModule[]},
): Promise<string | undefined> {
  const {error} = await supabase.rpc('platform_update_organization', {
    p_id: org.id,
    p_name: data.name,
    p_code: data.code,
    p_active: org.active,
    p_demo_enabled: org.demoEnabled,
  });
  if (error) return error.message;
  const {error: planError} = await supabase
    .from('organizations')
    .update({plan: data.plan, trial_ends_at: data.plan === 'TRIAL' ? data.trialEndsAt || null : null})
    .eq('id', org.id);
  if (planError) return planError.message;
  const {error: modulesError} = await supabase.from('organizations').update({modules: data.modules}).eq('id', org.id);
  return modulesError?.message;
}
