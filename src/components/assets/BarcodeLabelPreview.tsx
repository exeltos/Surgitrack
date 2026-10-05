import {useState} from 'react';
import {ImagePlus, Trash2} from 'lucide-react';
import PrintPreviewModal from './PrintPreviewModal';
import AppButton from '../ui/AppButton';
import {barcodeLabelHtml, labelPaper} from '../../modules/sterilization/printUtils';
import {useLibraries} from '../../core/LibraryStore';
import {useSurgi} from '../../store/SurgiStore';
import {DEFAULT_LABEL_SETTINGS, type LabelHeader, type LabelSettings, type LabelSize} from '../../core/libraryTypes';
import type {AssetKind, SetAsset, Tool} from '../../types/domain';
import {tr} from '../../i18n';

const SIZES: Array<{id: LabelSize; label: string; mm: string}> = [
  {id: 'SMALL', label: 'Μικρή', mm: '50×25 mm'},
  {id: 'MEDIUM', label: 'Μεσαία', mm: '70×35 mm'},
  {id: 'SHEET', label: 'Τριπλή', mm: '1 μεγάλη + 2 μικρές'},
];
/** Preview zoom that fits each size in the dialog. */
const ZOOM_FOR: Record<LabelSize, number> = {SMALL: 3, MEDIUM: 2.2, SHEET: 1.4};
const HEADERS: Array<{id: LabelHeader; label: string}> = [
  {id: 'BRAND', label: 'SurgiTrack'},
  {id: 'LOGO', label: 'Λογότυπο'},
  {id: 'TEXT', label: 'Κείμενο'},
  {id: 'NONE', label: 'Χωρίς'},
];

/** Shrinks an uploaded logo to a small PNG so it can live in the hospital's settings. */
const logoDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, 360 / img.width, 120 / img.height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });

type LabelAsset = (Pick<SetAsset, 'barcode' | 'name' | 'department'> & {code?: string}) | Tool;

