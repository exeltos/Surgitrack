import {useState} from 'react';
import DownloadMenu from './DownloadMenu';
import PrintPreviewModal from '../assets/PrintPreviewModal';
import {tableReportHtml, type ExportTable} from '../../core/exportTable';
import {getI18nLang, tr} from '../../i18n';

/**
 * The "Download" button of a list: Excel, CSV, and a PDF / print preview, all from the rows the list shows. With
 * `grouped` each of them is offered both ways, itemised and grouped by kind, inside the same menu.
 */
export default function ListExport({
  table,
  grouped,
  disabled,
  pickDay,
}: {
  table: (day?: string) => ExportTable;
  /** The grouped version of the same list. */
  grouped?: (day?: string) => ExportTable;
  disabled?: boolean;
  /** Offers a day to take the list as it was on (the tables are built with it); none: only today's. */
  pickDay?: boolean;
}) {
  const [day, setDay] = useState('');
  const today = new Date().toLocaleDateString('sv-SE');
  const [report, setReport] = useState<{title: string; html: string} | null>(null);
  const preview = (make: (day?: string) => ExportTable) => () => {
    const built = make(day || undefined);
    setReport({title: built.title, html: tableReportHtml(built, getI18nLang())});
  };
  return (
    <>
      {pickDay && (
        <label
          className="export-day"
          title={tr(
            'Η λήψη δείχνει την κατάσταση των εργαλείων όπως ήταν την ημερομηνία που επιλέγετε· κενό = σήμερα.',
          )}
        >
          <span>{tr('Κατάσταση την')}</span>
          <input
            type="date"
            value={day}
            max={today}
            aria-label={tr('Ημερομηνία για την κατάσταση της λήψης')}
            onChange={event => setDay(event.target.value)}
          />
        </label>
      )}
      <DownloadMenu
        table={() => table(day || undefined)}
        grouped={grouped && (() => grouped(day || undefined))}
        disabled={disabled}
        onPrint={preview(table)}
        onPrintGrouped={grouped ? preview(grouped) : undefined}
      />
      {report && <PrintPreviewModal title={report.title} html={report.html} onClose={() => setReport(null)} />}
    </>
  );
}
