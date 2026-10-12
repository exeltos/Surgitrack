import {useState} from 'react';
import {Search} from 'lucide-react';
import DownloadMenu from '../../components/ui/DownloadMenu';
import PrintPreviewModal from '../../components/assets/PrintPreviewModal';
import {MoreRows} from '../../components/ui/ProgressiveList';
import {tableReportHtml, type ExportTable} from '../../core/exportTable';
import {useProgressiveList} from '../../core/useProgressiveList';
import {parseDisplayDate} from '../../core/displayDate';
import {getI18nLang, tr, trData} from '../../i18n';
import type {Movement} from '../../types/domain';

/** dd/mm/yyyy… → yyyy-mm-dd, to compare with the date fields. */
const dateKey = (value: string) => {
  const match = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : '';
};
const time = (value: string) => parseDisplayDate(value)?.getTime() ?? 0;

/**
 * Every movement recorded with a patient code, newest first: the list that was the "Patient traceability"
 * report. A patient code opens that patient's trace (what was used, with the last cycle before the use).
 */
export default function PatientUses({movements, onOpen}: {movements: Movement[]; onOpen: (code: string) => void}) {
  const [code, setCode] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [report, setReport] = useState<string | null>(null);
  const needle = code.trim().toLowerCase();
  const filtered = movements
    .filter(m => {
      if (!m.patientCode || (needle && !m.patientCode.toLowerCase().includes(needle))) return false;
      const d = dateKey(m.at);
      return (!dateFrom || !d || d >= dateFrom) && (!dateTo || !d || d <= dateTo);
    })
    .sort((a, b) => time(b.at) - time(a.at));
  const rows = useProgressiveList(filtered, [needle, dateFrom, dateTo].join('|'));
  const table = (): ExportTable => ({
    title: tr('Χρήσεις σε ασθενείς'),
    subtitle: [
      tr('{0} κινήσεις', filtered.length),
      needle && `${tr('Κωδικός ασθενούς')} ${code.trim()}`,
      dateFrom && `${tr('Από')} ${dateFrom}`,
      dateTo && `${tr('Έως')} ${dateTo}`,
    ]
      .filter(Boolean)
      .join(' · '),
    headers: [
      tr('Ημερομηνία / ώρα'),
      tr('Κωδικός ασθενούς'),
      tr('Σετ / Εργαλείο'),
      tr('Κίνηση'),
      tr('Από'),
      tr('Προς'),
      tr('Χρήστης'),
    ],
    rows: filtered.map(m => [
      m.at,
      m.patientCode || '',
      m.asset,
      trData(m.status),
      trData(m.from),
      trData(m.to),
      trData(m.by),
    ]),
  });
  return (
    <section className="trace-patients" aria-label={tr('Χρήσεις σε ασθενείς')}>
      <div className="trace-patients-filters">
        <label className="trace-patients-code">
          <span>{tr('Κωδικός ασθενούς')}</span>
          <div>
            <Search size={16} />
            <input value={code} onChange={e => setCode(e.target.value)} placeholder={tr('π.χ. PT-2026-0041')} />
          </div>
        </label>
        <label>
          <span>{tr('Από')}</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </label>
        <label>
          <span>{tr('Έως')}</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </label>
        <span className="trace-patients-count">{tr('{0} κινήσεις', filtered.length)}</span>
        <DownloadMenu table={table} onPrint={() => setReport(tableReportHtml(table(), getI18nLang()))} />
      </div>
      {filtered.length ? (
        <div className="trace-patients-table">
          <table>
            <thead>
              <tr>
                <th>{tr('Ημερομηνία / ώρα')}</th>
                <th>{tr('Κωδικός ασθενούς')}</th>
                <th>{tr('Σετ / Εργαλείο')}</th>
                <th>{tr('Κίνηση')}</th>
                <th>{tr('Από → Προς')}</th>
                <th>{tr('Χρήστης')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.visible.map(m => (
                <tr key={m.id}>
                  <td>{m.at}</td>
                  <td>
                    <button
                      type="button"
                      className="trace-patient-code"
                      title={tr('Ιχνηλάτηση ασθενούς {0}', m.patientCode || '')}
                      onClick={() => onOpen(m.patientCode || '')}
                    >
                      {m.patientCode}
                    </button>
                  </td>
                  <td>{m.asset}</td>
                  <td>{trData(m.status)}</td>
                  <td>
                    {trData(m.from)} → {trData(m.to)}
                  </td>
                  <td>{trData(m.by)}</td>
                </tr>
              ))}
              {rows.hasMore && <MoreRows colSpan={6} onVisible={rows.showMore} />}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">
          <strong>{tr('Δεν βρέθηκαν χρήσεις σε ασθενείς')}</strong>
          <span>{tr('Άλλαξε τον κωδικό ή τις ημερομηνίες.')}</span>
        </div>
      )}
      {report && <PrintPreviewModal title={tr('Χρήσεις σε ασθενείς')} html={report} onClose={() => setReport(null)} />}
    </section>
  );
}
