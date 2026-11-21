import {useState} from 'react';
import {Route} from 'lucide-react';
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
 * The patients with something recorded for them, the latest first: one line each (code, last use, department, how
 * many items). One opens beside the list, in the card. The download holds every record, one line per movement.
 */
export default function PatientUses({
  movements,
  onOpen,
  selected,
}: {
  movements: Movement[];
  onOpen: (code: string) => void;
  /** The patient open in the card: marked in the list. */
  selected?: string;
}) {
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
  // One line per patient: the latest use first, with its department and how many items were recorded.
  const patients = (() => {
    const map = new Map<string, {code: string; at: string; department: string; items: Set<string>}>();
    for (const m of filtered) {
      const code = m.patientCode!;
      const entry = map.get(code);
      if (!entry) map.set(code, {code, at: m.at, department: m.from, items: new Set([m.asset.split(' · ')[0]])});
      else entry.items.add(m.asset.split(' · ')[0]);
    }
    return [...map.values()];
  })();
  const rows = useProgressiveList(patients, [needle, dateFrom, dateTo].join('|'));
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
      <section className="trace-recent-list" aria-label={tr('Ασθενείς')}>
        <h3 className="trace-section-title">{tr('{0} ασθενείς', patients.length)}</h3>
        {patients.length ? (
          <ul>
            {rows.visible.map(p => (
              <li key={p.code}>
                <button
                  type="button"
                  className={selected === p.code ? 'selected' : undefined}
                  aria-current={selected === p.code ? 'true' : undefined}
                  onClick={() => onOpen(p.code)}
                >
                  <b className="mono trace-code">
                    <mark className="movement-chip">{p.code}</mark>
                  </b>
                  <span>{trData(p.department)}</span>
                  <span>{p.items.size === 1 ? tr('1 αντικείμενο') : tr('{0} αντικείμενα', p.items.size)}</span>
                  <span>{p.at}</span>
                </button>
              </li>
            ))}
            {/* At the end of what scrolls: more patients only when the list is scrolled to them. */}
            {rows.hasMore && (
              <li>
                <MoreRows onVisible={rows.showMore} />
              </li>
            )}
          </ul>
        ) : (
          <div className="ledger-empty">
            <Route size={28} />
            <strong>{tr('Δεν βρέθηκαν καταγραφές με κωδικό ασθενούς')}</strong>
            <span>{tr('Άλλαξε τον κωδικό ή τις ημερομηνίες.')}</span>
          </div>
        )}
      </section>
      {report && (
        <PrintPreviewModal title={tr('Καταγραφές με κωδικό ασθενούς')} html={report} onClose={() => setReport(null)} />
      )}
    </section>
  );
}
