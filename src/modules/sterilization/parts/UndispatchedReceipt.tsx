import DepartmentDispatchModal from '../../../components/department/DepartmentDispatchModal';
import type {SterilizationPageState} from '../useSterilizationPage';

/**
 * An item scanned at the receipt that its department brought by hand, without sending it: Sterilization records
 * its use (patient, uses, clips) as the department's dispatch would, and it joins the receipt.
 */
export default function UndispatchedReceipt({s}: {s: SterilizationPageState}) {
  const item = s.undispatched;
  if (!item) return null;
  return (
    <DepartmentDispatchModal
      key={`${item.kind}:${item.id}`}
      kind={item.kind}
      id={item.id}
      barcode={item.barcode}
      name={item.name}
      atReceipt
      onSent={s.receiveUndispatched}
      onClose={() => s.setUndispatched(null)}
    />
  );
}
