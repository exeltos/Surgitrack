import {useEffect, useRef, useState} from 'react';
import {CheckCircle2, ChevronRight, Flame, ShieldCheck, TriangleAlert} from 'lucide-react';
import type {BarcodeFeedback} from '../../../components/barcode/BarcodeCapture';
import {askConfirm} from '../../../components/ui/confirmService';
import {loadLabel} from '../../../core/loadLabel';
import {tr, trData} from '../../../i18n';
import {useSterilizationPage} from '../../sterilization/useSterilizationPage';
import ScanCamera from '../ScanCamera';
import {ScanScreen} from '../ScanParts';
import {useScanAnswers} from '../useScanAnswers';

/**
 * Release: the loads in the sterilizer (the end of the cycle) and those waiting for release. Scanning any
 * Set or instrument of a load opens it; the checks and indicators are those of «Αποδέσμευση φορτίου».
 */
export default function ReleaseStation({onStations}: {onStations: () => void}) {
  const s = useSterilizationPage();
  const [feedback, setFeedback] = useState<BarcodeFeedback | null>(null);
  useScanAnswers(feedback);
  const load = s.selectedReleaseLoad;
  const canCycle = s.can('sterilization.cycle');
  // What to say once the decision is recorded (the release closes); when it stays open the store said why.
  const decided = useRef<BarcodeFeedback | null>(null);
  useEffect(() => {
    if (!s.releaseLoadId && decided.current) {
      setFeedback(decided.current);
      decided.current = null;
    }
  }, [s.releaseLoadId]);

  const scan = (barcode: string) => {
    const has = (l: (typeof s.processLoads)[number]) => l.items.some(item => item.barcode.toUpperCase() === barcode);
    const awaiting = s.awaitingLoads.find(has);
    if (awaiting) {
      setFeedback({type: 'OK', message: tr('{0} · {1}', barcode, loadLabel(awaiting))});
      s.openLoadRelease(awaiting.id);
      return;
    }
    const running = s.runningLoads.find(has);
    setFeedback(
      running
        ? {
            type: 'WARN',
            message: tr(
              '{0} είναι στον κλίβανο ({1}): πατήστε «Τέλος κύκλου» όταν τελειώσει.',
              barcode,
              loadLabel(running),
            ),
          }
        : {type: 'ERROR', message: tr('{0} δεν ανήκει σε φορτίο που περιμένει αποδέσμευση.', barcode)},
    );
  };

  if (load) {
    const chemPlanned = load.chemicalIndicatorResult !== undefined;
    const biPlanned = load.biologicalIndicatorResult === 'PENDING';
    const showChem = chemPlanned || !biPlanned;
    const showBi = biPlanned || !chemPlanned;
    const finish = (decision: 'RELEASED' | 'REPROCESS') => {
      decided.current = {
        type: decision === 'RELEASED' ? 'OK' : 'WARN',
        message:
          decision === 'RELEASED'
            ? tr('{0}: αποδεσμεύτηκε ({1} αντικείμενα).', loadLabel(load), load.items.length)
            : tr('{0}: επιστρέφει σε επανεπεξεργασία.', loadLabel(load)),
      };
      s.completeLoadRelease(decision);
    };
    return (
      <ScanScreen
        title={loadLabel(load)}
        subtitle={`${load.program} · ${tr('{0} αντικείμενα', load.items.length)}`}
        backLabel={tr('Φορτία')}
        onBack={s.closeLoadRelease}
        footer={
          <div className="scan-foot-pair">
            <button
              type="button"
              className="scan-danger"
              onClick={() =>
                void askConfirm({
                  title: tr('Μη αποδέσμευση · όλο το φορτίο'),
                  message: tr('Όλο το φορτίο ({0} αντικείμενα) θα επιστρέψει σε επανεπεξεργασία.', load.items.length),
                  confirmLabel: tr('Μη αποδέσμευση'),
                  danger: true,
                }).then(sure => sure !== false && finish('REPROCESS'))
              }
            >
              <TriangleAlert size={17} /> {tr('Μη αποδέσμευση')}
            </button>
            <button
              type="button"
              className="scan-primary"
              disabled={!s.releaseLoadReady}
              onClick={() => finish('RELEASED')}
            >
              <ShieldCheck size={17} /> {tr('Αποδέσμευση')}
            </button>
          </div>
        }
      >
        <section className="scan-checks">
          <label>
            <input
              type="checkbox"
              checked={s.releaseLoadChecks.physicalParametersOk}
              onChange={e => s.setReleaseLoadChecks(v => ({...v, physicalParametersOk: e.target.checked}))}
            />
            {tr('Φυσικές παράμετροι κύκλου αποδεκτές')}
          </label>
          <label>
            <input
              type="checkbox"
              checked={s.releaseLoadChecks.packagingIntegrityOk}
              onChange={e => s.setReleaseLoadChecks(v => ({...v, packagingIntegrityOk: e.target.checked}))}
            />
            {tr('Συσκευασίες στεγνές και ακέραιες')}
          </label>
        </section>
        {showChem && (
          <label className="scan-field">
            {tr('Χημικός δείκτης')}
            <select
              value={s.releaseLoadChem}
              onChange={e => s.setReleaseLoadChem(e.target.value as 'PASS' | 'FAIL' | 'NOT_RECORDED')}
            >
              <option value="NOT_RECORDED">{tr('Δεν έγινε')}</option>
              <option value="PASS">{tr('Επιτυχής')}</option>
              <option value="FAIL">{tr('Ανεπιτυχής')}</option>
            </select>
          </label>
        )}
        {showBi && (
          <label className="scan-field">
            {tr('Βιολογικός δείκτης')}
            <select
              value={s.releaseLoadBi}
              onChange={e => s.setReleaseLoadBi(e.target.value as 'NOT_REQUIRED' | 'PASS' | 'PENDING' | 'FAIL')}
            >
              <option value="NOT_REQUIRED">{tr('Δεν έγινε')}</option>
              <option value="PASS">{tr('Επιτυχής')}</option>
              <option value="PENDING">{tr('Σε αναμονή')}</option>
              <option value="FAIL">{tr('Ανεπιτυχής')}</option>
            </select>
          </label>
        )}
        <p className={`scan-verdict${s.releaseVerdict.ok ? ' ok' : ''}`}>
          {s.releaseVerdict.ok
            ? tr('Οι δείκτες επιτρέπουν την αποδέσμευση.')
            : s.releaseVerdict.reason === 'FAILED'
              ? tr('Ανεπιτυχής δείκτης: το φορτίο δεν αποδεσμεύεται, επιστρέφει σε επανεπεξεργασία.')
              : s.releaseVerdict.reason === 'CHEMICAL_REQUIRED'
                ? tr('Η μονάδα απαιτεί επιτυχή χημικό δείκτη.')
                : s.releaseVerdict.reason === 'BIOLOGICAL_REQUIRED'
                  ? tr('Η μονάδα απαιτεί επιτυχή βιολογικό δείκτη.')
                  : tr('Αρκεί ένας από τους δύο δείκτες: συμπλήρωσε τουλάχιστον έναν ως επιτυχή.')}
        </p>
        <label className="scan-field">
          {tr('Παρατήρηση αποδέσμευσης')}
          <textarea
            value={s.releaseLoadNote}
            onChange={e => s.setReleaseLoadNote(e.target.value)}
            placeholder={tr('Προαιρετική παρατήρηση / αιτιολογία…')}
          />
        </label>
        <ul className="scan-items compact" aria-label={tr('Περιεχόμενο φορτίου')}>
          {load.items.map(item => (
            <li key={`${item.assetKind}:${item.assetId}`}>
              <span>
                <b>
                  <span className="mono">{item.barcode}</span> · {item.assetName}
                </b>
                <small>{trData(item.department)}</small>
              </span>
            </li>
          ))}
        </ul>
      </ScanScreen>
    );
  }

  return (
    <ScanScreen
      title={tr('Αποδέσμευση')}
      subtitle={tr('Σκανάρετε ένα αντικείμενο του φορτίου ή επιλέξτε το φορτίο.')}
      backLabel={tr('Σταθμοί')}
      onBack={onStations}
    >
      <ScanCamera onBarcode={scan} feedback={feedback} />
      <h2 className="scan-section">
        {tr('Αναμονή αποδέσμευσης')} <span>{s.awaitingLoads.length}</span>
      </h2>
      {s.awaitingLoads.length ? (
        <ul className="scan-loads">
          {s.awaitingLoads.map(l => (
            <li key={l.id}>
              <button type="button" onClick={() => s.openLoadRelease(l.id)}>
                <ShieldCheck size={20} />
                <span>
                  <b>{loadLabel(l)}</b>
                  <small>
                    {l.program} · {tr('{0} αντικείμενα', l.items.length)}
                  </small>
                </span>
                <ChevronRight size={18} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="scan-empty">{tr('Κανένα φορτίο δεν περιμένει αποδέσμευση.')}</p>
      )}
      <h2 className="scan-section">
        {tr('Στον κλίβανο')} <span>{s.runningLoads.length}</span>
      </h2>
      {s.runningLoads.length ? (
        <ul className="scan-loads">
          {s.runningLoads.map(l => (
            <li key={l.id} className="running">
              <div>
                <Flame size={20} />
                <span>
                  <b>{loadLabel(l)}</b>
                  <small>
                    {l.program} · {tr('{0} αντικείμενα', l.items.length)}
                  </small>
                </span>
              </div>
              {canCycle && (
                <div className="scan-load-actions">
                  <button
                    type="button"
                    className="scan-danger"
                    onClick={() =>
                      void askConfirm({
                        title: tr('Αποτυχία κύκλου;'),
                        message: tr(
                          'Όλο το φορτίο ({0} αντικείμενα) θα επιστρέψει σε επανεπεξεργασία. Η ενέργεια καταγράφεται στο ιστορικό.',
                          l.items.length,
                        ),
                        confirmLabel: tr('Αποτυχία κύκλου'),
                        danger: true,
                      }).then(sure => sure !== false && s.finishProcessLoad(l.id, 'FAILED'))
                    }
                  >
                    <TriangleAlert size={16} /> {tr('Αποτυχία κύκλου')}
                  </button>
                  <button type="button" className="scan-primary" onClick={() => s.finishProcessLoad(l.id, 'PASSED')}>
                    <CheckCircle2 size={16} /> {tr('Τέλος κύκλου · {0}', l.items.length)}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="scan-empty">{tr('Κανένας κλίβανος σε λειτουργία')}</p>
      )}
    </ScanScreen>
  );
}
