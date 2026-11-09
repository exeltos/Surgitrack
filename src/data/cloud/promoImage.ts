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
