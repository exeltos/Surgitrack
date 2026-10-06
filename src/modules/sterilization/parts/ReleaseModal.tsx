import StatusBadge from '../../../components/ui/StatusBadge';
import {CheckCircle2, TriangleAlert, Box, Stethoscope, X, ShieldCheck, Clock3} from 'lucide-react';
import {tr} from '../../../i18n';
import type {SterilizationPageState} from '../useSterilizationPage';

export default function ReleaseModal({s}: {s: SterilizationPageState}) {
  const {
    biologicalIndicatorResult,
    closeRelease,
    completeRelease,
    latestPassedCycle,
    releaseChecks,
    releaseDraft,
    releaseNote,
    releaseReady,
    setBiologicalIndicatorResult,
    setReleaseChecks,
    setReleaseNote,
  } = s;
  return (
    <>
      {releaseDraft && (
        <div className="modal-backdrop" onMouseDown={closeRelease}>
          <div
            className="receipt-card-modal workflow-modal workflow-modal-cycle"
            onMouseDown={e => e.stopPropagation()}
          >
            <button className="modal-x" aria-label={tr('Κλείσιμο')} title={tr('Κλείσιμο')} onClick={closeRelease}>
              <X size={18} />
            </button>
            <div className="workflow-modal-head">
              <div className={`ster-kind ${releaseDraft.kind.toLowerCase()}`}>
                {releaseDraft.kind === 'SET' ? <Box size={20} /> : <Stethoscope size={20} />}
              </div>
              <div className="workflow-modal-title">
                <span className="eyebrow">{tr('QUALITY GATE · ΑΠΟΔΕΣΜΕΥΣΗ')}</span>
                <h2>
                  {releaseDraft.asset.barcode} · {releaseDraft.asset.name}
                </h2>
                <p>{tr('Τεκμηριωμένος τελικός έλεγχος πριν χαρακτηριστεί έτοιμο για παράδοση.')}</p>
              </div>
              <StatusBadge value={releaseDraft.asset.state} />
            </div>
            <div className="workflow-modal-body">
              {(() => {
                const cycle = latestPassedCycle(releaseDraft.asset.id);
                return cycle ? (
                  <div className="cycle-clean-summary">
                    <div>
                      <span>{tr('Κλίβανος')}</span>
                      <strong>{cycle.sterilizer}</strong>
                    </div>
                    <div>
                      <span>{tr('Κύκλος / φορτίο')}</span>
                      <strong>{cycle.cycleNumber}</strong>
                    </div>
                    <div>
                      <span>{tr('Πρόγραμμα')}</span>
                      <strong>{cycle.program}</strong>
                    </div>
                    <div>
                      <span>{tr('Ολοκληρώθηκε από')}</span>
                      <strong>{cycle.completedByName}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="cycle-result-warning">
                    <TriangleAlert size={18} />
                    <div>
                      <strong>{tr('Δεν βρέθηκε επιτυχής κύκλος')}</strong>
                      <span>{tr('Η αποδέσμευση δεν μπορεί να ολοκληρωθεί.')}</span>
                    </div>
                  </div>
                );
              })()}
              <section className="release-check-card">
                <div className="receipt-section-title">
                  <div>
                    <strong>{tr('Έλεγχοι αποδέσμευσης')}</strong>
                    <span>{tr('Οι κρίσιμοι έλεγχοι πρέπει να επιβεβαιωθούν πριν την αποδέσμευση.')}</span>
                  </div>
                  <ShieldCheck size={18} />
                </div>
                <label className="release-check-row">
                  <input
                    type="checkbox"
                    checked={releaseChecks.physicalParametersOk}
                    onChange={e => setReleaseChecks(v => ({...v, physicalParametersOk: e.target.checked}))}
                  />
                  <span>
                    <strong>{tr('Παράμετροι κύκλου / φυσική καταγραφή')}</strong>
                    <small>{tr('Ελέγχθηκαν τα καταγεγραμμένα στοιχεία του κύκλου και είναι αποδεκτά.')}</small>
                  </span>
                </label>
                <label className="release-check-row">
                  <input
                    type="checkbox"
                    checked={releaseChecks.chemicalIndicatorOk}
                    onChange={e => setReleaseChecks(v => ({...v, chemicalIndicatorOk: e.target.checked}))}
                  />
                  <span>
                    <strong>{tr('Χημικός δείκτης αποδεκτός')}</strong>
                    <small>{tr('Το αποτέλεσμα συμφωνεί με τα κριτήρια της μονάδας.')}</small>
                  </span>
                </label>
                <label className="release-check-row">
                  <input
                    type="checkbox"
                    checked={releaseChecks.packagingIntegrityOk}
                    onChange={e => setReleaseChecks(v => ({...v, packagingIntegrityOk: e.target.checked}))}
                  />
                  <span>
                    <strong>{tr('Συσκευασία στεγνή και ακέραιη')}</strong>
                    <small>{tr('Δεν διαπιστώθηκε υγρασία, ρήξη ή άλλη απόκλιση του sterile barrier.')}</small>
                  </span>
                </label>
                <label className="release-biological">
                  {tr('Βιολογικός δείκτης')}
                  <select
                    value={biologicalIndicatorResult}
                    onChange={e =>
                      setBiologicalIndicatorResult(e.target.value as 'NOT_REQUIRED' | 'PASS' | 'PENDING' | 'FAIL')
                    }
                  >
                    <option value="NOT_REQUIRED">{tr('Δεν απαιτείται για τη συγκεκριμένη διαδικασία')}</option>
                    <option value="PASS">{tr('Αρνητικός / επιτυχής')}</option>
                    <option value="PENDING">{tr('Σε αναμονή αποτελέσματος')}</option>
                    <option value="FAIL">{tr('Θετικός / αποτυχία')}</option>
                  </select>
                </label>
              </section>
              {biologicalIndicatorResult === 'FAIL' ? (
                <div className="cycle-result-warning">
                  <TriangleAlert size={18} />
                  <div>
                    <strong>{tr('Δεν επιτρέπεται αποδέσμευση')}</strong>
                    <span>
                      {tr('Καταχώρησε επανεπεξεργασία και ακολούθησε τη διαδικασία διερεύνησης της μονάδας.')}
                    </span>
                  </div>
                </div>
              ) : releaseReady ? (
                <div className="cycle-result-ok">
                  <CheckCircle2 size={18} />
                  <div>
                    <strong>{tr('Έτοιμο για αποδέσμευση')}</strong>
                    <span>{tr('Οι απαιτούμενοι έλεγχοι έχουν επιβεβαιωθεί.')}</span>
                  </div>
                </div>
              ) : (
                <div className="release-pending">
                  <Clock3 size={18} />
                  <div>
                    <strong>{tr('Εκκρεμεί τελικός έλεγχος')}</strong>
                    <span>{tr('Η εγγραφή παραμένει σε αναμονή αποδέσμευσης.')}</span>
                  </div>
                </div>
              )}
              <label className="cycle-note">
                {tr('Παρατήρηση αποδέσμευσης')}
                <textarea
                  value={releaseNote}
                  onChange={e => setReleaseNote(e.target.value)}
                  placeholder={tr('Προαιρετική παρατήρηση ή αιτιολογία επανεπεξεργασίας…')}
                />
              </label>
            </div>
            <div className="modal-actions workflow-modal-actions release-actions">
              <button onClick={closeRelease}>{tr('Ακύρωση')}</button>
              <button className="release-reprocess" onClick={() => completeRelease('REPROCESS')}>
                <TriangleAlert size={16} /> {tr('Μη αποδέσμευση · Επανεπεξεργασία')}
              </button>
              <button
                className="primary"
                disabled={!releaseReady || !latestPassedCycle(releaseDraft.asset.id)}
                onClick={() => completeRelease('RELEASED')}
              >
                <ShieldCheck size={16} /> {tr('Αποδέσμευση προς παράδοση')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
