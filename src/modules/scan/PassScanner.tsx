import {useState} from 'react';
import type {BarcodeFeedback} from '../../components/barcode/BarcodeCapture';
import {passFromScan, verifyHandoverPass, type HandoverSigner} from '../../data/cloud/handover';
import {tr} from '../../i18n';
import ScanCamera from './ScanCamera';
import {useScanAnswers} from './useScanAnswers';

const REASON_TEXT = {
  invalid: 'Το QR δεν αναγνωρίστηκε.',
  invalid_pass: 'Το QR έληξε ή χρησιμοποιήθηκε. Ζητήστε να ανανεωθεί και σκανάρετε ξανά.',
  locked: 'Πολλές αποτυχημένες προσπάθειες. Δοκιμάστε ξανά σε 15 λεπτά.',
  same_user: 'Υπογράφει το άλλο πρόσωπο της παράδοσης, όχι ο συνδεδεμένος χρήστης.',
  unavailable: 'Η επιβεβαίωση δεν είναι διαθέσιμη. Ελέγξτε τη σύνδεση και δοκιμάστε ξανά.',
} as const;

/**
 * The other party of a handover signs by showing «Το QR μου» on their phone: scanned here, it confirms who
 * they are for these items, as their username and password would (which stay below it, for whoever has no
 * phone at hand).
 */
export default function PassScanner({
  assetIds,
  onSigned,
}: {
  assetIds: string[];
  onSigned: (signer: HandoverSigner) => void;
}) {
  const [feedback, setFeedback] = useState<BarcodeFeedback | null>(null);
  const [busy, setBusy] = useState(false);
  useScanAnswers(feedback);
  const scan = async (scanned: string) => {
    if (busy) return;
    const pass = passFromScan(scanned);
    if (!pass) {
      setFeedback({type: 'ERROR', message: tr('Σκανάρετε το QR από το κινητό του άλλου προσώπου («Το QR μου»).')});
      return;
    }
    setBusy(true);
    const result = await verifyHandoverPass(pass, assetIds);
    setBusy(false);
    if (result.ok) {
      setFeedback({type: 'OK', message: result.signer.name});
      onSigned(result.signer);
    } else setFeedback({type: 'ERROR', message: tr(REASON_TEXT[result.reason])});
  };
  return (
    <div className="scan-pass-scan">
      <span className="scan-pass-scan-label">{tr('Σάρωση QR του άλλου προσώπου')}</span>
      <ScanCamera onBarcode={code => void scan(code)} feedback={feedback} suggest={[]} />
    </div>
  );
}
