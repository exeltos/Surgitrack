import {supabase} from '../../lib/supabase';

/**
 * A notice the platform owner shows from a time until a time (Studio → Ειδοποιήσεις). A notice is a line at the
 * top of the app; a promotion is a card on the hospital administrator's Overview, with a title and a link. Each is for
 * everyone or only the hospital administrators, in every hospital or in the ones named.
 */
export type NoticeKind = 'NOTICE' | 'PROMO';
export type NoticeAudience = 'ALL' | 'ADMINS';
/** Where the picture of a promotion goes on its card. */
export type ImageLayout = 'TOP' | 'LEFT' | 'RIGHT';
export type PlatformNotice = {
  id: string;
  message: string;
  kind: NoticeKind;
  audience: NoticeAudience;
  title?: string;
  linkUrl?: string;
  linkLabel?: string;
  /** A picture for a promotion (https). */
  imageUrl?: string;
  imageLayout?: ImageLayout;
  /** A file that goes with a promotion (a PDF), and its name. */
  attachmentUrl?: string;
  attachmentName?: string;
  /** The hospitals it is for; none named: every hospital. */
  organizationIds?: string[];
  startsAt: string;
  endsAt?: string;
  createdAt: string;
  createdByName?: string;
};
export type NoticeStatus = 'ACTIVE' | 'SCHEDULED' | 'ENDED';

type Row = {
  id: string;
  message: string;
  kind?: NoticeKind;
  audience?: NoticeAudience;
  title?: string | null;
  link_url?: string | null;
  link_label?: string | null;
  image_url?: string | null;
  image_layout?: ImageLayout | null;
  attachment_url?: string | null;
  attachment_name?: string | null;
  organization_ids?: string[] | null;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
  created_by_name: string | null;
};
const fromRow = (row: Row): PlatformNotice => ({
  id: row.id,
  message: row.message,
  kind: row.kind || 'NOTICE',
  audience: row.audience || 'ALL',
  title: row.title || undefined,
  linkUrl: row.link_url || undefined,
  linkLabel: row.link_label || undefined,
  imageUrl: row.image_url || undefined,
  imageLayout: row.image_layout || undefined,
  attachmentUrl: row.attachment_url || undefined,
  attachmentName: row.attachment_name || undefined,
  organizationIds: row.organization_ids?.length ? row.organization_ids : undefined,
  startsAt: row.starts_at,
  endsAt: row.ends_at || undefined,
  createdAt: row.created_at,
  createdByName: row.created_by_name || undefined,
});

const MID_COLUMNS =
  'id,message,kind,audience,title,link_url,link_label,organization_ids,starts_at,ends_at,created_at,created_by_name';
// With the picture of a promotion (migration notice_image).
const IMAGE_COLUMNS = MID_COLUMNS.replace('link_label,', 'link_label,image_url,');
// Newest: where the picture goes and a file with it (migration promo_layout_and_attachment).
const COLUMNS = IMAGE_COLUMNS.replace('image_url,', 'image_url,image_layout,attachment_url,attachment_name,');
// Before the database has the new columns (migration notice_audience_and_promotions) only the old ones exist.
const OLD_COLUMNS = 'id,message,starts_at,ends_at,created_at,created_by_name';
const MISSING_COLUMN = '42703';

/** Whether a notice shows now, is still to come, or is over. */
export const noticeStatus = (notice: PlatformNotice, now = Date.now()): NoticeStatus =>
  Date.parse(notice.startsAt) > now
    ? 'SCHEDULED'
    : notice.endsAt && Date.parse(notice.endsAt) <= now
      ? 'ENDED'
      : 'ACTIVE';

/** A link the app opens: https only (the database refuses any other). */
export const safeLink = (url?: string) => (url && /^https:\/\/\S+$/i.test(url) ? url : undefined);

/** Every notice, newest first (the list in Studio). */
export async function loadNotices(): Promise<PlatformNotice[]> {
  const read = (columns: string) =>
    supabase.from('platform_notices').select(columns).order('starts_at', {ascending: false}).limit(200);
  let {data, error} = await read(COLUMNS);
  if (error?.code === MISSING_COLUMN) ({data, error} = await read(IMAGE_COLUMNS));
  if (error?.code === MISSING_COLUMN) ({data, error} = await read(MID_COLUMNS));
  if (error?.code === MISSING_COLUMN) ({data, error} = await read(OLD_COLUMNS));
  if (error) throw error;
  return (data as unknown as Row[]).map(fromRow);
}

/**
 * The notices showing now that this person may read (the database narrows them to their hospital and role), of one
 * kind: the notices of the strip at the top of the app, or the promotions of the Overview. None when they cannot be read.
 */
export async function loadActiveNotices(kind: NoticeKind = 'NOTICE'): Promise<PlatformNotice[]> {
  const now = new Date().toISOString();
  const read = (columns: string) =>
    supabase
      .from('platform_notices')
      .select(columns)
      .lte('starts_at', now)
      .or(`ends_at.is.null,ends_at.gt.${now}`)
      .order('starts_at', {ascending: false});
  let {data, error} = await read(COLUMNS);
  if (error?.code === MISSING_COLUMN) ({data, error} = await read(IMAGE_COLUMNS));
  if (error?.code === MISSING_COLUMN) ({data, error} = await read(MID_COLUMNS));
  // An old database has only notices, for everyone.
  if (error?.code === MISSING_COLUMN) {
    ({data, error} = await read(OLD_COLUMNS));
    if (kind === 'PROMO') return [];
  }
  if (error) return [];
  return (data as unknown as Row[]).map(fromRow).filter(notice => notice.kind === kind);
}

export type NewNotice = {
  message: string;
  kind?: NoticeKind;
  audience?: NoticeAudience;
  title?: string;
  linkUrl?: string;
  linkLabel?: string;
  imageUrl?: string;
  imageLayout?: ImageLayout;
  attachmentUrl?: string;
  attachmentName?: string;
  organizationIds?: string[];
  startsAt?: string;
  endsAt?: string;
  byName: string;
};

export async function addNotice(notice: NewNotice) {
  const promo = notice.kind === 'PROMO';
  const {error} = await supabase.from('platform_notices').insert({
    message: notice.message.trim(),
    // The old columns only, when it is a plain notice for everyone: it works before and after the migration.
    ...(promo ||
    notice.audience === 'ADMINS' ||
    notice.organizationIds?.length ||
    notice.title ||
    notice.linkUrl ||
    notice.imageUrl ||
    notice.attachmentUrl
      ? {
          kind: notice.kind || 'NOTICE',
          // A promotion is for the administrators.
          audience: promo ? 'ADMINS' : notice.audience || 'ALL',
          title: notice.title?.trim() || null,
          link_url: safeLink(notice.linkUrl?.trim()) || null,
          link_label: notice.linkUrl?.trim() ? notice.linkLabel?.trim() || null : null,
          ...(notice.imageUrl ? {image_url: safeLink(notice.imageUrl.trim()) || null} : {}),
          ...(notice.imageUrl && notice.imageLayout && notice.imageLayout !== 'TOP'
            ? {image_layout: notice.imageLayout}
            : {}),
          ...(notice.attachmentUrl
            ? {
                attachment_url: safeLink(notice.attachmentUrl.trim()) || null,
                attachment_name: notice.attachmentName?.trim().slice(0, 200) || null,
              }
            : {}),
          organization_ids: notice.organizationIds?.length ? notice.organizationIds : null,
        }
      : {}),
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
