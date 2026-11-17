import {tr, trData} from '../../../i18n';
import {useSurgi} from '../../../store/SurgiStore';
import {electronicDispatch} from '../../../core/electronicDispatch';

/**
 * Who sent the Set or instrument to Sterilization, when, and the department's note with it: shown at every stage,
 * so neither the sender nor what the department asked («θα το θέλαμε σε 2 ώρες») is lost.
 */
export default function SentBy({barcode}: {barcode: string}) {
  const {movements} = useSurgi();
  const sent = electronicDispatch(movements, barcode);
  if (!sent) return null;
  return (
    <>
      <span className="sent-by">{tr('Αποστολέας: {0} · {1}', trData(sent.by), sent.at)}</span>
      {sent.note && <span className="sent-note">{tr('Σημείωση τμήματος: {0}', sent.note)}</span>}
    </>
  );
}
