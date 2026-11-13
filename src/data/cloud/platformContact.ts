import {supabase} from '../../lib/supabase';

/** Who a locked trial hospital contacts (set by the platform owner in Studio → Settings). */
export type PlatformContact = {name?: string; email?: string; phone?: string};

export async function loadPlatformContact(): Promise<PlatformContact> {
  const {data, error} = await supabase
    .from('platform_settings')
    .select('contact_name,contact_email,contact_phone')
    .eq('id', true)
    .maybeSingle();
  if (error || !data) return {};
  return {
    name: data.contact_name || undefined,
    email: data.contact_email || undefined,
    phone: data.contact_phone || undefined,
  };
}

export async function savePlatformContact(contact: PlatformContact) {
  const {error} = await supabase
    .from('platform_settings')
    .update({
      contact_name: contact.name?.trim() || null,
      contact_email: contact.email?.trim() || null,
      contact_phone: contact.phone?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', true);
  if (error) throw error;
}

/** The company on the public first page (www.surgitrack.eu before sign-in), set in Studio → Settings. */
export type PublicContact = {name?: string; email?: string; phone?: string; website?: string};

/** Read by anyone, signed in or not (public_contact() returns only these four). */
export async function loadPublicContact(): Promise<PublicContact> {
  const {data, error} = await supabase.rpc('public_contact');
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) return {};
  return {
    name: row.name || undefined,
    email: row.email || undefined,
    phone: row.phone || undefined,
    website: row.website || undefined,
  };
}

export async function savePublicContact(contact: PublicContact) {
  const {error} = await supabase
    .from('platform_settings')
    .update({
      public_name: contact.name?.trim() || null,
      public_email: contact.email?.trim() || null,
      public_phone: contact.phone?.trim() || null,
      public_website: contact.website?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', true);
  if (error) throw error;
}
