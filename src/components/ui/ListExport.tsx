import {useState} from 'react';
import DownloadMenu from './DownloadMenu';
import PrintPreviewModal from '../assets/PrintPreviewModal';
import {tableReportHtml, type ExportTable} from '../../core/exportTable';
import {getI18nLang} from '../../i18n';

/**
 * The "Download" button of a list: Excel, CSV, and a PDF / print preview, all from the rows the list shows. With
 * `grouped` each of them is offered both ways, itemised and grouped by kind, inside the same menu.
 */
export default function ListExport({
  table,
  grouped,
  disabled,
}: {
  table: () => ExportTable;
  /** The grouped version of the same list. */
  grouped?: () => ExportTable;
  disabled?: boolean;
}) {
  const [report, setReport] = useState<{title: string; html: string} | null>(null);
  const preview = (make: () => ExportTable) => () => {
    const built = make();
    setReport({title: built.title, html: tableReportHtml(built, getI18nLang())});
  };
  return (
    <>
      <DownloadMenu
        table={table}
        grouped={grouped}
        disabled={disabled}
        onPrint={preview(table)}
        onPrintGrouped={grouped ? preview(grouped) : undefined}
      />
      {report && <PrintPreviewModal title={report.title} html={report.html} onClose={() => setReport(null)} />}
    </>
  );
}
