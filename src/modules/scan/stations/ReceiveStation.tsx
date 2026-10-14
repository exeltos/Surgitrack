import {useState} from 'react';
import {TriangleAlert} from 'lucide-react';
import {tr, trData} from '../../../i18n';
import HandoverSignature from '../../sterilization/HandoverSignature';
import {useSterilizationPage} from '../../sterilization/useSterilizationPage';
import ScanCamera from '../ScanCamera';
import {DemoWaiting, ScanDone, ScanItemList, ScanRefused, ScanScreen} from '../ScanParts';
import {useScanAnswers} from '../useScanAnswers';

/**
 * Receipt at Sterilization: scan what a department brings (one department per round), then the person
 * handing it over signs with their own code and password. The same rules as «Μαζική παραλαβή».
 */
export default function ReceiveStation({onStations}: {onStations: () => void}) {
  const s = useSterilizationPage();
  const [step, setStep] = useState<'SCAN' | 'CONFIRM' | 'DONE'>('SCAN');
  const [received, setReceived] = useState(0);
  const answers = useScanAnswers(s.receiptBatchScanFeedback);
  const items = s.receiptBatchAssets;
  const department = s.receiptBatchDepartment;
  const again = () => {
    s.closeReceiptBatch();
    answers.reset();
    setStep('SCAN');
  };

  if (step === 'DONE')
    return (
      <ScanScreen title={tr('Παραλαβή')} backLabel={tr('Αρχική')} onBack={onStations}>
        <ScanDone
          title={tr('Η παραλαβή καταγράφηκε')}
          text={tr('{0} αντικείμενα παρελήφθησαν στην Αποστείρωση.', received)}
          again={tr('Νέα παραλαβή')}
          onAgain={again}
          onStations={onStations}
        />
      </ScanScreen>
    );

  if (step === 'CONFIRM')
    return (
      <ScanScreen
        title={tr('Ολοκλήρωση παραλαβής')}
        subtitle={trData(department)}
        backLabel={tr('Σάρωση')}
        onBack={() => setStep('SCAN')}
        footer={
          <button
            type="button"
            className="scan-primary"
            disabled={!items.length || !s.receiptBatchIdentityValid}
            onClick={() => {
              const count = items.length;
              s.completeReceiptBatch();
              setReceived(count);
              setStep('DONE');
            }}
          >
            {tr('Ολοκλήρωση παραλαβής ·') + ' '}
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
            <dt>{tr('Από')}</dt>
            <dd>{trData(department)}</dd>
          </div>
          <div>
            <dt>{tr('Παραλαμβάνει')}</dt>
            <dd>{trData(s.currentUser.name)}</dd>
          </div>
        </dl>
        <section className="scan-sign">
          <HandoverSignature
            label={tr('Υπογραφή παραδίδοντα (κωδικός χρήστη + συνθηματικό)')}
            department={department}
            signer={s.receiptBatchDeliverer}
            assetIds={items.map(item => item.id)}
            onSigned={s.setReceiptBatchDeliverer}
          />
          {s.receiptBatchDeliverer && !s.receiptBatchDelivererMatches && (
            <div className="identity-mismatch-box">
              <div className="identity-warning">
                <TriangleAlert size={15} />
                <span>
                  {tr('Ο χρήστης ανήκει στο') + ' '}
                  {trData(s.receiptBatchDeliverer.department)}
                  {tr(', ενώ η παραλαβή αφορά το')} {trData(department)}.
                </span>
              </div>
              {s.receiptPolicy.allowCrossDepartmentHandover ? (
                <label>
                  {tr('Αιτιολόγηση εξαίρεσης')}
                  <textarea
                    value={s.receiptBatchMismatchReason}
                    onChange={e => s.setReceiptBatchMismatchReason(e.target.value)}
                    placeholder={tr('Υποχρεωτική αιτιολόγηση…')}
                  />
                </label>
              ) : (
                <div className="identity-error">{tr('Η πολιτική της μονάδας δεν επιτρέπει αυτή την εξαίρεση.')}</div>
              )}
            </div>
          )}
        </section>
        <label className="scan-field">
          {tr('Παρατήρηση παραλαβής')}
          <textarea
            value={s.receiptBatchNote}
            onChange={e => s.setReceiptBatchNote(e.target.value)}
            placeholder={tr('Προαιρετική κοινή παρατήρηση…')}
          />
        </label>
      </ScanScreen>
    );

  return (
    <ScanScreen
      title={tr('Παραλαβή')}
      subtitle={
        department ? tr('Παραλαβή από {0}', trData(department)) : tr('Το πρώτο barcode ορίζει το τμήμα της παραλαβής.')
      }
      backLabel={tr('Αρχική')}
      onBack={onStations}
      footer={
        <button type="button" className="scan-primary" disabled={!items.length} onClick={() => setStep('CONFIRM')}>
          {tr('Συνέχεια · {0}', items.length)}
        </button>
      }
    >
      <ScanCamera onBarcode={s.addBarcodeToReceiptBatch} feedback={s.receiptBatchScanFeedback} />
      <div className="scan-count">
        <span>{tr('Σαρωμένα')}</span>
        <b>{items.length}</b>
      </div>
      <ScanRefused messages={answers.refused} />
      <DemoWaiting
        items={s.incoming.filter(
          item => !items.some(row => row.id === item.id) && (!department || item.department === department),
        )}
        onPick={s.addBarcodeToReceiptBatch}
      />
      <ScanItemList
        items={items}
        onRemove={s.toggleReceiptBatchAsset}
        empty={tr('Σκανάρετε τα Σετ και τα εργαλεία που φέρνει το τμήμα.')}
      />
    </ScanScreen>
  );
}
