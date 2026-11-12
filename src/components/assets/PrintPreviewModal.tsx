import type {ReactNode} from 'react';
import {Printer} from 'lucide-react';
import AppButton from '../ui/AppButton';
import {tr} from '../../i18n';
import {markPrintHtml} from '../../core/sampleDataMark';
import {printDocumentInWindow, printLabelPdf} from '../../modules/sterilization/printUtils';
export default function PrintPreviewModal({
  title,
  html,
  onClose,
  aside,
  compact,
  actions,
  printInWindow,
  labelPdf,
}: {
  title: string;
  html: string;
  onClose: () => void;
  /** Print options shown beside the preview. */
  aside?: ReactNode;
  /** A smaller dialog for small prints such as labels. */
  compact?: boolean;
  /** Extra buttons on the left of the footer (e.g. saving the options as the default). */
  actions?: ReactNode;
  /** Print from a window of its own, so the page's own @page size and margins apply (labels). */
  printInWindow?: boolean;
  /** A sticker label: printed as a PDF whose page is the sticker (size in mm), so no browser margins or headers apply. */
  labelPdf?: {html: string; widthMm: number; heightMm: number};
}) {
  const frameId = 'surgitrack-print-preview';
  const doPrint = () => {
    // With popups blocked no window opens: the preview's own frame prints instead.
    if (labelPdf && printLabelPdf(title, labelPdf.html, labelPdf.widthMm, labelPdf.heightMm)) return;
    if (printInWindow && printDocumentInWindow(title, html)) return;
    const frame = document.getElementById(frameId) as HTMLIFrameElement | null;
    frame?.contentWindow?.focus();
    frame?.contentWindow?.print();
  };
  return (
    <div className="modal-backdrop">
      <div className={`print-preview-modal${compact ? ' compact' : ''}`}>
        <header>
          <div>
            <span className="eyebrow">{tr('ΠΡΟΕΠΙΣΚΟΠΗΣΗ')}</span>
            <h2>{title}</h2>
          </div>
        </header>
        <div className={`print-preview-main${aside ? ' with-aside' : ''}`}>
          <div className="print-preview-body">
            {/* No script runs in the printed page (its data is escaped too); printing from here stays allowed. */}
            <iframe id={frameId} title={title} sandbox="allow-same-origin allow-modals" srcDoc={markPrintHtml(html)} />
          </div>
          {aside && <aside className="print-preview-aside">{aside}</aside>}
        </div>
        <footer>
          {actions && <div className="print-preview-actions">{actions}</div>}
          <AppButton onClick={onClose}>{tr('Κλείσιμο')}</AppButton>
          <AppButton variant="primary" icon={<Printer size={16} />} onClick={doPrint}>
            {tr('Εκτύπωση / Αποθήκευση PDF')}
          </AppButton>
        </footer>
      </div>
    </div>
  );
}
