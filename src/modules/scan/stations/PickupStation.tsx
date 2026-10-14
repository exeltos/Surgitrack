import {useState} from 'react';
import {TriangleAlert} from 'lucide-react';
import type {BarcodeFeedback} from '../../../components/barcode/BarcodeCapture';
import type {HandoverSigner} from '../../../data/cloud/handover';
import {tr, trData} from '../../../i18n';
import {useSurgi} from '../../../store/SurgiStore';
import HandoverSignature from '../../sterilization/HandoverSignature';
import type {SterilizationRow} from '../../sterilization/sterilizationTypes';
import {departmentOf, findScanned} from '../findScanned';
import ScanCamera from '../ScanCamera';
import {ScanDone, ScanItemList, ScanRefused, ScanScreen} from '../ScanParts';
import {useScanAnswers} from '../useScanAnswers';

/** The role the handover check gives Sterilization staff (verify-handover). */
const STERILIZATION_ROLE = 'Αποστείρωση';

/**
 * Pickup at the department: the department scans the sterile Sets and instruments brought from Sterilization,
 * and the Sterilization person who brought them signs on the same phone with their own code and password. The
 * same handover as «Παράδοση» on the Sterilization side, recorded from the department's side.
 */
export default function PickupStation({onStations}: {onStations: () => void}) {
  const {sets, tools, currentUser, completeDeliveryToDepartment} = useSurgi();
  const [items, setItems] = useState<SterilizationRow[]>([]);
  const [feedback, setFeedback] = useState<BarcodeFeedback | null>(null);
  const [step, setStep] = useState<'SCAN' | 'CONFIRM' | 'DONE'>('SCAN');
  const [signer, setSigner] = useState<HandoverSigner | null>(null);
  const [note, setNote] = useState('');
  const [received, setReceived] = useState(0);
  const answers = useScanAnswers(feedback);
  const signerFits = !!signer && signer.role === STERILIZATION_ROLE;

  const scan = (barcode: string) => {
    const item = findScanned(barcode, sets, tools);
    if (!item) {
      setFeedback({type: 'ERROR', message: tr('{0} δεν βρέθηκε στο μητρώο.', barcode)});
      return;
    }
    const label = `${item.asset.barcode} · ${item.asset.name}`;
    const refuse = (message: string) => setFeedback({type: 'ERROR', message});
    if (departmentOf(item, sets) !== currentUser.department) return refuse(tr('{0}: ανήκει σε άλλο τμήμα.', label));
    if (item.kind === 'TOOL' && item.asset.setId) return refuse(tr('{0}: ανήκει σε Σετ · σκανάρετε το Σετ.', label));
    if (item.asset.state !== 'READY_FOR_PICKUP') return refuse(tr('{0}: δεν είναι έτοιμο για παραλαβή.', label));
    if (items.some(row => row.id === item.asset.id)) return refuse(tr('{0}: έχει ήδη σκαναριστεί.', label));
    setItems(list => [...list, {...item.asset, kind: item.kind} as SterilizationRow]);
    setFeedback({type: 'OK', message: label});
  };

  const complete = () => {
    if (!signer || !signerFits || !items.length) return;
    const batchId = `pickup-${Date.now()}`;
    const done = items.filter(item =>
      completeDeliveryToDepartment(item.kind, item.id, {
        batchId,
        handoverSignatureId: signer.signatureId,
        receivedByUserId: currentUser.id,
        receivedByName: currentUser.name,
        receivedByDepartment: currentUser.department || '',
        deliveredBy: {userId: signer.userId, name: signer.name, department: signer.department},
        note: note.trim() || undefined,
      }),
    );
    setReceived(done.length);
    setItems(list => list.filter(item => !done.includes(item)));
    if (done.length) setStep('DONE');
  };

  if (step === 'DONE')
    return (
      <ScanScreen title={tr('Παραλαβή')} backLabel={tr('Αρχική')} onBack={onStations}>
        <ScanDone
          title={tr('Η παραλαβή καταγράφηκε')}
          text={tr('{0} αντικείμενα παραλήφθηκαν στο {1}.', received, trData(currentUser.department))}
          again={tr('Νέα παραλαβή')}
          onAgain={() => {
            setItems([]);
            setSigner(null);
            setNote('');
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
        title={tr('Ολοκλήρωση παραλαβής')}
        subtitle={trData(currentUser.department)}
        backLabel={tr('Σάρωση')}
        onBack={() => setStep('SCAN')}
        footer={
          <button type="button" className="scan-primary" disabled={!items.length || !signerFits} onClick={complete}>
            {tr('Ολοκλήρωση παραλαβής · {0}', items.length)}
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
            <dd>{tr('Κεντρική Αποστείρωση')}</dd>
          </div>
          <div>
            <dt>{tr('Παραλαμβάνει')}</dt>
            <dd>{trData(currentUser.name)}</dd>
          </div>
        </dl>
        <section className="scan-sign">
          <HandoverSignature
            label={tr('Υπογραφή υπαλλήλου Αποστείρωσης (κωδικός χρήστη + συνθηματικό)')}
            department="Κεντρική Αποστείρωση"
            signer={signer}
            assetIds={items.map(item => item.id)}
            onSigned={setSigner}
          />
          {signer && !signerFits && (
            <div className="identity-warning">
              <TriangleAlert size={15} />
              <span>{tr('Υπογράφει ο υπάλληλος της Αποστείρωσης που φέρνει τα αντικείμενα.')}</span>
            </div>
          )}
        </section>
        <label className="scan-field">
          {tr('Παρατήρηση παραλαβής')}
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={tr('Προαιρετική παρατήρηση για ολόκληρη την παραλαβή…')}
          />
        </label>
      </ScanScreen>
    );

  return (
    <ScanScreen
      title={tr('Παραλαβή από Αποστείρωση')}
      subtitle={tr('Σκανάρετε τα αποστειρωμένα Σετ και εργαλεία που φτάνουν στο τμήμα.')}
      backLabel={tr('Αρχική')}
      onBack={onStations}
      footer={
        <button type="button" className="scan-primary" disabled={!items.length} onClick={() => setStep('CONFIRM')}>
          {tr('Συνέχεια · {0}', items.length)}
        </button>
      }
    >
      <ScanCamera onBarcode={scan} feedback={feedback} />
      <div className="scan-count">
        <span>{tr('Σαρωμένα')}</span>
        <b>{items.length}</b>
      </div>
      <ScanRefused messages={answers.refused} />
      <ScanItemList
        items={items}
        onRemove={item => setItems(list => list.filter(row => row.id !== item.id))}
        empty={tr('Σκανάρετε ό,τι είναι «Έτοιμο για παραλαβή» για το τμήμα σας.')}
      />
    </ScanScreen>
  );
}
