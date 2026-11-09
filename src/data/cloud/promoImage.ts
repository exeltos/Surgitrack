import {downscaleToJpeg} from '../../components/assets/photoUtils';
import {supabase} from '../../lib/supabase';

/** The public bucket of the promotions' pictures: the platform owner writes, every hospital reads. */
export const PROMO_BUCKET = 'promo-images';
/** Longest side of a promotion's picture: it is shown small, on a card. */
const LONGEST = 800;

/** Uploads a picture chosen on the device and returns the https address it can be read from. */
export async function uploadPromoImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('not an image');
  const blob = await downscaleToJpeg(file, LONGEST, 0.85);
  const path = `${crypto.randomUUID()}.jpg`;
  const {error} = await supabase.storage.from(PROMO_BUCKET).upload(path, blob, {contentType: 'image/jpeg'});
  if (error) throw error;
  return supabase.storage.from(PROMO_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** The largest file that goes with a promotion (the bucket refuses more). */
export const PROMO_FILE_MAX = 10 * 1024 * 1024;

/** Uploads a PDF that goes with a promotion and returns the https address it opens from. */
export async function uploadPromoFile(file: File): Promise<string> {
  if (file.type !== 'application/pdf' || file.size > PROMO_FILE_MAX) throw new Error('not a PDF up to 10 MB');
  const path = `files/${crypto.randomUUID()}.pdf`;
  const {error} = await supabase.storage.from(PROMO_BUCKET).upload(path, file, {contentType: 'application/pdf'});
  if (error) throw error;
  return supabase.storage.from(PROMO_BUCKET).getPublicUrl(path).data.publicUrl;
}
