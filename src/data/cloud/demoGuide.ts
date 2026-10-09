import {supabase} from '../../lib/supabase';
import type {GuideStep} from '../../core/demoGuide';

/** The steps this person has done in this Demo. */
export const loadGuideDone = async (organizationId: string, userId: string) => {
  const {data, error} = await supabase
    .from('demo_guide_progress')
    .select('step_key')
    .eq('organization_id', organizationId)
    .eq('user_id', userId);
  if (error) throw error;
  return new Set((data || []).map(row => (row as {step_key: string}).step_key));
};

/** Notes steps as done (once each). */
export const markGuideSteps = async (organizationId: string, userId: string, keys: string[]) => {
  if (!keys.length) return;
  const {error} = await supabase.from('demo_guide_progress').upsert(
    keys.map(step_key => ({organization_id: organizationId, user_id: userId, step_key})),
    {onConflict: 'organization_id,user_id,step_key', ignoreDuplicates: true},
  );
  if (error) throw error;
};

/** The record steps not done yet that the person has now done: one of their own records exists. */
export const findDoneRecordSteps = async (
  organizationId: string,
  userId: string,
  steps: GuideStep[],
  done: ReadonlySet<string>,
) => {
  const open = steps.filter(s => s.check.kind === 'record' && !done.has(s.key));
  const found = await Promise.all(
    open.map(async step => {
      if (step.check.kind !== 'record') return null;
      const {count, error} = await supabase
        .from(step.check.table)
        .select('id', {count: 'exact', head: true})
        .eq('organization_id', organizationId)
        .eq(step.check.column, userId);
      return !error && (count || 0) > 0 ? step.key : null;
    }),
  );
  return found.filter((key): key is string => !!key);
};
