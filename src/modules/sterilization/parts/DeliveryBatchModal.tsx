import AssetTypeIcon from '../../../components/assets/AssetTypeIcon';
import BarcodeCapture from '../../../components/barcode/BarcodeCapture';
import {CheckCircle2, ScanBarcode, UserRoundCheck, X, ShieldCheck, IdCard, UserCheck} from 'lucide-react';
import {tr, trData} from '../../../i18n';
import HandoverSignature from '../HandoverSignature';
import type {SterilizationPageState} from '../useSterilizationPage';

export default function DeliveryBatchModal({s}: {s: SterilizationPageState}) {
  const {
    addBarcodeToDelivery,
    closeDeliveryBatch,
    completeDeliveryBatch,
    currentUser,
    deliveryBatchDepartment,
    deliveryBatchNote,
    deliveryBatchOpen,
    deliveryBatchReceiver,
    deliveryBatchReceiverMatches,
    deliveryScanFeedback,
    deliverySelected,
    deliverySelectedAssets,
    processLoads,
    ready,
    setDeliveryBatchNote,
    setDeliveryBatchReceiver,
    toggleAllDeliveryDepartment,
    toggleDeliveryAsset,
  } = s;
  return (
    <>
      {deliveryBatchOpen && (
        <div className="modal-backdrop" onMouseDown={closeDeliveryBatch}>
          <div
            className="receipt-card-modal workflow-modal delivery-batch-modal"
            onMouseDown={e => e.stopPropagation()}
          >
            <button className="modal-x" aria-label={tr('Κλείσιμο')} title={tr('Κλείσιμο')} onClick={closeDeliveryBatch}>
              <X size={18} />
            </button>
            <div className="workflow-modal-head">
              <div className="ster-kind set">
                <ScanBarcode size={20} />
              </div>
              <div className="workflow-modal-title">
                <span className="eyebrow">{tr('ΠΑΡΑΔΟΣΗ ΣΤΟ ΤΜΗΜΑ')}</span>
                <h2>{tr('Μαζική παράδοση')}</h2>
                <p>
                  {tr(
                    'Πρόσθεσε τα αντικείμενα με barcode, scanner υπολογιστή ή χειροκίνητα από τη λίστα. Κάθε παράδοση αφορά ένα τμήμα.',
                  )}
                </p>
              </div>
              <div className="delivery-batch-count">
                <strong>{deliverySelectedAssets.length}</strong>
                <span>{tr('επιλεγμένα')}</span>
              </div>
            </div>
            <div className="delivery-batch-body">
              <BarcodeCapture
                title={tr('Προσθήκη στην παράδοση')}
                subtitle={
                  deliveryBatchDepartment
                    ? tr('Παράδοση προς {0}', deliveryBatchDepartment)
                    : tr('Το πρώτο barcode ορίζει το τμήμα της παράδοσης.')
                }
                feedback={deliveryScanFeedback}
                onBarcode={addBarcodeToDelivery}
              />
              <div className="delivery-batch-grid">
                <section className="delivery-batch-assets">
                  <div className="load-assets-head">
                    <div>
                      <strong>{tr('Αντικείμενα παράδοσης')}</strong>
                      <span>
                        {deliverySelectedAssets.length} {tr('επιλεγμένα')}
                        {deliveryBatchDepartment ? ` · ${deliveryBatchDepartment}` : ''}
                      </span>
                    </div>
                    <div className="delivery-list-actions">
                      {deliveryBatchDepartment && (
                        <button type="button" className="secondary compact" onClick={toggleAllDeliveryDepartment}>
                          {ready
                            .filter(item => item.department === deliveryBatchDepartment)
                            .every(item => deliverySelected.has(`${item.kind}:${item.id}`))
                            ? tr('Αποεπιλογή τμήματος')
                            : tr('Επιλογή όλων του τμήματος')}
                        </button>
                      )}
                      <small>
                        {deliveryBatchDepartment
                          ? tr('Μπορείς να επιλέξεις πολλά αντικείμενα του ίδιου τμήματος.')
                          : tr('Επίλεξε το πρώτο αντικείμενο για να οριστεί το τμήμα.')}
                      </small>
                    </div>
                  </div>
                  <div className="delivery-batch-list">
                    {ready.map(item => {
                      const key = `${item.kind}:${item.id}`;
                      const selected = deliverySelected.has(key);
                      const incompatible =
                        !!deliveryBatchDepartment && !selected && item.department !== deliveryBatchDepartment;
                      const lastLoad = processLoads.find(
                        load =>
                          load.kind === 'STERILIZATION' &&
                          load.status === 'RELEASED' &&
                          load.items.some(loadItem => loadItem.assetId === item.id && loadItem.assetKind === item.kind),
                      );
                      return (
                        <label
                          key={key}
                          className={`${selected ? 'selected ' : ''}${incompatible ? 'incompatible' : ''}`.trim()}
                          title={
                            incompatible ? tr('Η τρέχουσα παράδοση αφορά το {0}', deliveryBatchDepartment) : undefined
                          }
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={incompatible}
                            onChange={() => toggleDeliveryAsset(item)}
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
                              {trData(item.department)} ·{' '}
                              {lastLoad
                                ? `Load ${lastLoad.id} / ${lastLoad.cycleNumber}`
                                : tr('Αποδεσμευμένο μεμονωμένα')}
                              {incompatible ? tr(' · Άλλο τμήμα') : ''}
                            </small>
                          </div>
                          {selected && <CheckCircle2 size={17} />}
                        </label>
                      );
                    })}
                  </div>
                </section>
                <section className="delivery-batch-confirm">
                  <div className="delivery-pair">
                    <div className="delivery-person confirmed">
                      <UserCheck size={19} />
                      <div>
                        <span>{tr('Παραδίδει')}</span>
                        <strong>{trData(currentUser.name)}</strong>
                        <small>{trData(currentUser.department)}</small>
                      </div>
                    </div>
                    <div className={`delivery-person ${deliveryBatchReceiverMatches ? 'confirmed' : ''}`}>
                      <IdCard size={19} />
                      <div>
                        <span>{tr('Παραλαμβάνει')}</span>
                        <strong>
                          {deliveryBatchReceiverMatches ? deliveryBatchReceiver?.name : tr('Αναμονή ταυτοποίησης')}
                        </strong>
                        <small>{deliveryBatchDepartment || tr('Σκάναρε πρώτα αντικείμενο')}</small>
                      </div>
                    </div>
                  </div>
                  <section className="delivery-auth">
                    <HandoverSignature
                      label={tr('Υπογραφή παραλαμβάνοντα (κωδικός χρήστη + συνθηματικό)')}
                      department={deliveryBatchDepartment}
                      disabled={!deliveryBatchDepartment}
                      signer={deliveryBatchReceiver}
                      onSigned={setDeliveryBatchReceiver}
                    />
                    {deliveryBatchReceiver &&
                      (!deliveryBatchReceiverMatches ? (
                        <div className="identity-error">
                          {tr('Ο χρήστης ανήκει στο') + ' '}
                          {trData(deliveryBatchReceiver.department)}
                          {tr(', ενώ η παράδοση αφορά το')} {deliveryBatchDepartment}.
                        </div>
                      ) : (
                        <div className="identity-result">
                          <CheckCircle2 size={17} />
                          <div>
                            <strong>{deliveryBatchReceiver.name}</strong>
                            <span>
                              {deliveryBatchReceiver.role} · {trData(deliveryBatchReceiver.department)}
                            </span>
                          </div>
                        </div>
                      ))}
                  </section>
                  <label className="cycle-note">
                    {tr('Παρατήρηση παράδοσης')}
                    <textarea
                      value={deliveryBatchNote}
                      onChange={e => setDeliveryBatchNote(e.target.value)}
                      placeholder={tr('Προαιρετική παρατήρηση για ολόκληρη την παράδοση…')}
                    />
                  </label>
                  <div className="delivery-trace-note">
                    <ShieldCheck size={17} />
                    <span>
                      {tr(
                        'Με την ολοκλήρωση καταγράφονται κοινό ID παράδοσης, χρήστης αποστείρωσης, παραλαμβάνων, τμήμα, ημερομηνία/ώρα και σύνδεση κάθε barcode με το ιστορικό κύκλου του.',
                      )}
                    </span>
                  </div>
                </section>
              </div>
            </div>
            <div className="modal-actions workflow-modal-actions">
              <button onClick={closeDeliveryBatch}>{tr('Ακύρωση')}</button>
              <button
                className="primary"
                disabled={!deliverySelectedAssets.length || !deliveryBatchReceiverMatches}
                onClick={completeDeliveryBatch}
              >
                <UserRoundCheck size={16} /> {tr('Ολοκλήρωση παράδοσης ·') + ' '}
                {deliverySelectedAssets.length}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
