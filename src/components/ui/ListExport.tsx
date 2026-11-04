import {useState} from 'react';
import DownloadMenu from './DownloadMenu';
import PrintPreviewModal from '../assets/PrintPreviewModal';
import {tableReportHtml, type ExportTable} from '../../core/exportTable';
import {getI18nLang} from '../../i18n';

/** The "Download" button of a list: Excel, CSV, and a PDF / print preview, all from the rows the list shows. */
export default function ListExport({table, disabled}: {table: () => ExportTable; disabled?: boolean}) {
  const [report, setReport] = useState<string | null>(null);
  return (
    <>
      <DownloadMenu
        table={table}
        disabled={disabled}
        onPrint={() => setReport(tableReportHtml(table(), getI18nLang()))}
      />
      {report && <PrintPreviewModal title={table().title} html={report} onClose={() => setReport(null)} />}
    </>
  );
}
