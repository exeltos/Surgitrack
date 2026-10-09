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

/** A notice the platform owner shows to every user until a time (Studio → Settings). */
export type MaintenanceNotice = {message: string; until?: string};

export async function loadMaintenanceNotice(): Promise<MaintenanceNotice | null> {
  const {data, error} = await supabase
    .from('platform_settings')
    .select('maintenance_message,maintenance_until')
    .eq('id', true)
    .maybeSingle();
  if (error || !data?.maintenance_message) return null;
  return {message: data.maintenance_message, until: data.maintenance_until || undefined};
}

/** Whether the notice is still to be shown. */
export const maintenanceActive = (notice: MaintenanceNotice | null, now = Date.now()) =>
  !!notice?.message && (!notice.until || new Date(notice.until).getTime() > now);

export async function saveMaintenanceNotice(notice: MaintenanceNotice | null) {
  const {error} = await supabase
    .from('platform_settings')
    .update({
      maintenance_message: notice?.message.trim() || null,
      maintenance_until: notice?.message.trim() && notice.until ? notice.until : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', true);
  if (error) throw error;
}
