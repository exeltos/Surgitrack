import AssetTypeIcon from '../../../components/assets/AssetTypeIcon';
import BarcodeCapture from '../../../components/barcode/BarcodeCapture';
import {CheckCircle2, ScanBarcode, Flame, TriangleAlert, X, PackageOpen} from 'lucide-react';
import {tr, trData} from '../../../i18n';
import DeviceCyclePicker from '../../devices/DeviceCyclePicker';
import {deviceNote} from '../sterilizationTypes';
import type {SterilizationPageState} from '../useSterilizationPage';

export default function LoadModal({s}: {s: SterilizationPageState}) {
  const {
    addBarcodeToLoad,
    closeLoad,
    completeLoad,
    loadCandidates,
    loadChemical,
    loadCycleNumber,
    loadEquipment,
    loadModal,
    loadNote,
    loadProgram,
    loadScanFeedback,
    loadSelected,
    setLoadChemical,
    setLoadCycleNumber,
    setLoadEquipment,
    setLoadNote,
    setLoadProgram,
    setLoadSelected,
    toggleLoadAsset,
  } = s;
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
                <h2>{tr('Δημιουργία ενιαίου φορτίου')}</h2>
                <p>
                  {tr(
                    'Επίλεξε τα Set/εργαλεία που μπαίνουν στον ίδιο κύκλο. Η εγγραφή του κύκλου θα συνδεθεί με όλα τα επιλεγμένα barcodes.',
                  )}
                </p>
              </div>
            </div>
            <div className="load-modal-body">
              <DeviceCyclePicker
                kind={loadModal === 'WASHING' ? 'WASHER' : 'STERILIZER'}
                equipment={loadEquipment}
                onPick={(reading, device) => {
                  setLoadEquipment(device.name);
                  setLoadCycleNumber(reading.cycleNumber);
                  if (reading.program) setLoadProgram(reading.program);
                  if (reading.result === 'FAIL') setLoadChemical('FAIL');
                  setLoadNote(note => note || deviceNote(reading));
                }}
              />
              <div className="cycle-clean-fields">
                <label>
                  {loadModal === 'WASHING' ? tr('Πλυντήριο / απολυμαντής') : tr('Κλίβανος')}
                  <input value={loadEquipment} onChange={e => setLoadEquipment(e.target.value)} />
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
                {loadModal === 'STERILIZATION' && (
                  <label>
                    {tr('Χημικός δείκτης κύκλου')}
                    <select
                      value={loadChemical}
                      onChange={e => setLoadChemical(e.target.value as 'PASS' | 'FAIL' | 'NOT_RECORDED')}
                    >
                      <option value="PASS">{tr('Αποδεκτός')}</option>
                      <option value="FAIL">{tr('Αποτυχία')}</option>
                      <option value="NOT_RECORDED">{tr('Δεν καταγράφηκε')}</option>
                    </select>
                  </label>
                )}
              </div>
              {loadModal === 'STERILIZATION' && (
                <BarcodeCapture
                  title={tr('Προσθήκη στο φορτίο')}
                  subtitle={tr('Σκάναρε, πληκτρολόγησε ή χρησιμοποίησε scanner υπολογιστή.')}
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
                  {loadModal === 'STERILIZATION' ? (
                    <span className="load-assets-mode">
                      <ScanBarcode size={14} /> {tr('Barcode / χειροκίνητη επιλογή')}
                    </span>
                  ) : (
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
                  )}
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
                className={
                  loadModal === 'STERILIZATION' && loadChemical === 'FAIL' ? 'danger-action primary' : 'primary'
                }
                disabled={!loadSelected.size || !loadEquipment.trim() || !loadCycleNumber.trim() || !loadProgram.trim()}
                onClick={completeLoad}
              >
                {loadModal === 'STERILIZATION' && loadChemical === 'FAIL' ? (
                  <TriangleAlert size={16} />
                ) : (
                  <CheckCircle2 size={16} />
                )}{' '}
                {tr('Ολοκλήρωση φορτίου ·') + ' '}
                {loadSelected.size}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
