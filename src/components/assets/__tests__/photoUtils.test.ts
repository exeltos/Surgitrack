import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const storage = vi.hoisted(() => ({upload: vi.fn()}));
vi.mock('../../../lib/supabase', () => ({
  supabase: {storage: {from: () => ({upload: storage.upload})}},
}));

const {filesToAssetPhotos} = await import('../photoUtils');
const {setPhotoStorageOrganization} = await import('../../../data/cloud/photoStorage');

const photo = () => new File([new Uint8Array(4_000_000)], 'IMG_0001.jpg', {type: 'image/jpeg'});

describe('photos', () => {
  const sizes: Array<[number, number]> = [];
  beforeEach(() => {
    sizes.length = 0;
    storage.upload.mockReset();
    // A 4032×3024 phone photo; jsdom has no canvas, so drawing records the size it was asked for.
    vi.stubGlobal('createImageBitmap', async () => ({width: 4032, height: 3024}));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
      sizes.push([this.width, this.height]);
      return {fillRect: () => {}, drawImage: () => {}, fillStyle: ''} as unknown as CanvasRenderingContext2D;
    } as never);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(cb =>
      cb(new Blob([new Uint8Array(250_000)], {type: 'image/jpeg'})),
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,preview');
  });
  afterEach(() => {
    setPhotoStorageOrganization(undefined);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('in a hospital: downscaled to 1600 px in Storage, a small preview in the record', async () => {
    setPhotoStorageOrganization('org-1');
    storage.upload.mockResolvedValue({error: null});
    const [p] = await filesToAssetPhotos([photo()], 'issues');
    expect(sizes).toContainEqual([1600, 1200]);
    expect(sizes).toContainEqual([320, 240]);
    expect(storage.upload).toHaveBeenCalledWith(`org-1/issues/${p.id}.jpg`, expect.any(Blob), {
      contentType: 'image/jpeg',
    });
    expect(p.path).toBe(`org-1/issues/${p.id}.jpg`);
    expect(p.dataUrl).toBe('data:image/jpeg;base64,preview');
  });

  it('when the upload fails (offline) or outside a hospital: the downscaled photo stays in the record', async () => {
    setPhotoStorageOrganization('org-1');
    storage.upload.mockResolvedValue({error: {message: 'offline'}});
    const [offline] = await filesToAssetPhotos([photo()]);
    expect(offline.path).toBeUndefined();
    expect(offline.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
    setPhotoStorageOrganization(undefined);
    const [local] = await filesToAssetPhotos([photo()]);
    expect(storage.upload).toHaveBeenCalledTimes(1);
    expect(local.path).toBeUndefined();
  });
});
