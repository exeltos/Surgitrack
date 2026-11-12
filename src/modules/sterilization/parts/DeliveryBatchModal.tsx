import {useEffect, useState} from 'react';
import {loadLabel} from '../../../core/loadLabel';
import BatchDepartmentPicker from './BatchDepartmentPicker';
import {departmentsOf} from '../batchDepartments';
import AssetTypeIcon from '../../../components/assets/AssetTypeIcon';
import BarcodeCapture from '../../../components/barcode/BarcodeCapture';
import {CheckCircle2, ScanBarcode, UserRoundCheck} from 'lucide-react';
import {tr, trData} from '../../../i18n';
import HandoverSignature from '../HandoverSignature';
import type {SterilizationPageState} from '../useSterilizationPage';

export default function DeliveryBatchModal({s}: {s: SterilizationPageState}) {
  const {
    addBarcodeToDelivery,
    closeDeliveryBatch,
    completeDeliveryBatch,
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
    selectDeliveryDepartment,
    setDeliveryBatchReceiver,
    toggleAllDeliveryDepartment,
    toggleDeliveryAsset,
  } = s;
  const [picked, setPicked] = useState('');
  // A new batch starts with no department picked.
  useEffect(() => {
    if (!deliveryBatchOpen) setPicked('');
  }, [deliveryBatchOpen]);
  // The delivery's department once something is in it; until then the one picked from the list (or none).
  const department = deliveryBatchDepartment || picked;
  const forDepartment = ready.filter(item => item.department === department);
  const shown = department ? forDepartment : ready;
  return (
    <>
      {deliveryBatchOpen && (
        <div className="modal-backdrop" onMouseDown={closeDeliveryBatch}>
          <div
            className="receipt-card-modal workflow-modal delivery-batch-modal"
            onMouseDown={e => e.stopPropagation()}
          >
            <div className="workflow-modal-head">
              <div className="ster-kind set">
                <ScanBarcode size={20} />
              </div>
              <div className="workflow-modal-title">
                <h2>{tr('Μαζική παράδοση')}</h2>
              </div>
            </div>
            <div className="delivery-batch-body">
              <BarcodeCapture feedback={deliveryScanFeedback} onBarcode={addBarcodeToDelivery} suggest={ready} />
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
                  </div>
                  <BatchDepartmentPicker
                    departments={departmentsOf(ready)}
                    value={department}
                    locked={!!deliveryBatchDepartment}
                    allSelected={
                      !!forDepartment.length &&
                      forDepartment.every(item => deliverySelected.has(`${item.kind}:${item.id}`))
                    }
                    onPick={setPicked}
                    onSelectAll={() => selectDeliveryDepartment(department)}
                    onClear={() => {
                      toggleAllDeliveryDepartment();
                      setPicked('');
                    }}
                  />
                  <div className="delivery-batch-list">
                    {shown.map(item => {
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
                              {lastLoad ? loadLabel(lastLoad) : tr('Αποδεσμευμένο μεμονωμένα')}
                              {incompatible ? tr(' · Άλλο τμήμα') : ''}
                            </small>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </section>
                <section className="delivery-batch-confirm">
                  <section className="delivery-auth">
                    <HandoverSignature
                      label={tr('Υπογραφή παραλαμβάνοντα')}
                      department={deliveryBatchDepartment}
                      disabled={!deliveryBatchDepartment}
                      signer={deliveryBatchReceiver}
                      assetIds={deliverySelectedAssets.map(item => item.id)}
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
