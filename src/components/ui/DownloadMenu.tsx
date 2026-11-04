import {Download, FileSpreadsheet, FileText, Printer} from 'lucide-react';
import ActionMenu, {type ActionMenuItem} from './ActionMenu';
import {downloadCsv, downloadXlsx, type ExportTable} from '../../core/exportTable';
import {getI18nLang, tr} from '../../i18n';

/**
 * One "Download" button for a list or report, with the ways to take it away inside: Excel, PDF / print
 * (through the print preview) and CSV. Excel and CSV are built from the same rows as the screen.
 */
export default function DownloadMenu({
  table,
  grouped,
  onPrint,
  onPrintGrouped,
  printLabel,
  variant = 'secondary',
  disabled,
  align = 'right',
}: {
  /** The rows to download; built only when an option is chosen. */
  table: () => ExportTable;
  /** The same list grouped by kind: when given, Excel, CSV and PDF are each offered both ways. */
  grouped?: () => ExportTable;
  /** Opens the print preview (from which the user prints or saves as PDF); none: no PDF option. */
  onPrint?: () => void;
  /** The print preview of the grouped list. */
  onPrintGrouped?: () => void;
  printLabel?: string;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  align?: 'left' | 'right';
}) {
  const both = (label: string) =>
    grouped ? [tr('{0} · αναλυτικά', label), tr('{0} · ομαδοποιημένα', label)] : [label];
  const [xlsx, xlsxGrouped] = both(tr('Excel (.xlsx)'));
  const [pdf, pdfGrouped] = both(printLabel || tr('PDF / Εκτύπωση'));
  const [csv, csvGrouped] = both(tr('CSV (.csv)'));
  const xlsxHint = tr('Πίνακας με φίλτρα, για επεξεργασία.');
  const pdfHint = tr('Προεπισκόπηση, μετά εκτύπωση ή αποθήκευση ως PDF.');
  const csvHint = tr('Απλό κείμενο, για άλλα προγράμματα.');
  const groupedHint = tr('Ένα είδος ανά γραμμή, με σύνολα τεμαχίων και χρήσεων.');
  const items: ActionMenuItem[] = [
    {
      key: 'xlsx',
      icon: <FileSpreadsheet size={16} />,
      label: xlsx,
      hint: xlsxHint,
      onSelect: () => downloadXlsx(table()),
    },
    ...(grouped
      ? [
          {
            key: 'xlsx-grouped',
            icon: <FileSpreadsheet size={16} />,
            label: xlsxGrouped,
            hint: groupedHint,
            onSelect: () => downloadXlsx(grouped()),
          },
        ]
      : []),
    ...(onPrint ? [{key: 'pdf', icon: <Printer size={16} />, label: pdf, hint: pdfHint, onSelect: onPrint}] : []),
    ...(grouped && onPrintGrouped
      ? [
          {
            key: 'pdf-grouped',
            icon: <Printer size={16} />,
            label: pdfGrouped,
            hint: groupedHint,
            onSelect: onPrintGrouped,
          },
        ]
      : []),
    {key: 'csv', icon: <FileText size={16} />, label: csv, hint: csvHint, onSelect: () => downloadCsv(table())},
    ...(grouped
      ? [
          {
            key: 'csv-grouped',
            icon: <FileText size={16} />,
            label: csvGrouped,
            hint: groupedHint,
            onSelect: () => downloadCsv(grouped()),
          },
        ]
      : []),
  ];
  return (
    <ActionMenu
      icon={<Download size={16} />}
      // Not tr('Λήψη'): that word is also the camera's "Capture".
      label={getI18nLang() === 'el' ? 'Λήψη' : 'Download'}
      items={items}
      align={align}
      variant={variant}
      disabled={disabled}
      title={disabled ? tr('Δεν υπάρχουν εγγραφές για λήψη.') : undefined}
    />
  );
}