/** Barcode label preview with its options: size, header (logo / text / none) and details line. */
export default function BarcodeLabelPreview({
  asset,
  kind,
  toolCount,
  onClose,
}: {
  asset: LabelAsset;
  kind: AssetKind;
  toolCount?: number;
  onClose: () => void;
}) {
  const libs = useLibraries();
  const {can, currentUser} = useSurgi();
  const saved = {...DEFAULT_LABEL_SETTINGS, ...(libs.systemSettings.label || {})};
  const [settings, setSettings] = useState<LabelSettings>(saved);
  const [zoom, setZoom] = useState(() => ZOOM_FOR[saved.size] || 2.4);
  const [logoError, setLogoError] = useState('');
  const canSaveDefault = can('studio.manage');
  const changed = JSON.stringify(settings) !== JSON.stringify(saved);
  const set = (patch: Partial<LabelSettings>) => setSettings(current => ({...current, ...patch}));
  const paper = labelPaper(settings);

  const aside = (
    <>
      <div className="label-option-group">
        <span>{tr('ΜΕΓΕΘΟΣ')}</span>
        <div className="label-segments sizes">
          {SIZES.map(size => (
            <button
              key={size.id}
              type="button"
              className={settings.size === size.id ? 'active' : ''}
              aria-pressed={settings.size === size.id}
              onClick={() => {
                set({size: size.id, width: undefined, height: undefined});
                setZoom(ZOOM_FOR[size.id]);
              }}
            >
              {tr(size.label)}
              <small>{tr(size.mm)}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="label-option-group">
        <span>{tr('ΧΑΡΤΙ ΕΚΤΥΠΩΤΗ (mm)')}</span>
        <div className="label-numbers">
          <label>
            {tr('Πλάτος')}
            <input
              type="number"
              min={20}
              max={150}
              value={paper.w}
              onChange={e => set({width: Number(e.target.value) || undefined})}
            />
          </label>
          <label>
            {tr('Ύψος')}
            <input
              type="number"
              min={20}
              max={150}
              value={paper.h}
              onChange={e => set({height: Number(e.target.value) || undefined})}
            />
          </label>
          <label
            title={tr('Κενό στη δεξιά άκρη κάθε ετικέτας, π.χ. για τη λωρίδα δείκτη που είναι ήδη τυπωμένη στο χαρτί.')}
          >
            {tr('Κενό δεξιά')}
            <input
              type="number"
              min={0}
              max={15}
              step={0.5}
              value={settings.reserveRight || 0}
              onChange={e => set({reserveRight: Number(e.target.value) || undefined})}
            />
          </label>
        </div>
        {settings.size === 'SHEET' && (
          <label className="label-zoom">
            {tr('Μεγάλη ετικέτα')}
            <input
              type="range"
              min={35}
              max={70}
              step={5}
              value={settings.mainShare || 50}
              onChange={e => set({mainShare: Number(e.target.value)})}
              aria-label={tr('Ύψος μεγάλης ετικέτας')}
            />
            <b>{settings.mainShare || 50}%</b>
          </label>
        )}
      </div>
      <div className="label-option-group">
        <span>{tr('ΚΕΦΑΛΙΔΑ')}</span>
        <div className="label-segments">
          {HEADERS.map(header => (
            <button
              key={header.id}
              type="button"
              className={settings.header === header.id ? 'active' : ''}
              aria-pressed={settings.header === header.id}
              onClick={() => set({header: header.id})}
            >
              {tr(header.label)}
            </button>
          ))}
        </div>
        {settings.header === 'TEXT' && (
          <input
            type="text"
            maxLength={40}
            value={settings.text || ''}
            onChange={e => set({text: e.target.value})}
            placeholder={tr('Π.χ. όνομα νοσοκομείου')}
            aria-label={tr('Κείμενο κεφαλίδας')}
          />
        )}
        {settings.header === 'LOGO' && (
          <div className="label-logo-row">
            {settings.logo && <img src={settings.logo} alt={tr('Λογότυπο')} />}
            <label>
              <ImagePlus size={14} /> {settings.logo ? tr('Αλλαγή') : tr('Ανέβασμα λογότυπου')}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={async e => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  try {
                    setLogoError('');
                    set({logo: await logoDataUrl(file)});
                  } catch {
                    setLogoError(tr('Η εικόνα δεν μπόρεσε να διαβαστεί.'));
                  }
                }}
              />
            </label>
            {settings.logo && (
              <button
                type="button"
                className="icon-button"
                aria-label={tr('Αφαίρεση λογότυπου')}
                onClick={() => set({logo: undefined})}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}
        {logoError && <small className="identity-error">{logoError}</small>}
      </div>
      <label className="label-check">
        <input type="checkbox" checked={!!settings.showCode} onChange={e => set({showCode: e.target.checked})} />
        {tr('Κωδικός (cod.) πάνω από το όνομα')}
      </label>
      <label className="label-check">
        <input type="checkbox" checked={settings.showDetails} onChange={e => set({showDetails: e.target.checked})} />
        {kind === 'SET' ? tr('Πλήθος εργαλείων') : tr('Χρήσεις')}
      </label>
      <label className="label-zoom">
        {tr('Μεγέθυνση')}
        <input
          type="range"
          min={1}
          max={4}
          step={0.2}
          value={zoom}
          onChange={e => setZoom(Number(e.target.value))}
          aria-label={tr('Μεγέθυνση')}
        />
        <b>{Math.round(zoom * 100)}%</b>
      </label>
      {canSaveDefault ? (
        <AppButton
          disabled={!changed}
          onClick={() => libs.updateSystemSettings({label: settings}, currentUser.name, 'Προεπιλογές ετικέτας barcode')}
        >
          {changed ? tr('Ορισμός ως προεπιλογή νοσοκομείου') : tr('Είναι η προεπιλογή νοσοκομείου')}
        </AppButton>
      ) : (
        <p className="label-default-note">
          {tr(
            'Οι προεπιλογές της ετικέτας ορίζονται από τον διαχειριστή. Οι αλλαγές εδώ ισχύουν για αυτή την εκτύπωση.',
          )}
        </p>
      )}
    </>
  );

  return (
    <PrintPreviewModal
      compact
      title={`Barcode ${asset.barcode}`}
      html={barcodeLabelHtml(asset, kind, toolCount, settings, zoom)}
      aside={aside}
      onClose={onClose}
    />
  );
}
