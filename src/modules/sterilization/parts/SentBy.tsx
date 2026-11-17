import {tr, trData} from '../../../i18n';
import {useSurgi} from '../../../store/SurgiStore';
import {electronicDispatch} from '../../../core/electronicDispatch';

/** Who sent the Set or instrument to Sterilization, and when: shown at every stage, so the sender is never lost. */
export default function SentBy({barcode}: {barcode: string}) {
  const {movements} = useSurgi();
  const sent = electronicDispatch(movements, barcode);
  if (!sent) return null;
  return <span className="sent-by">{tr('Αποστολέας: {0} · {1}', trData(sent.by), sent.at)}</span>;
}
