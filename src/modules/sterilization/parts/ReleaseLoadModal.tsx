import {useEffect, useState} from 'react';
import {useHasModule} from '../../../data/cloud/modulesContext';
import {useTestDeviceSync} from '../../devices/useTestDeviceSync';
import {loadLabel} from '../../../core/loadLabel';
import {Activity, Printer, TriangleAlert, ShieldCheck} from 'lucide-react';
import {tr, trData} from '../../../i18n';
import type {SterilizationPageState} from '../useSterilizationPage';

/** Brings in the tests the connected test devices recorded, so a failure there stops the release (nothing shown). */
function TestDeviceSync() {
  useTestDeviceSync();
  return null;
}

export default function ReleaseLoadModal({s}: {s: SterilizationPageState}) {
  const withTests = useHasModule('EQUIPMENT_TESTS');
  const {
    closeLoadRelease,
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
    setReleaseLoadNote,
  } = s;
  // Sets or instruments failed one by one (a wet or torn pack): they go back, the rest is released.
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const loadId = selectedReleaseLoad?.id;
  useEffect(() => setFailed(new Set()), [loadId]);
  const toggleFailed = (key: string) =>
    setFailed(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const releasing = (selectedReleaseLoad?.items.length || 0) - failed.size;
  const chemPlanned = selectedReleaseLoad?.chemicalIndicatorResult !== undefined;
  const biPlanned = selectedReleaseLoad?.biologicalIndicatorResult === 'PENDING';
  const showChem = chemPlanned || !biPlanned;
  const showBi = biPlanned || !chemPlanned;
  return (
    <>
      {selectedReleaseLoad && (
        <div className="modal-backdrop" onMouseDown={closeLoadRelease}>
          <div className="receipt-card-modal workflow-modal load-release-modal" onMouseDown={e => e.stopPropagation()}>
            {withTests && <TestDeviceSync />}
            <div className="workflow-modal-head">
              <div className="ster-kind set">
                <ShieldCheck size={20} />
              </div>
              <div className="workflow-modal-title">
                <h2>{tr('Αποδέσμευση · {0}', loadLabel(selectedReleaseLoad))}</h2>
                <p>
                  {selectedReleaseLoad.program} · {selectedReleaseLoad.items.length} {tr('αντικείμενα')}
                </p>
              </div>
            </div>
            <div className="workflow-modal-body">
              {/* Left the checks and the note (it takes what is left), right the sterilizer's tests and the load's
                  content (its list scrolls): each column on its own, so neither leaves a gap in the other. */}
              <div className="release-col">
                <section className="release-check-card">
                  <div className="receipt-section-title">
                    <div>
                      <strong>{tr('Έλεγχοι φορτίου')}</strong>
                    </div>
                    <ShieldCheck size={18} />
                  </div>
                  <div className="release-check-pair">
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
                  </div>
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
                          onChange={e =>
                            setReleaseLoadBi(e.target.value as 'NOT_REQUIRED' | 'PASS' | 'PENDING' | 'FAIL')
                          }
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
                <label className="cycle-note">
                  {tr('Παρατήρηση αποδέσμευσης')}
                  <textarea
                    value={releaseLoadNote}
                    onChange={e => setReleaseLoadNote(e.target.value)}
                    placeholder={tr('Προαιρετική παρατήρηση / αιτιολογία…')}
                  />
                </label>
              </div>
              <div className="release-col">
                <div className="load-manifest">
                  <strong>
                    {tr('Περιεχόμενο φορτίου')}
                    {failed.size > 0 && <em className="release-failed-count">{tr('Αποτυχία: {0}', failed.size)}</em>}
                  </strong>
                  {selectedReleaseLoad.items.map(item => {
                    const key = `${item.assetKind}:${item.assetId}`;
                    const isFailed = failed.has(key);
                    return (
                      <div key={key} className={isFailed ? 'failed' : ''}>
                        <span className="mono">{item.barcode}</span>
                        <b>{item.assetName}</b>
                        <small>{trData(item.department)}</small>
                        <button
                          type="button"
                          className={`release-item-fail${isFailed ? ' on' : ''}`}
                          aria-pressed={isFailed}
                          onClick={() => toggleFailed(key)}
                        >
                          {isFailed ? tr('Αποτυχία ✓') : tr('Αποτυχία')}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="modal-actions workflow-modal-actions release-actions">
              <button onClick={closeLoadRelease}>{tr('Ακύρωση')}</button>
              <button
                className="release-print"
                onClick={() => s.printLoadForm(selectedReleaseLoad.id, true, [...failed])}
              >
                <Printer size={16} /> {tr('Έντυπο')}
              </button>
              {selectedReleaseLoad.cycleData && (
                <button className="release-print" onClick={() => s.printCycle(selectedReleaseLoad.id)}>
                  <Activity size={16} /> {tr('Report κύκλου')}
                </button>
              )}
              <button className="release-reprocess" onClick={() => completeLoadRelease('REPROCESS')}>
                <TriangleAlert size={16} /> {tr('Απόρριψη φορτίου')}
              </button>
              <button
                className="primary"
                disabled={!releaseLoadReady || releasing <= 0}
                onClick={() => completeLoadRelease('RELEASED', [...failed])}
              >
                <ShieldCheck size={16} /> {tr('Αποδέσμευση φορτίου ·') + ' '}
                {releasing}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
