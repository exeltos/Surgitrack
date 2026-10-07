import StatusBadge from '../../../components/ui/StatusBadge';
import {CheckCircle2, PackageCheck, TriangleAlert, Box, Stethoscope, X} from 'lucide-react';
import {tr, trData} from '../../../i18n';
import DeviceCyclePicker from '../../devices/DeviceCyclePicker';
import {deviceNote} from '../sterilizationTypes';
import type {SterilizationPageState} from '../useSterilizationPage';

export default function CycleModal({s}: {s: SterilizationPageState}) {
  const {
    closeCycleCompletion,
    currentUser,
    cycleDraft,
    cycleNote,
    cycleNumber,
    cycleProgram,
    finishCycle,
    indicatorResult,
    setCycleNote,
    setCycleNumber,
    setCycleProgram,
    setIndicatorResult,
    setSterilizer,
    sterilizer,
    tools,
  } = s;
  return (
    <>
      {cycleDraft && (
        <div className="modal-backdrop" onMouseDown={closeCycleCompletion}>
          <div
            className="receipt-card-modal workflow-modal workflow-modal-cycle"
            onMouseDown={e => e.stopPropagation()}
          >
            <button
              className="modal-x"
              aria-label={tr('Κλείσιμο')}
              title={tr('Κλείσιμο')}
              onClick={closeCycleCompletion}
            >
              <X size={18} />
            </button>
            <div className="workflow-modal-head">
              <div className={`ster-kind ${cycleDraft.kind.toLowerCase()}`}>
                {cycleDraft.kind === 'SET' ? <Box size={20} /> : <Stethoscope size={20} />}
              </div>
              <div className="workflow-modal-title">
                <span className="eyebrow">{tr('ΑΠΟΣΤΕΙΡΩΣΗ · ΚΑΤΑΓΡΑΦΗ ΚΥΚΛΟΥ')}</span>
                <h2>
                  {cycleDraft.asset.barcode} · {cycleDraft.asset.name}
                </h2>
                <p>{tr('Καταχώρηση αποτελέσματος κύκλου. Η αποδέσμευση γίνεται σε ξεχωριστό quality gate.')}</p>
              </div>
              <StatusBadge value={cycleDraft.asset.state} />
            </div>
            <div className="workflow-modal-body">
              <div className="cycle-clean-summary">
                <div>
                  <span>{tr('Χειριστής')}</span>
                  <strong>{trData(currentUser.name)}</strong>
                </div>
                <div>
                  <span>{tr('Τμήμα')}</span>
                  <strong>{trData(cycleDraft.asset.department) || '—'}</strong>
                </div>
                <div>
                  <span>{cycleDraft.kind === 'SET' ? tr('Εργαλεία') : tr('Τύπος')}</span>
                  <strong>
                    {cycleDraft.kind === 'SET'
                      ? tools.filter(t => t.setId === cycleDraft.asset.id).length || cycleDraft.asset.actual || 0
                      : tr('Μεμονωμένο')}
                  </strong>
                </div>
                <div>
                  <span>{tr('Ώρα καταχώρησης')}</span>
                  <strong>{new Date().toLocaleString('el-GR', {dateStyle: 'short', timeStyle: 'short'})}</strong>
                </div>
              </div>
              <DeviceCyclePicker
                kind="STERILIZER"
                equipment={sterilizer}
                onPick={(reading, device) => {
                  setSterilizer(device.name);
                  setCycleNumber(reading.cycleNumber);
                  if (reading.program) setCycleProgram(reading.program);
                  if (reading.result === 'FAIL') setIndicatorResult('FAIL');
                  setCycleNote(note => note || deviceNote(reading));
                }}
              />
              <div className="cycle-clean-fields">
                <label>
                  {tr('Κλίβανος')}
                  <select value={sterilizer} onChange={e => setSterilizer(e.target.value)}>
                    {s.sterilizerNames.map(name => (
                      <option key={name} value={name}>
                        {trData(name)}
                      </option>
                    ))}
                    {!s.sterilizerNames.includes(sterilizer) && (
                      <option value={sterilizer}>{trData(sterilizer)}</option>
                    )}
                  </select>
                </label>
                <label>
                  {tr('Αριθμός κύκλου / φορτίου')}
                  <input
                    autoFocus
                    value={cycleNumber}
                    onChange={e => setCycleNumber(e.target.value)}
                    placeholder={tr('π.χ. 2026-0813-042')}
                  />
                </label>
                <label>
                  {tr('Πρόγραμμα')}
                  <select value={cycleProgram} onChange={e => setCycleProgram(e.target.value)}>
                    <option>134°C · 5 min</option>
                    <option>134°C · 18 min</option>
                    <option>121°C · 20 min</option>
                    <option>{tr('Άλλο πρόγραμμα')}</option>
                    {!['134°C · 5 min', '134°C · 18 min', '121°C · 20 min', tr('Άλλο πρόγραμμα')].includes(
                      cycleProgram,
                    ) && <option>{cycleProgram}</option>}
                  </select>
                </label>
                <label>
                  {tr('Χημικός δείκτης')}
                  <select
                    value={indicatorResult}
                    onChange={e => setIndicatorResult(e.target.value as 'PASS' | 'FAIL' | 'NOT_RECORDED')}
                  >
                    <option value="PASS">{tr('Επιτυχής / OK')}</option>
                    <option value="FAIL">{tr('Αποτυχία')}</option>
                    <option value="NOT_RECORDED">{tr('Δεν καταγράφηκε')}</option>
                  </select>
                </label>
              </div>
              {indicatorResult === 'FAIL' ? (
                <div className="cycle-result-warning">
                  <TriangleAlert size={18} />
                  <div>
                    <strong>{tr('Ο κύκλος δεν αποδεσμεύεται')}</strong>
                    <span>{tr('Η εγγραφή παραμένει στην καρτέλα «Κλιβανισμός» για νέο κύκλο.')}</span>
                  </div>
                </div>
              ) : (
                <div className="cycle-result-ok">
                  <CheckCircle2 size={18} />
                  <div>
                    <strong>{tr('Ο κύκλος μπορεί να καταχωρηθεί')}</strong>
                    <span>{tr('Μετά την καταχώρηση η εγγραφή μεταφέρεται στην «Αποδέσμευση» για τελικό έλεγχο.')}</span>
                  </div>
                </div>
              )}
              <label className="cycle-note">
                {tr('Παρατήρηση')}
                <textarea
                  value={cycleNote}
                  onChange={e => setCycleNote(e.target.value)}
                  placeholder={tr('Προαιρετική παρατήρηση…')}
                />
              </label>
            </div>
            <div className="modal-actions workflow-modal-actions">
              <button onClick={closeCycleCompletion}>{tr('Ακύρωση')}</button>
              <button
                className={indicatorResult === 'FAIL' ? 'danger-action primary' : 'primary'}
                disabled={!cycleNumber.trim()}
                onClick={finishCycle}
              >
                {indicatorResult === 'FAIL' ? <TriangleAlert size={16} /> : <PackageCheck size={16} />}{' '}
                {indicatorResult === 'FAIL' ? tr('Καταχώρηση αποτυχίας') : tr('Ολοκλήρωση κύκλου')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
