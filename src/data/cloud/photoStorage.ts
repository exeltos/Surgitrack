import {supabase} from '../../lib/supabase';

/**
 * Photos live in the hospital's private Storage folder; records keep only a small preview and the
 * file's path. Without a cloud workspace (local Demo) or when the upload fails (offline), the
 * downscaled photo stays inside the record instead, as before.
 */
export const PHOTO_BUCKET = 'surgitrack-assets';

let organizationId: string | undefined;

/** Set by the cloud workspace once it knows the hospital it works on (cleared without one). */
export const setPhotoStorageOrganization = (id: string | undefined) => {
  organizationId = id;
};

/** Where a new photo goes: `<hospital>/<folder>/<photo id>.jpg`, or nothing outside a cloud workspace. */
export const photoPath = (folder: 'assets' | 'issues', photoId: string) =>
  organizationId ? `${organizationId}/${folder}/${photoId}.jpg` : undefined;

export async function uploadPhoto(path: string, blob: Blob): Promise<boolean> {
  const {error} = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {contentType: 'image/jpeg'});
  return !error;
}

const signed = new Map<string, {url: string; until: number}>();

/** A link to the full photo, valid for an hour (kept for 50 minutes so it is not refetched each render). */
export async function photoUrl(path: string): Promise<string | undefined> {
  const hit = signed.get(path);
  if (hit && hit.until > Date.now()) return hit.url;
  const {data, error} = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return undefined;
  signed.set(path, {url: data.signedUrl, until: Date.now() + 50 * 60_000});
  return data.signedUrl;
}

/** Removing a photo from a card also removes its file; a failure only leaves an unused file behind. */
export async function removePhotoFile(path: string | undefined) {
  if (!path) return;
  signed.delete(path);
  await supabase.storage
    .from(PHOTO_BUCKET)
    .remove([path])
    .catch(() => undefined);
}
