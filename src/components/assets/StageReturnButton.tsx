import {useState, type ReactNode} from 'react';
import {Undo2} from 'lucide-react';
import {useSurgi} from '../../store/SurgiStore';
import type {AssetKind} from '../../types/domain';
import type {ActionMenuItem} from '../ui/ActionMenu';
import StageReturnModal from '../../modules/sterilization/parts/StageReturnModal';
import {tr} from '../../i18n';

/**
 * «Επιστροφή…» on a Set's or instrument's page (an item of its «Ενέργειες» menu): puts it back to an earlier stage
 * or to its department, with a reason. Only the owner, the hospital admin and the Sterilization supervisor get the
 * item (see core/stageReturn); `node` is its dialog.
 */
export function useStageReturn(kind: AssetKind, id: string): {item?: ActionMenuItem; node: ReactNode} {
  const {stageReturnInfo, sets, tools} = useSurgi();
  const [open, setOpen] = useState(false);
  const asset = kind === 'SET' ? sets.find(s => s.id === id) : tools.find(t => t.id === id);
  if (!asset || !stageReturnInfo(kind, id)) return {node: null};
  return {
    node: open ? (
      <StageReturnModal asset={{kind, id, barcode: asset.barcode, name: asset.name}} onClose={() => setOpen(false)} />
    ) : null,
    item: {
      key: 'stage-return',
      icon: <Undo2 size={16} />,
      label: tr('Επιστροφή…'),
      hint: tr('Πίσω σε προηγούμενο στάδιο ή στο τμήμα'),
      onSelect: () => setOpen(true),
    },
  };
}
