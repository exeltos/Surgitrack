import {useState} from 'react';
import {createPortal} from 'react-dom';
import {SlidersHorizontal} from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import BarcodeLabelPreview from '../../components/assets/BarcodeLabelPreview';
import {useSurgi} from '../../store/SurgiStore';

/**
 * Studio → Settings, a row of the Sterilization card: the hospital's barcode label (size, header, details line), set on a preview of
 * one of its Sets. Every label and composition sheet prints with it.
 */
export default function LabelSettingsCard({L}: {L: (el: string, en: string) => string}) {
  const {sets, tools} = useSurgi();
  const [open, setOpen] = useState(false);
  // A Set with its sterilization and expiry dates when there is one, so the preview shows them as they print.
  const sample = sets.find(set => set.sterileUntil) ||
    sets[0] || {
      barcode: 'S000001',
      name: L('ΔΕΙΓΜΑ ΣΕΤ', 'SAMPLE SET'),
      department: L('Χειρουργείο', 'Operating theatre'),
    };
  const sampleTools = 'id' in sample ? tools.filter(t => t.setId === sample.id).length : 12;
  return (
    <div className="studio-setting-row">
      <span>{L('Ετικέτα barcode', 'Barcode label')}</span>
      <small>
        {L(
          'Πώς τυπώνεται η ετικέτα σε Σετ και εργαλεία: μέγεθος, κεφαλίδα και γραμμή στοιχείων. Ισχύει για κάθε εκτύπωση του νοσοκομείου.',
          'How labels print on Sets and instruments: size, header and details line. Used for every print in the hospital.',
        )}
      </small>
      <div className="studio-setting-input">
        <AppButton icon={<SlidersHorizontal size={15} />} onClick={() => setOpen(true)}>
          {L('Επεξεργασία ετικέτας', 'Edit the label')}
        </AppButton>
      </div>
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
    </div>
  );
}
