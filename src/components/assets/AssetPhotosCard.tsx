import {useRef, useState} from 'react';
import {Camera, ImagePlus, Trash2, Images} from 'lucide-react';
import AppButton from '../ui/AppButton';
import type {AssetPhoto} from '../../types/domain';
import CameraCaptureModal from './CameraCaptureModal';
import PhotoViewer from './PhotoViewer';
import {tr} from '../../i18n';

type Props = {
  photos: AssetPhoto[];
  onAdd: (files: File[]) => void;
  onRemove: (photoId: string) => void;
  title?: string;
  description?: string;
  readOnly?: boolean;
};

export default function AssetPhotosCard({
  photos,
  onAdd,
  onRemove,
  title = tr('Φωτογραφίες'),
  description = tr(
    'Φωτογραφική τεκμηρίωση του φυσικού αντικειμένου. Μπορείς να κρατήσεις περισσότερες από μία φωτογραφίες.',
  ),
  readOnly = false,
}: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [viewing, setViewing] = useState<AssetPhoto | null>(null);
  const acceptFiles = (list: FileList | null) => {
    if (!list?.length) return;
    onAdd([...list].filter(file => file.type.startsWith('image/')));
  };
  return (
    <section className="asset-section asset-photos-card">
      <div className="asset-section-head photo-section-head">
        <div>
          <span className="eyebrow">{tr('ΤΕΚΜΗΡΙΩΣΗ')}</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        {!readOnly && (
          <div className="photo-actions">
            <AppButton size="sm" icon={<Camera size={16} />} onClick={() => setCameraOpen(true)}>
              {tr('Λήψη φωτογραφίας')}
            </AppButton>
            <AppButton size="sm" icon={<ImagePlus size={16} />} onClick={() => uploadRef.current?.click()}>
              {tr('Upload φωτογραφιών')}
            </AppButton>
          </div>
        )}
      </div>
      {!readOnly && cameraOpen && (
        <CameraCaptureModal
          onCapture={file => {
            onAdd([file]);
            setCameraOpen(false);
          }}
          onClose={() => setCameraOpen(false)}
        />
      )}
      <input
        ref={cameraRef}
        className="visually-hidden-file"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={e => {
          acceptFiles(e.target.files);
          e.currentTarget.value = '';
        }}
      />
      <input
        ref={uploadRef}
        className="visually-hidden-file"
        type="file"
        accept="image/*"
        multiple
        onChange={e => {
          acceptFiles(e.target.files);
          e.currentTarget.value = '';
        }}
      />
      {photos.length ? (
        <div className="asset-photo-grid">
          {photos.map(photo => (
            <figure className="asset-photo-tile" key={photo.id}>
              <button
                type="button"
                className="asset-photo-open"
                onClick={() => setViewing(photo)}
                aria-label={tr('Άνοιγμα φωτογραφίας {0}', photo.name || '')}
              >
                <img src={photo.dataUrl} alt={photo.name || tr('Φωτογραφία αντικειμένου')} />
              </button>
              <figcaption>
                <span>{photo.name || tr('Φωτογραφία')}</span>
                <small>{photo.createdAt}</small>
              </figcaption>
              {!readOnly && (
                <button
                  className="photo-remove"
                  type="button"
                  onClick={() => onRemove(photo.id)}
                  title={tr('Διαγραφή φωτογραφίας')}
                  aria-label={tr('Διαγραφή φωτογραφίας')}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </figure>
          ))}
        </div>
      ) : (
        <div className="asset-photo-empty">
          <Images size={22} />
          <div>
            <strong>{tr('Δεν υπάρχουν φωτογραφίες')}</strong>
            <span>
              {readOnly
                ? tr('Δεν έχει καταχωρηθεί φωτογραφική τεκμηρίωση.')
                : tr('Χρησιμοποίησε κάμερα ή επίλεξε πολλές εικόνες από τη συσκευή.')}
            </span>
          </div>
        </div>
      )}
      {viewing && <PhotoViewer photo={viewing} onClose={() => setViewing(null)} />}
    </section>
  );
}
