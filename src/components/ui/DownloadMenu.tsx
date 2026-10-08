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
  onPrint,
  printLabel,
  variant = 'secondary',
  disabled,
  align = 'right',
}: {
  /** The rows to download; built only when an option is chosen. */
  table: () => ExportTable;
  /** Opens the print preview (from which the user prints or saves as PDF); none: no PDF option. */
  onPrint?: () => void;
  printLabel?: string;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  align?: 'left' | 'right';
}) {
  const items: ActionMenuItem[] = [
    {
      key: 'xlsx',
      icon: <FileSpreadsheet size={16} />,
      label: tr('Excel (.xlsx)'),
      hint: tr('Πίνακας με φίλτρα, για επεξεργασία.'),
      onSelect: () => downloadXlsx(table()),
    },
    ...(onPrint
      ? [
          {
            key: 'pdf',
            icon: <Printer size={16} />,
            label: printLabel || tr('PDF / Εκτύπωση'),
            hint: tr('Προεπισκόπηση, μετά εκτύπωση ή αποθήκευση ως PDF.'),
            onSelect: onPrint,
          },
        ]
      : []),
    {
      key: 'csv',
      icon: <FileText size={16} />,
      label: tr('CSV (.csv)'),
      hint: tr('Απλό κείμενο, για άλλα προγράμματα.'),
      onSelect: () => downloadCsv(table()),
    },
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
