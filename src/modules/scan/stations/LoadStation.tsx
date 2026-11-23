import {useEffect, useRef, useState} from 'react';
import {useLibraries} from '../../../core/LibraryStore';
import {tr, trData} from '../../../i18n';
import {useSterilizationPage} from '../../sterilization/useSterilizationPage';
import ScanCamera from '../ScanCamera';
import ProgramSelect from '../../sterilization/parts/ProgramSelect';
import CycleNumberSelect from '../../sterilization/parts/CycleNumberSelect';
import {programsOf} from '../../../core/sterilizerPrograms';
import {ScanWaiting, ScanDone, ScanItemList, ScanRefused, ScanScreen} from '../ScanParts';
import {useScanAnswers} from '../useScanAnswers';
import {CheckCircle2, TriangleAlert} from 'lucide-react';
import {askConfirm} from '../../../components/ui/confirmService';
import {autoEndAt, autoEnded, openCycleOn} from '../../../core/cycleEnd';
import {useNow} from '../../sterilization/parts/simulationClock';
import {shortCycleNumber} from '../../../core/cycleNumber';

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
  // One cycle at a time: the sterilizer's cycle still running ends first (see cycleEnd).
  const inside = openCycleOn(s.processLoads, s.loadEquipment);
  // A timed cycle frees the sterilizer at its end: the clock redraws, so «Έναρξη κύκλου» unlocks then.
  const now = useNow(!!inside && autoEndAt(inside) !== undefined);
  const blocked = !!inside && !autoEnded(inside, now);
  const ready =
    !blocked && !!items.length && !!s.loadEquipment.trim() && !!s.loadCycleNumber.trim() && !!s.loadProgram.trim();

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
            <select
              value={s.loadEquipment}
              onChange={e => {
                s.setLoadEquipment(e.target.value);
                // Another sterilizer: its first program.
                s.setLoadProgram(programsOf(sterilizers.find(item => item.el === e.target.value))[0]);
              }}
            >
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
        {inside && blocked && (
          <div className="scan-cycle-open" role="alert">
            <b>{tr('Ο κλίβανος έχει ακόμα τον κύκλο {0}', shortCycleNumber(inside.cycleNumber))}</b>
            <small>{tr('Πρώτα τελειώνει αυτός, μετά ξεκινά ο επόμενος.')}</small>
            <div className="scan-load-actions">
              <button
                type="button"
                className="scan-danger"
                onClick={() =>
                  void askConfirm({
                    title: tr('Αποτυχία κύκλου;'),
                    message: tr(
                      'Όλο το φορτίο ({0} αντικείμενα) θα επιστρέψει σε επανεπεξεργασία. Η ενέργεια καταγράφεται στο ιστορικό.',
                      inside.items.length,
                    ),
                    confirmLabel: tr('Αποτυχία κύκλου'),
                    danger: true,
                  }).then(sure => sure !== false && s.finishProcessLoad(inside.id, 'FAILED'))
                }
              >
                <TriangleAlert size={16} /> {tr('Αποτυχία κύκλου')}
              </button>
              <button
                type="button"
                className="scan-primary"
                onClick={() =>
                  void askConfirm({
                    title: tr('Τέλος κύκλου;'),
                    message: tr(
                      'Τελείωσε ο κύκλος {0} στο {1}; Το φορτίο ({2} αντικείμενα) πηγαίνει στην αποδέσμευση.',
                      inside.cycleNumber,
                      trData(inside.equipment),
                      inside.items.length,
                    ),
                    confirmLabel: tr('Τέλος κύκλου'),
                  }).then(sure => sure !== false && s.finishProcessLoad(inside.id, 'PASSED'))
                }
              >
                <CheckCircle2 size={16} /> {tr('Τέλος κύκλου {0}', shortCycleNumber(inside.cycleNumber))}
              </button>
            </div>
          </div>
        )}
        <CycleNumberSelect
          className="scan-field"
          sterilizer={sterilizers.find(item => item.el === s.loadEquipment)}
          sterilizers={sterilizers}
          equipment={s.loadEquipment}
          loads={s.processLoads}
          value={s.loadCycleNumber}
          onChange={s.setLoadCycleNumber}
        />
        <ProgramSelect
          className="scan-field"
          sterilizer={sterilizers.find(item => item.el === s.loadEquipment)}
          value={s.loadProgram}
          onChange={s.setLoadProgram}
        />
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
      <ScanWaiting
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
