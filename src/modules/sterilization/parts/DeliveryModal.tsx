import StatusBadge from '../../../components/ui/StatusBadge';
import {CheckCircle2, Box, Stethoscope, UserRoundCheck, X, IdCard, UserCheck} from 'lucide-react';
import {tr, trData} from '../../../i18n';
import HandoverSignature from '../HandoverSignature';
import type {SterilizationPageState} from '../useSterilizationPage';

export default function DeliveryModal({s}: {s: SterilizationPageState}) {
  const {
    closeDelivery,
    completeDelivery,
    currentUser,
    deliveryDraft,
    deliveryNote,
    receiver,
    receiverMatches,
    setDeliveryNote,
    setReceiver,
  } = s;
  return (
    <>
      {deliveryDraft && (
        <div className="modal-backdrop" onMouseDown={closeDelivery}>
          <div
            className="receipt-card-modal workflow-modal workflow-modal-delivery"
            onMouseDown={e => e.stopPropagation()}
          >
            <button className="modal-x" aria-label={tr('Κλείσιμο')} title={tr('Κλείσιμο')} onClick={closeDelivery}>
              <X size={18} />
            </button>
            <div className="workflow-modal-head">
              <div className={`ster-kind ${deliveryDraft.kind.toLowerCase()}`}>
                {deliveryDraft.kind === 'SET' ? <Box size={20} /> : <Stethoscope size={20} />}
              </div>
              <div className="workflow-modal-title">
                <span className="eyebrow">{tr('ΠΑΡΑΔΟΣΗ ΣΤΟ ΤΜΗΜΑ')}</span>
                <h2>
                  {deliveryDraft.asset.barcode} · {deliveryDraft.asset.name}
                </h2>
                <p>
                  {tr('Κεντρική Αποστείρωση →') + ' '}
                  {trData(deliveryDraft.asset.department)}
                </p>
              </div>
              <StatusBadge value={deliveryDraft.asset.state} />
            </div>
            <div className="workflow-modal-body">
              <div className="delivery-pair">
                <div className="delivery-person confirmed">
                  <UserCheck size={19} />
                  <div>
                    <span>{tr('Παραδίδει')}</span>
                    <strong>{trData(currentUser.name)}</strong>
                    <small>{trData(currentUser.department)}</small>
                  </div>
                </div>
                <div className={`delivery-person ${receiver && receiverMatches ? 'confirmed' : ''}`}>
                  <IdCard size={19} />
                  <div>
                    <span>{tr('Παραλαμβάνει')}</span>
                    <strong>{receiver && receiverMatches ? receiver.name : tr('Αναμονή ταυτοποίησης')}</strong>
                    <small>{receiver && receiverMatches ? receiver.department : deliveryDraft.asset.department}</small>
                  </div>
                </div>
              </div>
              <section className="delivery-auth">
                <HandoverSignature
                  autoFocus
                  label={tr('Υπογραφή παραλαμβάνοντα (κωδικός χρήστη + συνθηματικό)')}
                  department={deliveryDraft.asset.department}
                  signer={receiver}
                  onSigned={setReceiver}
                />
                {receiver &&
                  (!receiverMatches ? (
                    <div className="identity-error">
                      {tr('Ο χρήστης ανήκει στο') + ' '}
                      {trData(receiver.department)}
                      {tr(', ενώ η παράδοση αφορά το')} {trData(deliveryDraft.asset.department)}.
                    </div>
                  ) : (
                    <div className="identity-result">
                      <CheckCircle2 size={17} />
                      <div>
                        <strong>{receiver.name}</strong>
                        <span>
                          {receiver.role} · {trData(receiver.department)}
                        </span>
                      </div>
                    </div>
                  ))}
              </section>
              <label className="cycle-note">
                {tr('Παρατήρηση παράδοσης')}
                <textarea
                  value={deliveryNote}
                  onChange={e => setDeliveryNote(e.target.value)}
                  placeholder={tr('Προαιρετική παρατήρηση…')}
                />
              </label>
            </div>
            <div className="modal-actions workflow-modal-actions">
              <button onClick={closeDelivery}>{tr('Ακύρωση')}</button>
              <button className="primary" disabled={!receiver || !receiverMatches} onClick={completeDelivery}>
                <UserRoundCheck size={16} /> {tr('Ολοκλήρωση παράδοσης / παραλαβής')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
