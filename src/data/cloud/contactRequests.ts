import {FunctionsHttpError} from '@supabase/supabase-js';
import {supabase} from '../../lib/supabase';

/** What a visitor sends with «Ζητήστε παρουσίαση» on the public first page. */
export type ContactForm = {
  name: string;
  organization: string;
  role: string;
  email: string;
  phone: string;
  message: string;
  /** The hidden field a person leaves empty (bots fill it in). */
  website?: string;
};

/** A request as the platform owner sees it in Studio → Αιτήματα παρουσίασης. */
export type ContactRequest = {
  id: string;
  createdAt: string;
  name: string;
  organization?: string;
  role?: string;
  email: string;
  phone?: string;
  message: string;
  handledAt?: string;
};

export type ContactResult = {ok: true} | {ok: false; reason: 'invalid' | 'too_many' | 'unavailable'};

/** Sends the form to contact-request, which stores it and emails the company. Nobody needs to be signed in. */
export async function sendContactRequest(form: ContactForm): Promise<ContactResult> {
  const {error} = await supabase.functions.invoke('contact-request', {body: form});
  if (!error) return {ok: true};
  const code =
    error instanceof FunctionsHttpError
      ? String((await (error.context as Response).json().catch(() => ({})))?.error || '')
      : '';
  return {ok: false, reason: code === 'invalid' ? 'invalid' : code === 'too_many' ? 'too_many' : 'unavailable'};
}

/** How many requests one page of the Studio list shows. */
export const CONTACT_PAGE = 50;

type Row = {
  id: string;
  created_at: string;
  name: string;
  organization: string | null;
  role: string | null;
  email: string;
  phone: string | null;
  message: string;
  handled_at: string | null;
};
const fromRow = (row: Row): ContactRequest => ({
  id: row.id,
  createdAt: row.created_at,
  name: row.name,
  organization: row.organization || undefined,
  role: row.role || undefined,
  email: row.email,
  phone: row.phone || undefined,
  message: row.message,
  handledAt: row.handled_at || undefined,
});

/**
 * One page of requests, newest first: the new ones only (filtered by the database, so an old unanswered one is
 * never lost behind newer handled ones) or all; `before` continues after the last one shown. The platform owner
 * only: the database shows nobody else any.
 */
export async function loadContactRequests(view: 'NEW' | 'ALL', before?: string): Promise<ContactRequest[]> {
  let query = supabase
    .from('contact_requests')
    .select('id, created_at, name, organization, role, email, phone, message, handled_at')
    .order('created_at', {ascending: false})
    .limit(CONTACT_PAGE);
  if (view === 'NEW') query = query.is('handled_at', null);
  if (before) query = query.lt('created_at', before);
  const {data, error} = await query;
  if (error) throw error;
  return ((data || []) as Row[]).map(fromRow);
}

/** How many requests there are, new and in all. */
export async function countContactRequests(): Promise<{open: number; all: number}> {
  const [open, all] = await Promise.all([
    supabase.from('contact_requests').select('id', {count: 'exact', head: true}).is('handled_at', null),
    supabase.from('contact_requests').select('id', {count: 'exact', head: true}),
  ]);
  if (open.error) throw open.error;
  if (all.error) throw all.error;
  return {open: open.count ?? 0, all: all.count ?? 0};
}

/** Marks a request handled (or not again). */
export async function setContactRequestHandled(id: string, handled: boolean) {
  const {data} = await supabase.auth.getUser();
  const {error} = await supabase
    .from('contact_requests')
    .update({handled_at: handled ? new Date().toISOString() : null, handled_by: handled ? data.user?.id || null : null})
    .eq('id', id);
  if (error) throw error;
}

export async function deleteContactRequest(id: string) {
  const {error} = await supabase.from('contact_requests').delete().eq('id', id);
  if (error) throw error;
}
