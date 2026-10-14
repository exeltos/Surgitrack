import {useEffect, useRef, useState} from 'react';
import {useLibraries} from '../../../core/LibraryStore';
import {tr, trData} from '../../../i18n';
import {useSterilizationPage} from '../../sterilization/useSterilizationPage';
import ScanCamera from '../ScanCamera';
import {DemoWaiting, ScanDone, ScanItemList, ScanRefused, ScanScreen} from '../ScanParts';
import {useScanAnswers} from '../useScanAnswers';

/**
 * Sterilizer loading: scan what goes into the cycle, then the sterilizer, cycle number, program and the
 * indicators in the load. The same rules as «Φόρτωση κλιβάνου».
 */
export default function LoadStation({onStations}: {onStations: () => void}) {
  const s = useSterilizationPage();
  const {sterilizers} = useLibraries();
  const [step, setStep] = useState<'SCAN' | 'CONFIRM' | 'DONE'>('SCAN');
  const [loaded, setLoaded] = useState(0);
  const submitted = useRef(0);
  const answers = useScanAnswers(s.loadScanFeedback);
  const {openLoad} = s;
  const start = useRef(openLoad);
  // A round starts empty: what is scanned goes in, nothing is preselected.
  useEffect(() => {
    start.current('STERILIZATION', []);
  }, []);
  // The load closes once recorded; when it stays open the store said why (a toast).
  useEffect(() => {
    if (submitted.current && !s.loadModal) {
      setLoaded(submitted.current);
      submitted.current = 0;
      setStep('DONE');
    }
  }, [s.loadModal]);
  const items = s.loadCandidates.filter(item => s.loadSelected.has(`${item.kind}:${item.id}`));
  const ready = !!items.length && !!s.loadEquipment.trim() && !!s.loadCycleNumber.trim() && !!s.loadProgram.trim();

  if (step === 'DONE')
    return (
      <ScanScreen title={tr('Φόρτωση κλιβάνου')} backLabel={tr('Αρχική')} onBack={onStations}>
        <ScanDone
          title={tr('Ο κύκλος ξεκίνησε')}
          text={tr('{0} αντικείμενα στον κλίβανο {1}.', loaded, trData(s.loadEquipment))}
          again={tr('Νέα φόρτωση')}
          onAgain={() => {
            openLoad('STERILIZATION', []);
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
        title={tr('Στοιχεία κύκλου')}
        subtitle={tr('{0} αντικείμενα', items.length)}
        backLabel={tr('Σάρωση')}
        onBack={() => setStep('SCAN')}
        footer={
          <button
            type="button"
            className="scan-primary"
            disabled={!ready}
            onClick={() => {
              submitted.current = items.length;
              s.completeLoad();
            }}
          >
            {tr('Έναρξη κύκλου ·') + ' '}
            {items.length}
          </button>
        }
      >
        <label className="scan-field">
          {tr('Κλίβανος')}
          {sterilizers.length ? (
            <select value={s.loadEquipment} onChange={e => s.setLoadEquipment(e.target.value)}>
              {sterilizers.map(item => (
                <option key={item.id} value={item.el}>
                  {trData(item.el)}
                </option>
              ))}
              {!sterilizers.some(item => item.el === s.loadEquipment) && (
                <option value={s.loadEquipment}>{trData(s.loadEquipment)}</option>
              )}
            </select>
          ) : (
            <input value={s.loadEquipment} onChange={e => s.setLoadEquipment(e.target.value)} />
          )}
        </label>
        <label className="scan-field">
          {tr('Αριθμός κύκλου / φορτίου')}
          <input
            value={s.loadCycleNumber}
            onChange={e => s.setLoadCycleNumber(e.target.value)}
            placeholder={tr('π.χ. 2026-0815-07')}
            inputMode="text"
          />
        </label>
        <label className="scan-field">
          {tr('Πρόγραμμα')}
          <input value={s.loadProgram} onChange={e => s.setLoadProgram(e.target.value)} />
        </label>
        <div className="scan-field" role="group" aria-label={tr('Δείκτες στο φορτίο')}>
          {tr('Δείκτες στο φορτίο')}
          <div className="scan-chips">
            <label className={s.loadChemicalOn ? 'on' : ''}>
              <input type="checkbox" checked={s.loadChemicalOn} onChange={e => s.setLoadChemicalOn(e.target.checked)} />
              {tr('Χημικός')}
            </label>
            <label className={s.loadBiologicalOn ? 'on' : ''}>
              <input
                type="checkbox"
                checked={s.loadBiologicalOn}
                onChange={e => s.setLoadBiologicalOn(e.target.checked)}
              />
              {tr('Βιολογικός')}
            </label>
          </div>
        </div>
        <label className="scan-field">
          {tr('Παρατήρηση φορτίου')}
          <textarea
            value={s.loadNote}
            onChange={e => s.setLoadNote(e.target.value)}
            placeholder={tr('Προαιρετική παρατήρηση / απόκλιση…')}
          />
        </label>
      </ScanScreen>
    );

  return (
    <ScanScreen
      title={tr('Φόρτωση κλιβάνου')}
      subtitle={tr('{0} έτοιμα για φόρτωση', s.loadCandidates.length)}
      backLabel={tr('Αρχική')}
      onBack={onStations}
      footer={
        <button type="button" className="scan-primary" disabled={!items.length} onClick={() => setStep('CONFIRM')}>
          {tr('Συνέχεια · {0}', items.length)}
        </button>
      }
    >
      <ScanCamera onBarcode={s.addBarcodeToLoad} feedback={s.loadScanFeedback} />
      <div className="scan-count">
        <span>{tr('Στο φορτίο')}</span>
        <b>{items.length}</b>
      </div>
      <ScanRefused messages={answers.refused} />
      <DemoWaiting
        items={s.loadCandidates.filter(item => !s.loadSelected.has(`${item.kind}:${item.id}`))}
        onPick={s.addBarcodeToLoad}
      />
      <ScanItemList
        items={items}
        onRemove={item => s.toggleLoadAsset(`${item.kind}:${item.id}`)}
        empty={tr('Σκανάρετε τα Σετ και τα εργαλεία που μπαίνουν στον κλίβανο.')}
      />
    </ScanScreen>
  );
}
