import {supabase} from '../../lib/supabase';
import type {FinalAnswers} from '../../core/demoFeedback';
import {FINAL_TOPIC} from '../../core/demoFeedback';

export type FeedbackRow = {
  topic: string;
  rating: number | null;
  nps: number | null;
  answers: FinalAnswers;
  comment: string | null;
};

/** This person's ratings and final evaluation in this Demo. */
export const loadMyFeedback = async (organizationId: string, userId: string) => {
  const {data, error} = await supabase
    .from('demo_feedback')
    .select('topic,rating,nps,answers,comment')
    .eq('organization_id', organizationId)
    .eq('user_id', userId);
  if (error) throw error;
  return new Map(((data || []) as FeedbackRow[]).map(row => [row.topic, row]));
};

/** A 1–5 rating of one part of the app or one guide step, with an optional comment (changeable). */
export const rateModule = async (
  organizationId: string,
  userId: string,
  topic: string,
  rating: number,
  comment?: string,
) => {
  const {error} = await supabase.from('demo_feedback').upsert(
    {
      organization_id: organizationId,
      user_id: userId,
      topic,
      rating,
      ...(comment === undefined ? {} : {comment: comment.trim().slice(0, 2000) || null}),
      updated_at: new Date().toISOString(),
    },
    {onConflict: 'organization_id,user_id,topic'},
  );
  if (error) throw error;
};

/** The final evaluation (changeable). */
export const saveFinalEvaluation = async (
  organizationId: string,
  userId: string,
  evaluation: {nps: number; answers: FinalAnswers; comment?: string},
) => {
  const {error} = await supabase.from('demo_feedback').upsert(
    {
      organization_id: organizationId,
      user_id: userId,
      topic: FINAL_TOPIC,
      nps: evaluation.nps,
      answers: evaluation.answers,
      comment: evaluation.comment || null,
      updated_at: new Date().toISOString(),
    },
    {onConflict: 'organization_id,user_id,topic'},
  );
  if (error) throw error;
};

export type DemoRequestKind = 'PURCHASE' | 'EXTENSION';

/** "I want the application" or "I need more time": recorded, then the owner is emailed. */
export const sendDemoRequest = async (
  organizationId: string,
  userId: string,
  request: {kind: DemoRequestKind; contactName?: string; phone?: string; message?: string},
) => {
  const {data, error} = await supabase
    .from('demo_requests')
    .insert({
      organization_id: organizationId,
      user_id: userId,
      kind: request.kind,
      contact_name: request.contactName || null,
      phone: request.phone || null,
      message: request.message || null,
    })
    .select('id')
    .single();
  if (error) throw error;
  // The email to the owner is a courtesy: the request is in Studio either way.
  await supabase.functions
    .invoke('demo-account', {body: {action: 'notify_request', request_id: (data as {id: string}).id}})
    .catch(() => undefined);
};
