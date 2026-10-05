import {useState} from 'react';
import {createPortal} from 'react-dom';
import {Barcode, SlidersHorizontal} from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import BarcodeLabelPreview from '../../components/assets/BarcodeLabelPreview';
import {useLibraries} from '../../core/LibraryStore';
import {useSurgi} from '../../store/SurgiStore';
import {DEFAULT_LABEL_SETTINGS} from '../../core/libraryTypes';
import {labelPaper} from '../sterilization/printUtils';

const SIZE_LABEL = {
  SMALL: ['Μικρή', 'Small', '50×25 mm'],
  MEDIUM: ['Μεσαία', 'Medium', '70×35 mm'],
  SHEET: ['Τριπλή (1 μεγάλη + 2 μικρές)', 'Triple (1 large + 2 small)', '100×50 mm'],
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
  const sample = sets[0] || {
    barcode: 'S000001',
    name: L('ΔΕΙΓΜΑ ΣΕΤ', 'SAMPLE SET'),
    department: L('Χειρουργείο', 'Operating theatre'),
  };
  const sampleTools = sets[0] ? tools.filter(t => t.setId === sets[0].id).length : 12;
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
      <dl className="label-settings-summary">
        <div>
          <dt>{L('Μέγεθος', 'Size')}</dt>
          <dd>
            {L(sizeEl, sizeEn)} <small>{mm}</small>
          </dd>
        </div>
        <div>
          <dt>{L('Κεφαλίδα', 'Header')}</dt>
          <dd>{label.header === 'TEXT' && label.text ? label.text : L(headerEl, headerEn)}</dd>
        </div>
        <div>
          <dt>{L('Γραμμή στοιχείων', 'Details line')}</dt>
          <dd>{label.showDetails ? L('Εμφανίζεται', 'Shown') : L('Κρυφή', 'Hidden')}</dd>
        </div>
      </dl>
      <AppButton variant="primary" icon={<SlidersHorizontal size={15} />} onClick={() => setOpen(true)}>
        {L('Ρύθμιση & προεπισκόπηση', 'Set up & preview')}
      </AppButton>
      {/* Outside the Settings grid, whose form styles would otherwise reach the dialog. */}
      {open &&
        createPortal(
          <BarcodeLabelPreview asset={sample} kind="SET" toolCount={sampleTools} onClose={() => setOpen(false)} />,
          document.body,
        )}
    </section>
  );
}
