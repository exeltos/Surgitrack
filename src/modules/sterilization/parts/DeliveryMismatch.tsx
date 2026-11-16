import {TriangleAlert} from 'lucide-react';
import {tr, trData} from '../../../i18n';

/**
 * The person receiving a delivery belongs to another department: a written reason where the hospital allows it
 * (Ροή Αποστείρωσης › Κανόνες), else the delivery is refused.
 */
export default function DeliveryMismatch({
  personDepartment,
  department,
  allowed,
  reason,
  onReason,
}: {
  personDepartment: string;
  department: string;
  allowed: boolean;
  reason: string;
  onReason: (value: string) => void;
}) {
  return (
    <div className="identity-mismatch-box">
      <div className="identity-warning">
        <TriangleAlert size={16} />
        <span>
          {tr('Ο χρήστης ανήκει στο') + ' '}
          <b>{trData(personDepartment)}</b>
          {tr(', ενώ η παράδοση αφορά το')} <b>{trData(department)}</b>.
        </span>
      </div>
      {allowed ? (
        <label>
          {tr('Αιτιολόγηση εξαίρεσης')}
          <textarea
            value={reason}
            onChange={e => onReason(e.target.value)}
            placeholder={tr('Π.χ. εξουσιοδοτημένη παραλαβή για άλλο τμήμα…')}
          />
        </label>
      ) : (
        <div className="identity-error">{tr('Η πολιτική της μονάδας δεν επιτρέπει παράδοση σε άλλο τμήμα.')}</div>
      )}
    </div>
  );
}
