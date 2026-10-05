import {TriangleAlert, X, ShieldCheck} from 'lucide-react';
import {tr, trData} from '../../../i18n';
import type {SterilizationPageState} from '../useSterilizationPage';

export default function ReleaseLoadModal({s}: {s: SterilizationPageState}) {
  const {
    closeLoadRelease,
    completeLoadRelease,
    releaseLoadBi,
    releaseLoadChecks,
    releaseLoadNote,
    releaseLoadReady,
    selectedReleaseLoad,
    setReleaseLoadBi,
    setReleaseLoadChecks,
    setReleaseLoadNote,
  } = s;
  return (
    <>
      {selectedReleaseLoad && (
        <div className="modal-backdrop" onMouseDown={closeLoadRelease}>
          <div className="receipt-card-modal workflow-modal load-release-modal" onMouseDown={e => e.stopPropagation()}>
            <button className="modal-x" aria-label={tr('Κλείσιμο')} title={tr('Κλείσιμο')} onClick={closeLoadRelease}>
              <X size={18} />
            </button>
            <div className="workflow-modal-head">
              <div className="ster-kind set">
                <ShieldCheck size={20} />
              </div>
              <div className="workflow-modal-title">
                <span className="eyebrow">{tr('QUALITY GATE · ΑΠΟΔΕΣΜΕΥΣΗ ΦΟΡΤΙΟΥ')}</span>
                <h2>
                  {selectedReleaseLoad.id} · {selectedReleaseLoad.equipment}
                </h2>
                <p>
                  {tr('Κύκλος') + ' '}
                  {selectedReleaseLoad.cycleNumber} · {selectedReleaseLoad.program} · {selectedReleaseLoad.items.length}{' '}
                  {tr('αντικείμενα')}
                </p>
              </div>
            </div>
            <div className="workflow-modal-body">
              <section className="release-check-card">
                <div className="receipt-section-title">
                  <div>
                    <strong>{tr('Έλεγχοι φορτίου')}</strong>
                    <span>
                      {tr('Η απόφαση εφαρμόζεται σε όλα τα αντικείμενα που συνδέονται με το συγκεκριμένο φορτίο.')}
                    </span>
                  </div>
                  <ShieldCheck size={18} />
                </div>
                <label className="release-check-row">
                  <input
                    type="checkbox"
                    checked={releaseLoadChecks.physicalParametersOk}
                    onChange={e => setReleaseLoadChecks(v => ({...v, physicalParametersOk: e.target.checked}))}
                  />
                  <span>
                    <strong>{tr('Φυσικές παράμετροι κύκλου αποδεκτές')}</strong>
                  </span>
                </label>
                <label className="release-check-row">
                  <input
                    type="checkbox"
                    checked={releaseLoadChecks.chemicalIndicatorOk}
                    onChange={e => setReleaseLoadChecks(v => ({...v, chemicalIndicatorOk: e.target.checked}))}
                  />
                  <span>
                    <strong>{tr('Χημικός δείκτης αποδεκτός')}</strong>
                  </span>
                </label>
                <label className="release-check-row">
                  <input
                    type="checkbox"
                    checked={releaseLoadChecks.packagingIntegrityOk}
                    onChange={e => setReleaseLoadChecks(v => ({...v, packagingIntegrityOk: e.target.checked}))}
                  />
                  <span>
                    <strong>{tr('Συσκευασίες στεγνές και ακέραιες')}</strong>
                  </span>
                </label>
                <label className="release-biological">
                  {tr('Βιολογικός δείκτης')}
                  <select
                    value={releaseLoadBi}
                    onChange={e => setReleaseLoadBi(e.target.value as 'NOT_REQUIRED' | 'PASS' | 'PENDING' | 'FAIL')}
                  >
                    <option value="NOT_REQUIRED">{tr('Δεν απαιτείται βάσει πολιτικής / κύκλου')}</option>
                    <option value="PASS">{tr('Αρνητικός / επιτυχής')}</option>
                    <option value="PENDING">{tr('Σε αναμονή')}</option>
                    <option value="FAIL">{tr('Θετικός / αποτυχία')}</option>
                  </select>
                </label>
              </section>
              <div className="load-manifest">
                <strong>{tr('Manifest φορτίου')}</strong>
                {selectedReleaseLoad.items.map(item => (
                  <div key={`${item.assetKind}:${item.assetId}`}>
                    <span className="mono">{item.barcode}</span>
                    <b>{item.assetName}</b>
                    <small>{trData(item.department)}</small>
                  </div>
                ))}
              </div>
              <label className="cycle-note">
                {tr('Παρατήρηση αποδέσμευσης')}
                <textarea
                  value={releaseLoadNote}
                  onChange={e => setReleaseLoadNote(e.target.value)}
                  placeholder={tr('Προαιρετική παρατήρηση / αιτιολογία…')}
                />
              </label>
            </div>
            <div className="modal-actions workflow-modal-actions release-actions">
              <button onClick={closeLoadRelease}>{tr('Ακύρωση')}</button>
              <button className="release-reprocess" onClick={() => completeLoadRelease('REPROCESS')}>
                <TriangleAlert size={16} /> {tr('Μη αποδέσμευση · όλο το φορτίο')}
              </button>
              <button className="primary" disabled={!releaseLoadReady} onClick={() => completeLoadRelease('RELEASED')}>
                <ShieldCheck size={16} /> {tr('Αποδέσμευση φορτίου ·') + ' '}
                {selectedReleaseLoad.items.length}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
