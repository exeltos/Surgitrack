import {CheckCircle2} from 'lucide-react';
import AppButton from '../../../components/ui/AppButton';
import type {ImportState} from './useAssetImport';

export default function DoneStep({s}: {s: ImportState}) {
  const {plan: maybePlan, L, organization, reset} = s;
  if (!maybePlan) return null;
  const plan = maybePlan;
  return (
    <div className="asset-import-done">
      <CheckCircle2 size={34} />
      <b>
        {L(
          `Δημιουργήθηκαν ${plan.sets.length} Σετ και ${plan.tools.length} εργαλεία στο «${organization?.name}».`,
          `${plan.sets.length} Sets and ${plan.tools.length} instruments were created in “${organization?.name}”.`,
        )}
      </b>
      <small>
        {L(
          'Αν κάτι δεν είναι σωστό, αναιρέστε την εισαγωγή από τη λίστα παρακάτω.',
          'If something is wrong, undo the import from the list below.',
        )}
      </small>
      <AppButton variant="primary" onClick={reset}>
        {L('Νέα εισαγωγή', 'New import')}
      </AppButton>
    </div>
  );
}
