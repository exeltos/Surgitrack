import type {AssetPhoto} from '../../types/domain';

export async function filesToAssetPhotos(files: File[]): Promise<AssetPhoto[]> {
  const images = files.filter(file => file.type.startsWith('image/'));
  return Promise.all(
    images.map(
      (file, index) =>
        new Promise<AssetPhoto>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve({
              id: `ph-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
              name: file.name || `Φωτογραφία ${index + 1}`,
              dataUrl: String(reader.result || ''),
              createdAt: new Date().toLocaleString('el-GR', {dateStyle: 'short', timeStyle: 'short'}),
            });
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        }),
    ),
  );
}
