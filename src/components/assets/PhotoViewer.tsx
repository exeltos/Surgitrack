import {useEffect, useState} from 'react';
import {X} from 'lucide-react';
import type {AssetPhoto} from '../../types/domain';
import {photoUrl} from '../../data/cloud/photoStorage';
import Spinner from '../ui/Spinner';
import {tr} from '../../i18n';

/** One photo at full size: from Storage when it lives there, otherwise the photo kept in the record. */
export default function PhotoViewer({photo, onClose}: {photo: AssetPhoto; onClose: () => void}) {
  const [src, setSrc] = useState(photo.path ? '' : photo.dataUrl);
  useEffect(() => {
    let live = true;
    if (photo.path)
      void photoUrl(photo.path).then(url => {
        // Offline or missing file: the preview is better than nothing.
        if (live) setSrc(url || photo.dataUrl);
      });
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => {
      live = false;
      window.removeEventListener('keydown', key);
    };
  }, [photo, onClose]);
  return (
    <div className="modal-backdrop photo-viewer" onMouseDown={e => e.currentTarget === e.target && onClose()}>
      <figure role="dialog" aria-modal="true" aria-label={photo.name || tr('Φωτογραφία')}>
        <button type="button" className="icon-button" onClick={onClose} aria-label={tr('Κλείσιμο')}>
          <X size={18} />
        </button>
        {src ? <img src={src} alt={photo.name || tr('Φωτογραφία αντικειμένου')} /> : <Spinner />}
        <figcaption>
          {photo.name} · {photo.createdAt}
        </figcaption>
      </figure>
    </div>
  );
}
