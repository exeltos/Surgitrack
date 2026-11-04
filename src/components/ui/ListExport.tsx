import {useState} from 'react';
import DownloadMenu from './DownloadMenu';
import PrintPreviewModal from '../assets/PrintPreviewModal';
import {tableReportHtml, type ExportTable} from '../../core/exportTable';
import {getI18nLang, tr} from '../../i18n';

/**
 * The "Download" button of a list: Excel, CSV, and a PDF / print preview, all from the rows the list shows. With
 * `grouped` the list can also be taken grouped (a choice beside the button, kept while the page is open).
 */
export default function ListExport({
  table,
  grouped,
  disabled,
}: {
  table: () => ExportTable;
  /** The grouped version of the same list; when given, a «Ομαδοποιημένα» choice is offered. */
  grouped?: () => ExportTable;
  disabled?: boolean;
}) {
  const [report, setReport] = useState<string | null>(null);
  const [asGroups, setAsGroups] = useState(false);
  const current = () => (grouped && asGroups ? grouped() : table());
  return (
    <>
      {grouped && (
        <label
          className="export-group-choice"
          title={tr('Στο αρχείο, ένα είδος ανά γραμμή με σύνολα τεμαχίων και χρήσεων.')}
        >
          <input type="checkbox" checked={asGroups} onChange={e => setAsGroups(e.target.checked)} />
          <span>{tr('Ομαδοποιημένα')}</span>
        </label>
      )}
      <DownloadMenu
        table={current}
        disabled={disabled}
        onPrint={() => setReport(tableReportHtml(current(), getI18nLang()))}
      />
      {report && <PrintPreviewModal title={current().title} html={report} onClose={() => setReport(null)} />}
    </>
  );
}
