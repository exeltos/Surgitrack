import {Fragment} from 'react';
import AssetTypeIcon from '../../../components/assets/AssetTypeIcon';
import BarcodeCapture from '../../../components/barcode/BarcodeCapture';
import BatchSetTools from '../BatchSetTools';
import {
  CheckCircle2,
  ScanBarcode,
  TriangleAlert,
  UserRoundCheck,
  X,
  ShieldCheck,
  IdCard,
  UserCheck,
} from 'lucide-react';
import {tr, trData} from '../../../i18n';
import HandoverSignature from '../HandoverSignature';
import type {SterilizationPageState} from '../useSterilizationPage';

export default function ReceiptBatchModal({s}: {s: SterilizationPageState}) {
  const {
    addBarcodeToReceiptBatch,
    closeReceiptBatch,
    completeReceiptBatch,
    currentUser,
    incoming,
    issues,
    openIssueReport,
    receiptBatchAssets,
    receiptBatchDeliverer,
    receiptBatchDelivererMatches,
    receiptBatchDepartment,
    receiptBatchDeviations,
    receiptBatchIdentityValid,
    receiptBatchMismatchReason,
    receiptBatchNote,
    receiptBatchOpen,
    receiptBatchScanFeedback,
    receiptBatchSelected,
    receiptPolicy,
    setReceiptBatchDeliverer,
    setReceiptBatchMismatchReason,
    setReceiptBatchNote,
    toggleReceiptBatchAsset,
    tools,
  } = s;
  return (
    <>
      {receiptBatchOpen && (
        <div className="modal-backdrop" onMouseDown={closeReceiptBatch}>
          <div
            className="receipt-card-modal workflow-modal delivery-batch-modal"
            onMouseDown={e => e.stopPropagation()}
          >
            <button className="modal-x" aria-label={tr('Κλείσιμο')} title={tr('Κλείσιμο')} onClick={closeReceiptBatch}>
              <X size={18} />
            </button>
            <div className="workflow-modal-head">
              <div className="ster-kind set">
                <ScanBarcode size={20} />
              </div>
              <div className="workflow-modal-title">
                <span className="eyebrow">{tr('ΦΥΣΙΚΗ ΠΑΡΑΛΑΒΗ')}</span>
                <h2>{tr('Μαζική παραλαβή')}</h2>
                <p>
                  {tr('Ταυτοποίησε τον παραδίδοντα μία φορά και σκάναρε διαδοχικά τα αντικείμενα του ίδιου τμήματος.')}
                </p>
              </div>
              <div className="delivery-batch-count">
                <strong>{receiptBatchAssets.length}</strong>
                <span>{tr('αντικείμενα')}</span>
              </div>
            </div>
            <div className="delivery-batch-body">
              <BarcodeCapture
                title={tr('Προσθήκη στην παραλαβή')}
                subtitle={
                  receiptBatchDepartment
                    ? tr('Παραλαβή από {0}', receiptBatchDepartment)
                    : tr('Το πρώτο barcode ορίζει το τμήμα της παραλαβής.')
                }
                feedback={receiptBatchScanFeedback}
                onBarcode={addBarcodeToReceiptBatch}
              />
              <div className="delivery-batch-grid">
                <section className="delivery-batch-assets">
                  <div className="load-assets-head">
                    <div>
                      <strong>{tr('Αντικείμενα παραλαβής')}</strong>
                      <span>
                        {receiptBatchAssets.length} {tr('επιλεγμένα')}
                        {receiptBatchDepartment ? ` · ${receiptBatchDepartment}` : ''}
                      </span>
                    </div>
                    <small>{tr('Η λεπτομερής λειτουργική επιθεώρηση γίνεται αργότερα στο «Έλεγχος & Σύνθεση».')}</small>
                  </div>
                  <div className="delivery-batch-list">
                    {incoming.map(item => {
                      const key = `${item.kind}:${item.id}`;
                      const selected = receiptBatchSelected.has(key);
                      const incompatible =
                        !!receiptBatchDepartment && !selected && item.department !== receiptBatchDepartment;
                      const deviation = receiptBatchDeviations.has(key);
                      const setTools = item.kind === 'SET' ? tools.filter(t => t.setId === item.id) : [];
                      return (
                        <Fragment key={key}>
                          <label
                            className={`${selected ? 'selected ' : ''}${incompatible ? 'incompatible ' : ''}${deviation ? 'has-issue' : ''}`.trim()}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              disabled={incompatible}
                              onChange={() => toggleReceiptBatchAsset(item)}
                            />
                            <AssetTypeIcon
                              kind={item.kind}
                              maxUses={item.kind === 'TOOL' ? item.maxUses : undefined}
                              size={16}
                            />
                            <div>
                              <span>
                                <b className="mono">{item.barcode}</b>
                                <strong>{item.name}</strong>
                              </span>
                              <small>
                                {trData(item.department) || tr('Χωρίς τμήμα')} ·{' '}
                                {item.kind === 'SET'
                                  ? `${tr('Σετ')} · ${tr('{0} εργαλεία', setTools.length)}`
                                  : tr('Μεμονωμένο εργαλείο')}
                              </small>
                            </div>
                            {selected && (
                              <button
                                type="button"
                                className={deviation ? 'set-report-btn active' : 'set-report-btn'}
                                onClick={e => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (!deviation) openIssueReport(item.kind, item.id, 'Αποστείρωση · μαζική παραλαβή');
                                }}
                              >
                                {deviation ? (
                                  <>
                                    <TriangleAlert size={13} /> {tr('Απόκλιση καταγράφηκε')}
                                  </>
                                ) : (
                                  <>
                                    <TriangleAlert size={13} /> {tr('Αναφορά απόκλισης')}
                                  </>
                                )}
                              </button>
                            )}
                          </label>
                          {selected && item.kind === 'SET' && (
                            <BatchSetTools
                              tools={setTools}
                              issues={issues}
                              onReport={toolId => openIssueReport('TOOL', toolId, 'Αποστείρωση · μαζική παραλαβή')}
                            />
                          )}
                        </Fragment>
                      );
                    })}
                  </div>
                </section>
                <section className="delivery-batch-confirm">
                  <div className="delivery-pair">
                    <div className="delivery-person confirmed">
                      <UserCheck size={19} />
                      <div>
                        <span>{tr('Παραλαμβάνει')}</span>
                        <strong>{trData(currentUser.name)}</strong>
                        <small>{trData(currentUser.department)}</small>
                      </div>
                    </div>
                    <div className={`delivery-person ${receiptBatchIdentityValid ? 'confirmed' : ''}`}>
                      <IdCard size={19} />
                      <div>
                        <span>{tr('Παραδίδει')}</span>
                        <strong>
                          {receiptBatchIdentityValid ? receiptBatchDeliverer?.name : tr('Αναμονή ταυτοποίησης')}
                        </strong>
                        <small>{receiptBatchDepartment || tr('Σκάναρε πρώτα αντικείμενο')}</small>
                      </div>
                    </div>
                  </div>
                  <section className="delivery-auth">
                    <HandoverSignature
                      label={tr('Υπογραφή παραδίδοντα (κωδικός χρήστη + συνθηματικό)')}
                      department={receiptBatchDepartment}
                      disabled={!receiptBatchDepartment}
                      signer={receiptBatchDeliverer}
                      onSigned={setReceiptBatchDeliverer}
                    />
                    {receiptBatchDeliverer &&
                      (!receiptBatchDelivererMatches ? (
                        <div className="identity-mismatch-box">
                          <div className="identity-warning">
                            <TriangleAlert size={15} />
                            <span>
                              {tr('Ο χρήστης ανήκει στο') + ' '}
                              {trData(receiptBatchDeliverer.department)}
                              {tr(', ενώ η παραλαβή αφορά το')} {receiptBatchDepartment}.
                            </span>
                          </div>
                          {receiptPolicy.allowCrossDepartmentHandover ? (
                            <label>
                              {tr('Αιτιολόγηση εξαίρεσης')}
                              <textarea
                                value={receiptBatchMismatchReason}
                                onChange={e => setReceiptBatchMismatchReason(e.target.value)}
                                placeholder={tr('Υποχρεωτική αιτιολόγηση…')}
                              />
                            </label>
                          ) : (
                            <div className="identity-error">
                              {tr('Η πολιτική της μονάδας δεν επιτρέπει αυτή την εξαίρεση.')}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="identity-result">
                          <CheckCircle2 size={17} />
                          <div>
                            <strong>{receiptBatchDeliverer.name}</strong>
                            <span>
                              {receiptBatchDeliverer.role} · {trData(receiptBatchDeliverer.department)}
                            </span>
                          </div>
                        </div>
                      ))}
                  </section>
                  <label className="cycle-note">
                    {tr('Παρατήρηση παραλαβής')}
                    <textarea
                      value={receiptBatchNote}
                      onChange={e => setReceiptBatchNote(e.target.value)}
                      placeholder={tr('Προαιρετική κοινή παρατήρηση…')}
                    />
                  </label>
                  <div className="delivery-trace-note">
                    <ShieldCheck size={17} />
                    <span>
                      {tr(
                        'Με την ολοκλήρωση καταγράφονται κοινός κωδικός, παραδίδων, παραλαμβάνων, τμήμα, χρόνος και η δήλωση εμφανής απόκλισης ανά barcode.',
                      )}
                    </span>
                  </div>
                </section>
              </div>
            </div>
            <div className="modal-actions workflow-modal-actions">
              <button onClick={closeReceiptBatch}>{tr('Ακύρωση')}</button>
              <button
                className="primary"
                disabled={!receiptBatchAssets.length || !receiptBatchIdentityValid}
                onClick={completeReceiptBatch}
              >
                <UserRoundCheck size={16} /> {tr('Ολοκλήρωση παραλαβής ·') + ' '}
                {receiptBatchAssets.length}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
