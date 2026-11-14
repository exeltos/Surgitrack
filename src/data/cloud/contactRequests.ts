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

/** The requests, newest first (the platform owner only: the database shows nobody else any). */
export async function loadContactRequests(): Promise<ContactRequest[]> {
  const {data, error} = await supabase
    .from('contact_requests')
    .select('id, created_at, name, organization, role, email, phone, message, handled_at')
    .order('created_at', {ascending: false})
    .limit(200);
  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id,
    createdAt: row.created_at,
    name: row.name,
    organization: row.organization || undefined,
    role: row.role || undefined,
    email: row.email,
    phone: row.phone || undefined,
    message: row.message,
    handledAt: row.handled_at || undefined,
  }));
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
