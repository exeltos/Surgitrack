import {useState} from 'react';
import {Undo2} from 'lucide-react';
import {useSurgi} from '../../store/SurgiStore';
import type {AssetKind} from '../../types/domain';
import AppButton from '../ui/AppButton';
import StageReturnModal from '../../modules/sterilization/parts/StageReturnModal';
import {tr} from '../../i18n';

/**
 * «Επιστροφή…» on a Set's or instrument's page: puts it back to an earlier stage or to its department, with a
 * reason. Only the owner, the hospital admin and the Sterilization supervisor see it (see core/stageReturn).
 */
export default function StageReturnButton({kind, id}: {kind: AssetKind; id: string}) {
  const {stageReturnInfo, sets, tools} = useSurgi();
  const [open, setOpen] = useState(false);
  const asset = kind === 'SET' ? sets.find(s => s.id === id) : tools.find(t => t.id === id);
  if (!asset || !stageReturnInfo(kind, id)) return null;
  return (
    <>
      <AppButton variant="secondary" icon={<Undo2 size={16} />} onClick={() => setOpen(true)}>
        {tr('Επιστροφή…')}
      </AppButton>
      {open && (
        <StageReturnModal asset={{kind, id, barcode: asset.barcode, name: asset.name}} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
