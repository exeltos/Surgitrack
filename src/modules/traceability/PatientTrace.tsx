import {useState} from 'react';
import {ArrowLeft, CircleAlert, CircleCheck, Printer} from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import PrintPreviewModal from '../../components/assets/PrintPreviewModal';
import {tableReportHtml, type ExportTable} from '../../core/exportTable';
import {getI18nLang, tr, trData} from '../../i18n';
import {useSurgi} from '../../store/SurgiStore';
import type {SetAsset, Tool} from '../../types/domain';
import {barcodeOf, cyclesOf, time, type CycleEntry} from './traceModel';

type Used = {code: string; item?: SetAsset | Tool; label: string; at: string; by: string; cycle?: CycleEntry};

/**
 * One patient (by code only): what was used, each with the last sterilization cycle before the use and its result,
 * and one line on top that says whether all of it was sterilized in a cycle that went well.
 */
export default function PatientTrace({
  patient,
  onBack,
  onItem,
  onLoad,
}: {
  patient: string;
  onBack: () => void;
  onItem: (barcode: string) => void;
  onLoad: (loadId: string) => void;
}) {
  const {sets, tools, movements, counts, processLoads, sterilizationCycles} = useSurgi();
  const [report, setReport] = useState<string | null>(null);
  const code = patient.toLowerCase();
  const moves = movements.filter(m => m.patientCode?.toLowerCase() === code).sort((a, b) => time(a.at) - time(b.at));
  const all: Array<SetAsset | Tool> = [...sets, ...tools];
  const used: Used[] = [];
  moves.forEach(m => {
    const barcode = barcodeOf(m);
    if (used.some(u => u.code === barcode)) return;
    const item = all.find(x => x.barcode === barcode || x.legacyBarcodes?.includes(barcode));
    const at = time(m.at);
    const cycle = item
      ? cyclesOf(item, sets, processLoads, sterilizationCycles).find(c => !at || time(c.at) <= at)
      : undefined;
    used.push({code: barcode, item, label: m.asset, at: m.at, by: m.by, cycle});
  });
  const signed = counts.filter(c => c.patientCode.toLowerCase() === code);
  const unconfirmed = used.filter(u => u.cycle?.tone !== 'ok').length;
  // Where it was used: the department it came from when the use was recorded.
  const place = moves[0] ? trData(moves[0].from || moves[0].to) : '';
  const shownCode = moves[0]?.patientCode || patient;

  const table = (): ExportTable => ({
    title: tr('Ασθενής {0}', shownCode),
    subtitle: unconfirmed
      ? tr('Χωρίς επιβεβαιωμένο κύκλο: {0}', unconfirmed)
      : tr('Όλα αποστειρώθηκαν σε κύκλο με επιτυχία'),
    headers: [tr('Σετ / Εργαλείο'), tr('Κύκλος αποστείρωσης'), tr('Αποτέλεσμα'), tr('Χρήση'), tr('Χρήστης')],
    rows: used.map(u => [
      u.label,
      u.cycle ? `${u.cycle.sterilizer} · #${u.cycle.cycleNumber} · ${u.cycle.at}` : '—',
      u.cycle ? tr(u.cycle.label) : tr('Δεν βρέθηκε κύκλος'),
      u.at,
      trData(u.by),
    ]),
  });

  return (
    <>
      <button type="button" className="trace-back" onClick={onBack}>
        <ArrowLeft size={16} /> {tr('Όλοι οι ασθενείς')}
      </button>
      {used.length === 0 ? (
        <div className="empty">
          <strong>{tr('Δεν βρέθηκε ασθενής με κωδικό «{0}»', patient)}</strong>
        </div>
      ) : (
        <>
          <section className="trace-summary trace-patient-summary" aria-label={tr('Ασθενής')}>
            <div className="trace-summary-title">
              <small>{tr('ΚΩΔΙΚΟΣ ΑΣΘΕΝΟΥΣ')}</small>
              <h2>{shownCode}</h2>
              <span>
                {[moves[0].at.split(' ')[0], place, tr('{0} αντικείμενα', used.length)].filter(Boolean).join(' · ')}
              </span>
              {signed.map(c => (
                <span key={c.id}>
                  {tr('Υπογεγραμμένη καταμέτρηση Σετ')} {sets.find(s => s.id === c.setId)?.barcode}: {c.counted}/
                  {c.expected}
                </span>
              ))}
            </div>
            {unconfirmed ? (
              <p className="trace-verdict wait">
                <CircleAlert size={18} aria-hidden="true" /> {tr('Χωρίς επιβεβαιωμένο κύκλο: {0}', unconfirmed)}
              </p>
            ) : (
              <p className="trace-verdict ok">
                <CircleCheck size={18} aria-hidden="true" /> {tr('Όλα αποστειρώθηκαν σε κύκλο με επιτυχία')}
              </p>
            )}
          </section>
          <div className="trace-table-wrap" role="region" tabIndex={0} aria-label={tr('Τι χρησιμοποιήθηκε')}>
            <table className="trace-table">
              <thead>
                <tr>
                  <th>{tr('Σετ / Εργαλείο')}</th>
                  <th>{tr('Κύκλος αποστείρωσης')}</th>
                  <th>{tr('Χρήση')}</th>
                  <th>{tr('Αποτέλεσμα')}</th>
                </tr>
              </thead>
              <tbody>
                {used.map(u => (
                  <tr key={u.code}>
                    <td>
                      <button type="button" className="trace-link mono" onClick={() => onItem(u.code)}>
                        {u.code}
                      </button>
                      <small>{u.item?.name || u.label.split(' · ').slice(1).join(' · ')}</small>
                    </td>
                    <td>
                      {u.cycle ? (
                        <>
                          {u.cycle.loadId ? (
                            <button type="button" className="trace-link" onClick={() => onLoad(u.cycle!.loadId!)}>
                              {u.cycle.sterilizer} · #{u.cycle.cycleNumber}
                            </button>
                          ) : (
                            <b>
                              {u.cycle.sterilizer} · #{u.cycle.cycleNumber}
                            </b>
                          )}
                          <small>{u.cycle.at}</small>
                        </>
                      ) : (
                        <b>—</b>
                      )}
                    </td>
                    <td>
                      <b>{u.at.split(' ')[1] || u.at}</b>
                      <small>{trData(u.by)}</small>
                    </td>
                    <td>
                      <i className={`trace-tone ${u.cycle?.tone || 'wait'}`}>
                        {u.cycle ? tr(u.cycle.label) : tr('Δεν βρέθηκε κύκλος')}
                      </i>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <AppButton icon={<Printer size={16} />} onClick={() => setReport(tableReportHtml(table(), getI18nLang()))}>
              {tr('Εκτύπωση για τον φάκελο του ασθενούς')}
            </AppButton>
          </div>
        </>
      )}
      {report && (
        <PrintPreviewModal title={tr('Ασθενής {0}', shownCode)} html={report} onClose={() => setReport(null)} />
      )}
    </>
  );
}
