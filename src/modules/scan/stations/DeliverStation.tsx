import {useEffect, useRef, useState} from 'react';
import {TriangleAlert} from 'lucide-react';
import {tr, trData} from '../../../i18n';
import HandoverSignature from '../../sterilization/HandoverSignature';
import {useSterilizationPage} from '../../sterilization/useSterilizationPage';
import ScanCamera from '../ScanCamera';
import {DemoWaiting, ScanDone, ScanItemList, ScanRefused, ScanScreen} from '../ScanParts';
import {useScanAnswers} from '../useScanAnswers';

/**
 * Delivery to a department: scan what leaves (released, one department per round), then the person
 * receiving it signs with their own code and password. The same rules as «Μαζική παράδοση».
 */
export default function DeliverStation({onStations}: {onStations: () => void}) {
  const s = useSterilizationPage();
  const [step, setStep] = useState<'SCAN' | 'CONFIRM' | 'DONE'>('SCAN');
  const [delivered, setDelivered] = useState({count: 0, department: ''});
  const answers = useScanAnswers(s.deliveryScanFeedback);
  const items = s.deliverySelectedAssets;
  const department = s.deliveryBatchDepartment;
  const receiver = s.deliveryBatchReceiver;
  // Done once everything left (the round empties); what stayed is explained by the store (a toast).
  const submitted = useRef<{count: number; department: string} | null>(null);
  useEffect(() => {
    if (submitted.current && !items.length) {
      setDelivered(submitted.current);
      submitted.current = null;
      setStep('DONE');
    }
  }, [items.length]);

  if (step === 'DONE')
    return (
      <ScanScreen title={tr('Παράδοση')} backLabel={tr('Αρχική')} onBack={onStations}>
        <ScanDone
          title={tr('Η παράδοση καταγράφηκε')}
          text={tr('{0} αντικείμενα παραδόθηκαν στο {1}.', delivered.count, trData(delivered.department))}
          again={tr('Νέα παράδοση')}
          onAgain={() => {
            s.closeDeliveryBatch();
            answers.reset();
            setStep('SCAN');
          }}
          onStations={onStations}
        />
      </ScanScreen>
    );

  if (step === 'CONFIRM')
    return (
      <ScanScreen
        title={tr('Ολοκλήρωση παράδοσης')}
        subtitle={trData(department)}
        backLabel={tr('Σάρωση')}
        onBack={() => {
          submitted.current = null;
          setStep('SCAN');
        }}
        footer={
          <button
            type="button"
            className="scan-primary"
            disabled={!items.length || !s.deliveryBatchReceiverMatches}
            onClick={() => {
              submitted.current = {count: items.length, department};
              s.completeDeliveryBatch();
            }}
          >
            {tr('Ολοκλήρωση παράδοσης ·') + ' '}
            {items.length}
          </button>
        }
      >
        <dl className="scan-summary">
          <div>
            <dt>{tr('Αντικείμενα')}</dt>
            <dd>{items.length}</dd>
          </div>
          <div>
            <dt>{tr('Προς')}</dt>
            <dd>{trData(department)}</dd>
          </div>
          <div>
            <dt>{tr('Παραδίδει')}</dt>
            <dd>{trData(s.currentUser.name)}</dd>
          </div>
        </dl>
        <section className="scan-sign">
          <HandoverSignature
            label={tr('Υπογραφή παραλαμβάνοντα (κωδικός χρήστη + συνθηματικό)')}
            department={department}
            signer={receiver}
            assetIds={items.map(item => item.id)}
            onSigned={s.setDeliveryBatchReceiver}
          />
          {receiver && !s.deliveryBatchReceiverMatches && (
            <div className="identity-warning">
              <TriangleAlert size={15} />
              <span>
                {tr('Ο χρήστης ανήκει στο') + ' '}
                {trData(receiver.department)}
                {tr(', ενώ η παράδοση αφορά το')} {trData(department)}.
              </span>
            </div>
          )}
        </section>
        <label className="scan-field">
          {tr('Παρατήρηση παράδοσης')}
          <textarea
            value={s.deliveryBatchNote}
            onChange={e => s.setDeliveryBatchNote(e.target.value)}
            placeholder={tr('Προαιρετική παρατήρηση για ολόκληρη την παράδοση…')}
          />
        </label>
      </ScanScreen>
    );

  return (
    <ScanScreen
      title={tr('Παράδοση')}
      subtitle={
        department ? tr('Παράδοση προς {0}', trData(department)) : tr('Το πρώτο barcode ορίζει το τμήμα της παράδοσης.')
      }
      backLabel={tr('Αρχική')}
      onBack={onStations}
      footer={
        <button type="button" className="scan-primary" disabled={!items.length} onClick={() => setStep('CONFIRM')}>
          {tr('Συνέχεια · {0}', items.length)}
        </button>
      }
    >
      <ScanCamera onBarcode={s.addBarcodeToDelivery} feedback={s.deliveryScanFeedback} />
      <div className="scan-count">
        <span>{tr('Σαρωμένα')}</span>
        <b>{items.length}</b>
      </div>
      <ScanRefused messages={answers.refused} />
      <DemoWaiting
        items={s.ready.filter(
          item => !items.some(row => row.id === item.id) && (!department || item.department === department),
        )}
        onPick={s.addBarcodeToDelivery}
      />
      <ScanItemList
        items={items}
        onRemove={s.toggleDeliveryAsset}
        empty={tr('Σκανάρετε τα αποδεσμευμένα Σετ και εργαλεία που φεύγουν για το τμήμα.')}
      />
    </ScanScreen>
  );
}
