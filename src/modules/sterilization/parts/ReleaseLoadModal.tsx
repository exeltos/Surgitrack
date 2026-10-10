import {loadLabel} from '../../../core/loadLabel';
import {Printer, TriangleAlert, X, ShieldCheck} from 'lucide-react';
import {tr, trData} from '../../../i18n';
import type {SterilizationPageState} from '../useSterilizationPage';

export default function ReleaseLoadModal({s}: {s: SterilizationPageState}) {
  const {
    closeLoadRelease,
    awaitingLoads,
    completeLoadRelease,
    releaseLoadBi,
    releaseLoadChecks,
    releaseLoadChem,
    releaseLoadNote,
    releaseVerdict,
    releaseLoadReady,
    selectedReleaseLoad,
    setReleaseLoadBi,
    setReleaseLoadChecks,
    setReleaseLoadChem,
    setReleaseLoadId,
    setReleaseLoadNote,
  } = s;
  const chemPlanned = selectedReleaseLoad?.chemicalIndicatorResult !== undefined;
  const biPlanned = selectedReleaseLoad?.biologicalIndicatorResult === 'PENDING';
  const showChem = chemPlanned || !biPlanned;
  const showBi = biPlanned || !chemPlanned;
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
                <h2>{loadLabel(selectedReleaseLoad)}</h2>
                <p>
                  {selectedReleaseLoad.program} · {selectedReleaseLoad.items.length} {tr('αντικείμενα')}
                </p>
              </div>
            </div>
            <div className="workflow-modal-body">
              {awaitingLoads.length > 1 && (
                <label className="release-load-picker">
                  {tr('Φορτίο / κλίβανος')}
                  <select value={selectedReleaseLoad.id} onChange={e => setReleaseLoadId(e.target.value)}>
                    {awaitingLoads.map(load => (
                      <option key={load.id} value={load.id}>
                        {loadLabel(load)} · {load.items.length} {tr('αντικείμενα')}
                      </option>
                    ))}
                  </select>
                </label>
              )}
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
                    checked={releaseLoadChecks.packagingIntegrityOk}
                    onChange={e => setReleaseLoadChecks(v => ({...v, packagingIntegrityOk: e.target.checked}))}
                  />
                  <span>
                    <strong>{tr('Συσκευασίες στεγνές και ακέραιες')}</strong>
                  </span>
                </label>
                <div className="release-indicators">
                  {showChem && (
                    <label>
                      {tr('Χημικός δείκτης')}
                      <select
                        value={releaseLoadChem}
                        onChange={e => setReleaseLoadChem(e.target.value as 'PASS' | 'FAIL' | 'NOT_RECORDED')}
                      >
                        <option value="NOT_RECORDED">{tr('Δεν έγινε')}</option>
                        <option value="PASS">{tr('Επιτυχής')}</option>
                        <option value="FAIL">{tr('Ανεπιτυχής')}</option>
                      </select>
                    </label>
                  )}
                  {showBi && (
                    <label>
                      {tr('Βιολογικός δείκτης')}
                      <select
                        value={releaseLoadBi}
                        onChange={e => setReleaseLoadBi(e.target.value as 'NOT_REQUIRED' | 'PASS' | 'PENDING' | 'FAIL')}
                      >
                        <option value="NOT_REQUIRED">{tr('Δεν έγινε')}</option>
                        <option value="PASS">{tr('Επιτυχής')}</option>
                        <option value="PENDING">{tr('Σε αναμονή')}</option>
                        <option value="FAIL">{tr('Ανεπιτυχής')}</option>
                      </select>
                    </label>
                  )}
                </div>
                <p className={`release-indicator-hint${releaseVerdict.ok ? ' ok' : ''}`}>
                  {releaseVerdict.ok
                    ? tr('Οι δείκτες επιτρέπουν την αποδέσμευση.')
                    : releaseVerdict.reason === 'FAILED'
                      ? tr('Ανεπιτυχής δείκτης: το φορτίο δεν αποδεσμεύεται, επιστρέφει σε επανεπεξεργασία.')
                      : releaseVerdict.reason === 'CHEMICAL_REQUIRED'
                        ? tr('Η μονάδα απαιτεί επιτυχή χημικό δείκτη.')
                        : releaseVerdict.reason === 'BIOLOGICAL_REQUIRED'
                          ? tr('Η μονάδα απαιτεί επιτυχή βιολογικό δείκτη.')
                          : tr('Αρκεί ένας από τους δύο δείκτες: συμπλήρωσε τουλάχιστον έναν ως επιτυχή.')}
                </p>
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
              <button className="release-print" onClick={() => s.printLoadForm(selectedReleaseLoad.id, true)}>
                <Printer size={16} /> {tr('Έντυπο')}
              </button>
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
