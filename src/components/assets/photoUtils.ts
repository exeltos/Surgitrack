import type {AssetPhoto} from '../../types/domain';
import {formatDateTime} from '../../core/displayDate';
import {photoPath, uploadPhoto} from '../../data/cloud/photoStorage';

/** Longest side of a stored photo: sharp on any screen, ~200–300 KB instead of a phone's 3–5 MB. */
const FULL = 1600;
/** Longest side of the preview kept inside the record for lists and cards (~10–20 KB). */
const PREVIEW = 320;

async function decode(file: File): Promise<CanvasImageSource & {width: number; height: number}> {
  if (typeof createImageBitmap === 'function') return createImageBitmap(file);
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function draw(source: CanvasImageSource & {width: number; height: number}, longest: number) {
  const scale = Math.min(1, longest / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  // JPEG has no transparency: a white background instead of black behind transparent PNGs.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

const toBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('no blob'))), 'image/jpeg', quality),
  );

const readAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/**
 * Photos from the camera or the device, downscaled. In a hospital the photo goes to Storage and the record
 * keeps a small preview and the file's path; otherwise (local Demo, offline) the downscaled photo itself.
 */
export async function filesToAssetPhotos(files: File[], folder: 'assets' | 'issues' = 'assets'): Promise<AssetPhoto[]> {
  const images = files.filter(file => file.type.startsWith('image/'));
  return Promise.all(
    images.map(async (file, index): Promise<AssetPhoto> => {
      const id = `ph-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
      const base = {id, name: file.name || `Φωτογραφία ${index + 1}`, createdAt: formatDateTime()};
      let source: Awaited<ReturnType<typeof decode>>;
      try {
        source = await decode(file);
      } catch {
        // A format the browser cannot draw: keep the file as it is.
        return {...base, dataUrl: await readAsDataUrl(file)};
      }
      const full = await toBlob(draw(source, FULL), 0.82);
      const path = photoPath(folder, id);
      if (path && (await uploadPhoto(path, full).catch(() => false))) {
        return {...base, dataUrl: draw(source, PREVIEW).toDataURL('image/jpeg', 0.72), path};
      }
      return {...base, dataUrl: await readAsDataUrl(full)};
    }),
  );
}
