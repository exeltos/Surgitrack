import {CheckCircle2, ClipboardCheck, TriangleAlert, Box, Stethoscope, X} from 'lucide-react';
import {tr} from '../../../i18n';
import type {SterilizationPageState} from '../useSterilizationPage';

export default function ReceiptViewModal({s}: {s: SterilizationPageState}) {
  const {prepDraft, receiptDraft, receiptView, setReceiptView} = s;
  return (
    <>
      {receiptView && !receiptDraft && !prepDraft && (
        <div className="modal-backdrop" onMouseDown={() => setReceiptView(null)}>
          <div className="receipt-card-modal completed" onMouseDown={e => e.stopPropagation()}>
            <button
              className="modal-x"
              aria-label={tr('Κλείσιμο')}
              title={tr('Κλείσιμο')}
              onClick={() => setReceiptView(null)}
            >
              <X size={18} />
            </button>
            <div className="receipt-complete-banner">
              <CheckCircle2 size={20} />
              <div>
                <strong>{tr('Η παραλαβή ολοκληρώθηκε')}</strong>
                <span>{tr('Η καρτέλα καταγράφηκε στο ιστορικό.')}</span>
              </div>
            </div>
            <div className="receipt-card-head">
              <div className={`ster-kind ${receiptView.assetKind.toLowerCase()}`}>
                {receiptView.assetKind === 'SET' ? <Box size={19} /> : <Stethoscope size={19} />}
              </div>
              <div>
                <span>
                  {tr('ΚΑΡΤΕΛΑ ΠΑΡΑΛΑΒΗΣ ·') + ' '}
                  {receiptView.id.toUpperCase()}
                </span>
                <h2>
                  {receiptView.barcode} · {receiptView.assetName}
                </h2>
                <p>
                  {receiptView.fromDepartment} → {receiptView.toDepartment}
                </p>
              </div>
            </div>
            <div className="receipt-facts">
              <div>
                <span>{tr('Ημερομηνία / ώρα')}</span>
                <strong>{receiptView.at}</strong>
              </div>
              <div>
                <span>{tr('Παρέδωσε')}</span>
                <strong>{receiptView.deliveredByName}</strong>
                <small>{receiptView.deliveredByDepartment}</small>
              </div>
              <div>
                <span>{tr('Παρέλαβε')}</span>
                <strong>{receiptView.receivedByName}</strong>
                <small>{receiptView.receivedByDepartment}</small>
              </div>
              {receiptView.counterpartyVerified !== undefined && (
                <div>
                  <span>{tr('Υπογραφή άλλου μέρους')}</span>
                  <strong className={receiptView.counterpartyVerified ? '' : 'report-cell-warn'}>
                    {receiptView.counterpartyVerified ? tr('Επιβεβαιωμένη') : tr('Μη επιβεβαιωμένη')}
                  </strong>
                  <small>
                    {receiptView.counterpartyVerified
                      ? tr('Με τον δικό του κωδικό')
                      : tr('Χωρίς επιβεβαίωση κωδικού από τον διακομιστή')}
                  </small>
                </div>
              )}
              {receiptView.assetKind === 'SET' && (
                <div>
                  <span>{tr('Σύνθεση κατά την παραλαβή')}</span>
                  <strong>
                    {receiptView.actual} / {receiptView.expected}
                  </strong>
                </div>
              )}
            </div>
            {receiptView.checkPerformed && (
              <div className="receipt-check-read">
                <div>
                  <ClipboardCheck size={17} />
                  <strong>{tr('Καταμέτρηση κατά την παραλαβή')}</strong>
                </div>
                <span>
                  {receiptView.assetKind === 'SET'
                    ? tr('Παραλήφθηκαν {0} από {1}. ', receiptView.checkedCount, receiptView.expected)
                    : ''}
                  {receiptView.checkResult === 'MISSING'
                    ? tr('Καταγράφηκε διαφορά ποσότητας.')
                    : tr('Η ποσότητα συμφωνεί.')}
                </span>
              </div>
            )}
            {
              <div className="receipt-check-read">
                <div>
                  {receiptView.visibleDeviation ? <TriangleAlert size={17} /> : <CheckCircle2 size={17} />}
                  <strong>{tr('Εμφανής κατάσταση κατά την παραλαβή')}</strong>
                </div>
                <span>
                  {receiptView.visibleDeviation
                    ? tr('Δηλώθηκε εμφανής απόκλιση κατά τη φυσική παραλαβή.')
                    : tr('Δεν δηλώθηκε εμφανής απόκλιση κατά τη φυσική παραλαβή.')}
                </span>
                {receiptView.departmentMismatch && (
                  <p>
                    {tr('Παράδοση από διαφορετικό τμήμα:') + ' '}
                    {receiptView.departmentMismatchReason || tr('Καταγεγραμμένη εξαίρεση')}
                  </p>
                )}
              </div>
            }
            {receiptView.note && (
              <div className="receipt-note-read">
                <span>{tr('Παρατήρηση')}</span>
                <p>{receiptView.note}</p>
              </div>
            )}
            <div className="modal-actions">
              <button className="primary" onClick={() => setReceiptView(null)}>
                {tr('Κλείσιμο')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
