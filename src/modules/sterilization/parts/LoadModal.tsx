import AssetTypeIcon from '../../../components/assets/AssetTypeIcon';
import BarcodeCapture from '../../../components/barcode/BarcodeCapture';
import {CheckCircle2, Flame, TriangleAlert, X, PackageOpen} from 'lucide-react';
import {tr, trData} from '../../../i18n';
import {useLibraries} from '../../../core/LibraryStore';
import {testsInUse, testsState} from '../../../core/equipmentTests';
import DeviceCyclePicker from '../../devices/DeviceCyclePicker';
import {useHasModule} from '../../../data/cloud/modulesContext';
import {deviceNote} from '../sterilizationTypes';
import type {SterilizationPageState} from '../useSterilizationPage';

export default function LoadModal({s}: {s: SterilizationPageState}) {
  const {sterilizers, washers} = useLibraries();
  const withDevices = useHasModule('DEVICES');
  const {
    addBarcodeToLoad,
    closeLoad,
    completeLoad,
    loadCandidates,
    loadChemical,
    loadChemicalOn,
    loadBiologicalOn,
    loadCycleNumber,
    loadEquipment,
    loadModal,
    loadNote,
    loadProgram,
    loadScanFeedback,
    loadSelected,
    setLoadChemical,
    setLoadChemicalOn,
    setLoadBiologicalOn,
    setLoadCycleNumber,
    setLoadEquipment,
    setLoadNote,
    setLoadProgram,
    setLoadSelected,
    toggleLoadAsset,
  } = s;
  // The equipment comes from the hospital's list (Studio › Libraries), typed only when the list is empty.
  const equipmentList = loadModal === 'WASHING' ? washers : sterilizers;
  const tested = loadModal === 'WASHING' ? 'WASHER' : 'STERILIZER';
  return (
    <>
      {loadModal && (
        <div className="modal-backdrop" onMouseDown={closeLoad}>
          <div className="receipt-card-modal workflow-modal load-modal" onMouseDown={e => e.stopPropagation()}>
            <button className="modal-x" aria-label={tr('Κλείσιμο')} title={tr('Κλείσιμο')} onClick={closeLoad}>
              <X size={18} />
            </button>
            <div className="workflow-modal-head">
              <div className="ster-kind set">
                {loadModal === 'WASHING' ? <PackageOpen size={20} /> : <Flame size={20} />}
              </div>
              <div className="workflow-modal-title">
                <span className="eyebrow">
                  {loadModal === 'WASHING' ? tr('ΦΟΡΤΙΟ ΠΛΥΝΤΗΡΙΟΥ') : tr('ΦΟΡΤΙΟ ΑΠΟΣΤΕΙΡΩΣΗΣ')}
                </span>
                <h2>{loadModal === 'WASHING' ? tr('Φόρτωση πλυντηρίου') : tr('Φόρτωση κλιβάνου')}</h2>
                <p>
                  {tr(
                    'Επίλεξε τα Set/εργαλεία που μπαίνουν στον ίδιο κύκλο. Η εγγραφή του κύκλου θα συνδεθεί με όλα τα επιλεγμένα barcodes.',
                  )}
                </p>
              </div>
            </div>
            <div className="load-modal-body">
              {withDevices && (
                <DeviceCyclePicker
                  kind={loadModal === 'WASHING' ? 'WASHER' : 'STERILIZER'}
                  equipment={loadEquipment}
                  onPick={(reading, device) => {
                    setLoadEquipment(device.name);
                    setLoadCycleNumber(reading.cycleNumber);
                    if (reading.program) setLoadProgram(reading.program);
                    if (reading.result === 'FAIL') setLoadChemical('FAIL');
                    else if (loadModal === 'WASHING' && reading.result === 'PASS') setLoadChemical('PASS');
                    // Each cycle has its own values: nothing of the previously picked cycle stays.
                    if (loadModal === 'WASHING') {
                      s.setLoadWashTemp(reading.maxTemperature !== undefined ? String(reading.maxTemperature) : '');
                      s.setLoadWashA0('');
                    }
                    setLoadNote(note => note || deviceNote(reading));
                    s.setLoadFromDevice(true);
                  }}
                />
              )}
              <div className="cycle-clean-fields">
                <label>
                  {loadModal === 'WASHING' ? tr('Πλυντήριο / απολυμαντής') : tr('Κλίβανος')}
                  {equipmentList.length ? (
                    <select value={loadEquipment} onChange={e => setLoadEquipment(e.target.value)}>
                      {equipmentList.map(item => (
                        <option
                          key={item.id}
                          value={item.el}
                          disabled={!!item.outOfService || testsState(item.tests, Date.now(), tested) === 'FAILED'}
                        >
                          {trData(item.el)}
                          {item.outOfService
                            ? ` · ${item.outOfService.reason === 'BREAKDOWN' ? tr('σε βλάβη') : tr('σε συντήρηση')}`
                            : testsState(item.tests, Date.now(), tested) === 'FAILED'
                              ? ` · ${tr('αποτυχημένη δοκιμή')}`
                              : ''}
                        </option>
                      ))}
                      {!equipmentList.some(item => item.el === loadEquipment) && (
                        <option value={loadEquipment}>{trData(loadEquipment)}</option>
                      )}
                    </select>
                  ) : (
                    <input value={loadEquipment} onChange={e => setLoadEquipment(e.target.value)} />
                  )}
                  {testsInUse(equipmentList) &&
                    testsState(equipmentList.find(item => item.el === loadEquipment)?.tests, Date.now(), tested) ===
                      'DUE' && (
                      <small className="load-test-due">
                        <TriangleAlert size={13} aria-hidden="true" />{' '}
                        {loadModal === 'WASHING'
                          ? tr('Εκκρεμεί δοκιμή του πλυντηρίου (Κλίβανοι & Συσκευές).')
                          : tr('Εκκρεμεί δοκιμή του κλιβάνου (Κλίβανοι & Συσκευές).')}
                      </small>
                    )}
                </label>
                <label>
                  {tr('Αριθμός κύκλου / φορτίου')}
                  <input
                    value={loadCycleNumber}
                    onChange={e => setLoadCycleNumber(e.target.value)}
                    placeholder={tr('π.χ. 2026-0815-07')}
                  />
                </label>
                <label>
                  {tr('Πρόγραμμα')}
                  <input value={loadProgram} onChange={e => setLoadProgram(e.target.value)} />
                </label>
                {loadModal === 'WASHING' && (
                  <>
                    <div className="load-indicator-pick" role="group" aria-labelledby="load-wash-result">
                      <span id="load-wash-result">{tr('Αποτέλεσμα πλύσης')}</span>
                      <div className="load-indicator-chips">
                        <label>
                          <input
                            type="radio"
                            name="load-wash-result"
                            checked={loadChemical !== 'FAIL'}
                            onChange={() => setLoadChemical('PASS')}
                          />
                          {tr('Επιτυχές')}
                        </label>
                        <label>
                          <input
                            type="radio"
                            name="load-wash-result"
                            checked={loadChemical === 'FAIL'}
                            onChange={() => setLoadChemical('FAIL')}
                          />
                          {tr('Αποτυχία')}
                        </label>
                      </div>
                    </div>
                    <label>
                      {tr('Θερμοκρασία (°C)')}
                      <input
                        inputMode="decimal"
                        value={s.loadWashTemp}
                        onChange={e => s.setLoadWashTemp(e.target.value)}
                        placeholder={tr('προαιρετικό')}
                      />
                    </label>
                    <label>
                      {tr('Τιμή A0')}
                      <input
                        inputMode="decimal"
                        value={s.loadWashA0}
                        onChange={e => s.setLoadWashA0(e.target.value)}
                        placeholder={tr('προαιρετικό')}
                      />
                    </label>
                  </>
                )}
                {loadModal === 'STERILIZATION' && (
                  <div className="load-indicator-pick" role="group" aria-labelledby="load-indicator-title">
                    <span id="load-indicator-title">{tr('Δείκτες στο φορτίο')}</span>
                    <div className="load-indicator-chips">
                      <label>
                        <input
                          type="checkbox"
                          checked={loadChemicalOn}
                          onChange={e => setLoadChemicalOn(e.target.checked)}
                        />
                        {tr('Χημικός')}
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={loadBiologicalOn}
                          onChange={e => setLoadBiologicalOn(e.target.checked)}
                        />
                        {tr('Βιολογικός')}
                      </label>
                    </div>
                  </div>
                )}
              </div>
              {loadModal === 'STERILIZATION' && loadChemical === 'FAIL' && (
                <div className="load-device-fail" role="alert">
                  <TriangleAlert size={16} />
                  {tr('Η συσκευή δήλωσε αποτυχία κύκλου: το φορτίο θα επιστρέψει σε επανεπεξεργασία.')}
                </div>
              )}
              {loadModal === 'WASHING' && loadChemical === 'FAIL' && (
                <div className="load-device-fail" role="alert">
                  <TriangleAlert size={16} />
                  {tr('Αποτυχία πλύσης: τα αντικείμενα μένουν στον καθαρισμό για νέα πλύση.')}
                </div>
              )}
              {loadModal === 'STERILIZATION' && (
                <BarcodeCapture
                  title={tr('Προσθήκη στο φορτίο')}
                  subtitle={tr('Σκανάρετε, πληκτρολογήστε ή χρησιμοποιήστε scanner υπολογιστή.')}
                  placeholder={tr('Barcode · π.χ. S000324')}
                  feedback={loadScanFeedback}
                  onBarcode={addBarcodeToLoad}
                />
              )}
              <section className="load-assets">
                <div className="load-assets-head">
                  <div>
                    <strong>{tr('Περιεχόμενο φορτίου')}</strong>
                    <span>
                      {loadSelected.size} {tr('από') + ' '}
                      {loadCandidates.length} {tr('επιλεγμένα')}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      setLoadSelected(
                        loadSelected.size === loadCandidates.length
                          ? new Set()
                          : new Set(loadCandidates.map(item => `${item.kind}:${item.id}`)),
                      )
                    }
                  >
                    {loadSelected.size === loadCandidates.length ? tr('Αποεπιλογή όλων') : tr('Επιλογή όλων')}
                  </button>
                </div>
                <div className="load-assets-list">
                  {loadCandidates.map(item => {
                    const key = `${item.kind}:${item.id}`;
                    const selected = loadSelected.has(key);
                    return (
                      <label key={key} className={selected ? 'selected' : ''}>
                        <input type="checkbox" checked={selected} onChange={() => toggleLoadAsset(key)} />
                        <AssetTypeIcon
                          kind={item.kind}
                          maxUses={item.kind === 'TOOL' ? item.maxUses : undefined}
                          size={16}
                        />
                        <span>
                          <b>{item.barcode}</b>
                          <strong>{item.name}</strong>
                          <small>{trData(item.department) || tr('Χωρίς τμήμα')}</small>
                        </span>
                        {loadModal === 'STERILIZATION' && selected && (
                          <CheckCircle2 className="load-scanned-mark" size={17} />
                        )}
                      </label>
                    );
                  })}
                </div>
              </section>
              <label className="cycle-note">
                {tr('Παρατήρηση φορτίου')}
                <textarea
                  value={loadNote}
                  onChange={e => setLoadNote(e.target.value)}
                  placeholder={tr('Προαιρετική παρατήρηση / απόκλιση…')}
                />
              </label>
            </div>
            <div className="modal-actions workflow-modal-actions">
              <button onClick={closeLoad}>{tr('Ακύρωση')}</button>
              <button
                className={loadChemical === 'FAIL' ? 'danger-action primary' : 'primary'}
                disabled={!loadSelected.size || !loadEquipment.trim() || !loadCycleNumber.trim() || !loadProgram.trim()}
                onClick={completeLoad}
              >
                {loadChemical === 'FAIL' ? <TriangleAlert size={16} /> : <CheckCircle2 size={16} />}{' '}
                {loadModal === 'STERILIZATION' && !s.loadFromDevice && loadChemical !== 'FAIL'
                  ? tr('Έναρξη κύκλου ·') + ' '
                  : tr('Ολοκλήρωση φορτίου ·') + ' '}
                {loadSelected.size}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
