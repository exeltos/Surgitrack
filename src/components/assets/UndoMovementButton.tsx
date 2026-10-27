import {Undo2} from 'lucide-react';
import {useSurgi} from '../../store/SurgiStore';
import type {AssetKind} from '../../types/domain';
import type {UndoRefusal} from '../../core/movementUndo';
import AppButton from '../ui/AppButton';
import {useConfirm} from '../ui/useConfirm';
import {tr, trData} from '../../i18n';
import {movementText} from '../../core/movementText';

const refusalText = (reason: UndoRefusal) =>
  reason === 'USE_COUNTED'
    ? tr('Μετρήθηκε χρήση: την αποστολή την ακυρώνει ο προϊστάμενος Αποστείρωσης.')
    : reason === 'NOT_TODAY'
      ? tr('Αναιρείτε μόνο κινήσεις της ίδιας ημέρας· τις παλαιότερες ο προϊστάμενος.')
      : reason === 'LAST_IN_LOAD'
        ? tr('Είναι το μόνο στο φορτίο: τερματίστε τον κύκλο ως αποτυχημένο για να βγει από τον κλίβανο.')
        : '';

/**
 * «Αναίρεση …» on a Set's or instrument's page: undoes its latest dispatch, receipt, stage of Sterilization,
 * loading or delivery when it was made by mistake, with a reason. Shown only to who may undo it (see
 * core/movementUndo).
 */
export default function UndoMovementButton({kind, id}: {kind: AssetKind; id: string}) {
  const {undoInfo, undoMovement, role} = useSurgi();
  const [confirmNode, ask] = useConfirm();
  const info = undoInfo(kind, id);
  const action = info?.snapshot.action;
  if (!info || !action) return null;
  // A refusal worth explaining is shown on a disabled button; the rest stay hidden.
  const refusal = info.ok ? '' : refusalText(info.reason);
  if (!info.ok && !refusal) return null;
  const stage = info.snapshot.stage;
  const label =
    action === 'DISPATCH'
      ? role === 'DEPARTMENT'
        ? tr('Ακύρωση αποστολής')
        : tr('Αναίρεση αποστολής')
      : action === 'RECEIPT'
        ? tr('Αναίρεση παραλαβής')
        : action === 'STAGE'
          ? tr('Αναίρεση: {0}', trData(stage || ''))
          : action === 'LOADING'
            ? tr('Αναίρεση φόρτωσης')
            : tr('Αναίρεση παράδοσης');
  const m = info.movement;
  return (
    <>
      <AppButton
        variant="secondary"
        icon={<Undo2 size={16} />}
        disabled={!info.ok}
        title={refusal || undefined}
        onClick={() =>
          ask({
            title: label,
            message:
              tr(
                'Αναιρείται η κίνηση «{0}» της {1} ({2}) και το {3} επιστρέφει όπως ήταν πριν. Η κίνηση μένει στο ιστορικό ως αναιρεμένη.',
                movementText(m.status),
                m.at,
                trData(m.by),
                m.asset.split(' · ')[0],
              ) +
              (info.snapshot.legacy
                ? ' ' +
                  tr(
                    'Παλαιότερη κίνηση: επανέρχεται μόνο η θέση του (και οι ημερομηνίες αποστείρωσης της τελευταίας αποδέσμευσης)· οι χρήσεις δεν αλλάζουν, διορθώστε τες με −/+ αν χρειάζεται.',
                  )
                : ''),
            confirmLabel: label,
            danger: true,
            note: {label: tr('Αιτιολογία'), placeholder: tr('π.χ. λάθος σάρωση'), required: true},
            onConfirm: reason => void undoMovement(kind, id, reason),
          })
        }
      >
        {label}
      </AppButton>
      {confirmNode}
    </>
  );
}
