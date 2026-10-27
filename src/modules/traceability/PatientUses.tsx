import {useState} from 'react';
import {ChevronRight, Clock3, Route, UserRound} from 'lucide-react';
import AssetFilterBar from '../../components/assets/AssetFilterBar';
import DownloadMenu from '../../components/ui/DownloadMenu';
import PrintPreviewModal from '../../components/assets/PrintPreviewModal';
import {MoreRows} from '../../components/ui/ProgressiveList';
import {tableReportHtml, type ExportTable} from '../../core/exportTable';
import {useProgressiveList} from '../../core/useProgressiveList';
import {parseDisplayDate} from '../../core/displayDate';
import {getI18nLang, tr, trData} from '../../i18n';
import type {Movement} from '../../types/domain';
import {movementText} from '../../core/movementText';

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
    title: tr('Καταγραφές με κωδικό ασθενούς'),
    subtitle: [
      tr('{0} καταγραφές', filtered.length),
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
      movementText(m.status),
      trData(m.from),
      trData(m.to),
      trData(m.by),
    ]),
  });
  return (
    <section className="trace-patients" aria-label={tr('Καταγραφές με κωδικό ασθενούς')}>
      <AssetFilterBar
        className="movement-filter-bar"
        query={code}
        onQueryChange={setCode}
        placeholder={tr('Κωδικός ασθενούς, π.χ. PT-2026-0041')}
        filters={[
          {
            key: 'dateFrom',
            type: 'date',
            value: dateFrom,
            placeholder: tr('Από ημερομηνία'),
            options: [],
            onChange: setDateFrom,
          },
          {
            key: 'dateTo',
            type: 'date',
            value: dateTo,
            placeholder: tr('Έως ημερομηνία'),
            options: [],
            onChange: setDateTo,
          },
        ]}
        extra={<DownloadMenu table={table} onPrint={() => setReport(tableReportHtml(table(), getI18nLang()))} />}
      />
      <div className="movement-ledger trace-patients-ledger">
        <div className="ledger-head">
          <div>
            <span>{tr('{0} καταγραφές', filtered.length)}</span>
          </div>
          <small>
            {tr(
              'Κάθε φορά που ένα Σετ ή εργαλείο στάλθηκε προς Αποστείρωση με κωδικό ασθενούς. Πατήστε μια γραμμή για τον ασθενή.',
            )}
          </small>
        </div>
        <div className="ledger-columns">
          <span>{tr('Ημερομηνία / ώρα')}</span>
          <span>{tr('Σετ / Εργαλείο')}</span>
          <span>{tr('Τμήμα')}</span>
          <span>{tr('Κωδικός ασθενούς')}</span>
          <span>{tr('Χρήστης')}</span>
          <span></span>
        </div>
        <div className="ledger-scroll">
          {filtered.length ? (
            rows.visible.map(m => {
              const [barcode, ...rest] = m.asset.split(' · ');
              return (
                <button
                  type="button"
                  className="ledger-row"
                  key={m.id}
                  onClick={() => onOpen(m.patientCode || '')}
                  title={tr('Ιχνηλάτηση ασθενούς {0}', m.patientCode || '')}
                >
                  <span className="ledger-date">
                    <Clock3 size={15} />
                    <b>{m.at}</b>
                  </span>
                  <span className="ledger-asset">
                    <small>{m.assetKind === 'SET' ? tr('ΣΕΤ') : tr('ΕΡΓΑΛΕΙΟ')}</small>
                    <b>{barcode}</b>
                    {rest.length > 0 && <em>{rest.join(' · ')}</em>}
                  </span>
                  <span className="ledger-route">
                    <i>{trData(m.from)}</i>
                  </span>
                  <span>
                    <mark className="movement-chip">{m.patientCode}</mark>
                  </span>
                  <span className="ledger-user">
                    <UserRound size={15} />
                    <span>
                      <b>{trData(m.by)}</b>
                      <small>{movementText(m.status)}</small>
                    </span>
                  </span>
                  <ChevronRight className="ledger-open" size={18} />
                </button>
              );
            })
          ) : (
            <div className="ledger-empty">
              <Route size={28} />
              <strong>{tr('Δεν βρέθηκαν καταγραφές με κωδικό ασθενούς')}</strong>
              <span>{tr('Άλλαξε τον κωδικό ή τις ημερομηνίες.')}</span>
            </div>
          )}
          {rows.hasMore && <MoreRows onVisible={rows.showMore} />}
        </div>
      </div>
      {report && (
        <PrintPreviewModal title={tr('Καταγραφές με κωδικό ασθενούς')} html={report} onClose={() => setReport(null)} />
      )}
    </section>
  );
}
