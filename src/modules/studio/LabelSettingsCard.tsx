import {useState} from 'react';
import {createPortal} from 'react-dom';
import {Barcode, Pencil, SlidersHorizontal} from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import BarcodeLabelPreview from '../../components/assets/BarcodeLabelPreview';
import {useLibraries} from '../../core/LibraryStore';
import {useSurgi} from '../../store/SurgiStore';
import {DEFAULT_LABEL_SETTINGS} from '../../core/libraryTypes';
import {labelPaper} from '../sterilization/printUtils';

const SIZE_LABEL = {
  SMALL: ['Μικρή', 'Small', '50×25 mm'],
  MEDIUM: ['Μεσαία', 'Medium', '70×35 mm'],
  SHEET: ['Τριπλή (1 μεγάλη + 2 μικρές)', 'Triple (1 large + 2 small)', '100×58 mm'],
};
const HEADER_LABEL = {
  BRAND: ['SurgiTrack', 'SurgiTrack'],
  LOGO: ['Λογότυπο', 'Logo'],
  TEXT: ['Κείμενο', 'Text'],
  NONE: ['Χωρίς', 'None'],
};

/**
 * Studio → Settings: the hospital's barcode label (size, header, details line), set on a preview of
 * one of its Sets. Every label and composition sheet prints with it.
 */
export default function LabelSettingsCard({L}: {L: (el: string, en: string) => string}) {
  const libs = useLibraries();
  const {sets, tools} = useSurgi();
  const [open, setOpen] = useState(false);
  const label = {...DEFAULT_LABEL_SETTINGS, ...(libs.systemSettings.label || {})};
  const [sizeEl, sizeEn] = SIZE_LABEL[label.size] || SIZE_LABEL.SMALL;
  const paper = labelPaper(label);
  const mm = `${paper.w}×${paper.h} mm`;
  const [headerEl, headerEn] = HEADER_LABEL[label.header] || HEADER_LABEL.BRAND;
  // A Set with its sterilization and expiry dates when there is one, so the preview shows them as they print.
  const sample = sets.find(set => set.sterileUntil) ||
    sets[0] || {
      barcode: 'S000001',
      name: L('ΔΕΙΓΜΑ ΣΕΤ', 'SAMPLE SET'),
      department: L('Χειρουργείο', 'Operating theatre'),
    };
  const sampleTools = 'id' in sample ? tools.filter(t => t.setId === sample.id).length : 12;
  return (
    <section className="label-settings-card">
      <header>
        <Barcode />
        <div>
          <h3>{L('Ετικέτα barcode', 'Barcode label')}</h3>
          <p>
            {L(
              'Πώς τυπώνεται η ετικέτα σε Σετ και εργαλεία: μέγεθος, κεφαλίδα και γραμμή στοιχείων. Ισχύει για κάθε εκτύπωση του νοσοκομείου.',
              'How labels print on Sets and instruments: size, header and details line. Used for every print in the hospital.',
            )}
          </p>
        </div>
      </header>
      <div className="label-settings-summary" role="group" aria-label={L('Ρυθμίσεις ετικέτας', 'Label settings')}>
        <button type="button" onClick={() => setOpen(true)}>
          <span>{L('Μέγεθος', 'Size')}</span>
          <b>
            {L(sizeEl, sizeEn)} <small>{mm}</small>
          </b>
          <Pencil size={13} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => setOpen(true)}>
          <span>{L('Κεφαλίδα', 'Header')}</span>
          <b>{label.header === 'TEXT' && label.text ? label.text : L(headerEl, headerEn)}</b>
          <Pencil size={13} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => setOpen(true)}>
          <span>{L('Γραμμή στοιχείων', 'Details line')}</span>
          <b>{label.showDetails ? L('Εμφανίζεται', 'Shown') : L('Κρυφή', 'Hidden')}</b>
          <Pencil size={13} aria-hidden="true" />
        </button>
      </div>
      <AppButton variant="primary" icon={<SlidersHorizontal size={15} />} onClick={() => setOpen(true)}>
        {L('Επεξεργασία ετικέτας', 'Edit the label')}
      </AppButton>
      {/* Outside the Settings grid, whose form styles would otherwise reach the dialog. */}
      {open &&
        createPortal(
          <BarcodeLabelPreview
            asset={sample}
            kind="SET"
            toolCount={sampleTools}
            saveOnClose
            onClose={() => setOpen(false)}
          />,
          document.body,
        )}
    </section>
  );
}
