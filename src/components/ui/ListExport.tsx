import {useState} from 'react';
import {CalendarDays, X} from 'lucide-react';
import DownloadMenu from './DownloadMenu';
import PrintPreviewModal from '../assets/PrintPreviewModal';
import {tableReportHtml, type ExportTable} from '../../core/exportTable';
import {getI18nLang, tr} from '../../i18n';
import {dayLabel} from '../../core/usageHistory';

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
      <div className="export-group">
        {pickDay && (
          <span className="export-day">
            <span
              className="app-button app-button-secondary app-button-md export-day-toggle"
              title={tr(
                'Η λήψη δείχνει την κατάσταση των εργαλείων όπως ήταν την ημερομηνία που επιλέγετε· κενό = σήμερα.',
              )}
            >
              <CalendarDays size={16} />
              <span>
                {tr('Κατάσταση')}: <b>{day ? dayLabel(day) : tr('Σήμερα')}</b>
              </span>
            </span>
            {day && (
              <button
                type="button"
                className="export-day-clear"
                aria-label={tr('Καθαρισμός ημερομηνίας')}
                title={tr('Καθαρισμός ημερομηνίας')}
                onClick={() => setDay('')}
              >
                <X size={14} />
              </button>
            )}
            <input
              type="date"
              className="export-day-input"
              value={day}
              max={today}
              aria-label={tr('Ημερομηνία για την κατάσταση της λήψης')}
              onChange={event => setDay(event.target.value)}
            />
          </span>
        )}
        <DownloadMenu
          table={() => table(day || undefined)}
          grouped={grouped && (() => grouped(day || undefined))}
          disabled={disabled}
          onPrint={preview(table)}
          onPrintGrouped={grouped ? preview(grouped) : undefined}
        />
      </div>
      {report && <PrintPreviewModal title={report.title} html={report.html} onClose={() => setReport(null)} />}
    </>
  );
}
