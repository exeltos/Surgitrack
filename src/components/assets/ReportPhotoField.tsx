import {Camera} from 'lucide-react';
import {filesToAssetPhotos} from './photoUtils';
import type {AssetPhoto} from '../../types/domain';
import {tr} from '../../i18n';

/**
 * The photos of a problem report: a field like the others (its name above), whose button opens the camera or the
 * file picker, and says how many photos are ready. The words are ours, not the browser's file button.
 */
export default function ReportPhotoField({
  photos,
  onChange,
}: {
  photos: AssetPhoto[];
  onChange: (photos: AssetPhoto[]) => void;
}) {
  return (
    <label className="report-photo-field" title={tr('Λήψη από κάμερα ή επιλογή πολλών φωτογραφιών')}>
      {tr('Φωτογραφίες')}
      <span className="report-photo-button">
        <Camera size={16} />
        {photos.length ? tr('{0} φωτογραφίες έτοιμες', photos.length) : tr('Προσθήκη φωτογραφιών')}
      </span>
      <input
        className="visually-hidden-file"
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={async e => onChange(await filesToAssetPhotos(Array.from(e.target.files || []), 'issues'))}
      />
    </label>
  );
}
