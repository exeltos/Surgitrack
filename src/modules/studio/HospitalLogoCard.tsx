import {useRef, useState} from 'react';
import {ImagePlus, Trash2} from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import {useLibraries} from '../../core/LibraryStore';
import {useSurgi} from '../../store/SurgiStore';
import {DEFAULT_LABEL_SETTINGS} from '../../core/libraryTypes';
import {logoDataUrl} from '../../core/logoImage';

/**
 * Studio → Settings: the hospital's logo. It is stored with the hospital's settings (the same small image the barcode
 * label can use) and printed at the top of its reports, tables, forms and sheets.
 */
export default function HospitalLogoCard({L}: {L: (el: string, en: string) => string}) {
  const libs = useLibraries();
  const {currentUser} = useSurgi();
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const label = {...DEFAULT_LABEL_SETTINGS, ...(libs.systemSettings.label || {})};
  const save = (logo: string | undefined) =>
    libs.updateSystemSettings({label: {...label, logo}}, currentUser.name, L('Λογότυπο νοσοκομείου', 'Hospital logo'));
  return (
    <section className="label-settings-card hospital-logo-card">
      <header>
        <ImagePlus />
        <div>
          <h3>{L('Λογότυπο νοσοκομείου', 'Hospital logo')}</h3>
          <p>
            {L(
              'Εμφανίζεται στην κορυφή των εκτυπώσεων: αναφορές, λίστες, έντυπα, φύλλα αποδέσμευσης και σύνθεσης.',
              'Printed at the top of the hospital’s reports, lists, forms and release and composition sheets.',
            )}
          </p>
        </div>
      </header>
      <div className="hospital-logo-body">
        {label.logo ? (
          <img src={label.logo} alt={L('Λογότυπο νοσοκομείου', 'Hospital logo')} />
        ) : (
          <small>
            {L(
              'Δεν έχει οριστεί λογότυπο· οι εκτυπώσεις φέρουν το SurgiTrack.',
              'No logo set; prints carry SurgiTrack.',
            )}
          </small>
        )}
      </div>
      <div className="hospital-logo-actions">
        <AppButton variant="primary" icon={<ImagePlus size={15} />} onClick={() => input.current?.click()}>
          {label.logo ? L('Αλλαγή λογότυπου', 'Change logo') : L('Ανέβασμα λογότυπου', 'Upload logo')}
        </AppButton>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={async e => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            try {
              setError('');
              save(await logoDataUrl(file));
            } catch {
              setError(
                L('Η εικόνα δεν διαβάστηκε. Δοκιμάστε PNG ή JPG.', 'The image could not be read. Try a PNG or JPG.'),
              );
            }
          }}
        />
        {label.logo && (
          <AppButton icon={<Trash2 size={15} />} onClick={() => save(undefined)}>
            {L('Αφαίρεση', 'Remove')}
          </AppButton>
        )}
      </div>
      {error && <small className="studio-field-error">{error}</small>}
    </section>
  );
}
