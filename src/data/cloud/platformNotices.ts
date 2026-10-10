import {supabase} from '../../lib/supabase';

/** A notice the platform owner shows to every signed-in user, from a time until a time (Studio → Ειδοποιήσεις). */
export type PlatformNotice = {
  id: string;
  message: string;
  startsAt: string;
  endsAt?: string;
  createdAt: string;
  createdByName?: string;
};
export type NoticeStatus = 'ACTIVE' | 'SCHEDULED' | 'ENDED';

type Row = {
  id: string;
  message: string;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
  created_by_name: string | null;
};
const fromRow = (row: Row): PlatformNotice => ({
  id: row.id,
  message: row.message,
  startsAt: row.starts_at,
  endsAt: row.ends_at || undefined,
  createdAt: row.created_at,
  createdByName: row.created_by_name || undefined,
});

/** Whether a notice shows now, is still to come, or is over. */
export const noticeStatus = (notice: PlatformNotice, now = Date.now()): NoticeStatus =>
  Date.parse(notice.startsAt) > now
    ? 'SCHEDULED'
    : notice.endsAt && Date.parse(notice.endsAt) <= now
      ? 'ENDED'
      : 'ACTIVE';

/** Every notice, newest first (the list in Studio). */
export async function loadNotices(): Promise<PlatformNotice[]> {
  const {data, error} = await supabase
    .from('platform_notices')
    .select('id,message,starts_at,ends_at,created_at,created_by_name')
    .order('starts_at', {ascending: false})
    .limit(200);
  if (error) throw error;
  return (data as Row[]).map(fromRow);
}

/** The notices showing now, for the strip at the top of the app; none when they cannot be read. */
export async function loadActiveNotices(): Promise<PlatformNotice[]> {
  const now = new Date().toISOString();
  const {data, error} = await supabase
    .from('platform_notices')
    .select('id,message,starts_at,ends_at,created_at,created_by_name')
    .lte('starts_at', now)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .order('starts_at', {ascending: false});
  if (error) return [];
  return (data as Row[]).map(fromRow);
}

export async function addNotice(notice: {message: string; startsAt?: string; endsAt?: string; byName: string}) {
  const {error} = await supabase.from('platform_notices').insert({
    message: notice.message.trim(),
    ...(notice.startsAt ? {starts_at: notice.startsAt} : {}),
    ends_at: notice.endsAt || null,
    created_by_name: notice.byName,
  });
  if (error) throw error;
}

/** Ends a notice now (it stays in the list). */
export async function endNotice(id: string) {
  const {error} = await supabase.from('platform_notices').update({ends_at: new Date().toISOString()}).eq('id', id);
  if (error) throw error;
}

export async function deleteNotice(id: string) {
  const {error} = await supabase.from('platform_notices').delete().eq('id', id);
  if (error) throw error;
}
