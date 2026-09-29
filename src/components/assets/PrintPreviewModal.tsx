import type {ReactNode} from 'react';
import {Printer, X} from 'lucide-react';
import AppButton from '../ui/AppButton';
import {tr} from '../../i18n';
export default function PrintPreviewModal({
  title,
  html,
  onClose,
  aside,
  compact,
}: {
  title: string;
  html: string;
  onClose: () => void;
  /** Print options shown beside the preview. */
  aside?: ReactNode;
  /** A smaller dialog for small prints such as labels. */
  compact?: boolean;
}) {
  const frameId = 'surgitrack-print-preview';
  const doPrint = () => {
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
          <button className="icon-button" onClick={onClose} aria-label={tr('Κλείσιμο')}>
            <X size={18} />
          </button>
        </header>
        <div className={`print-preview-main${aside ? ' with-aside' : ''}`}>
          <div className="print-preview-body">
            <iframe id={frameId} title={title} srcDoc={html} />
          </div>
          {aside && <aside className="print-preview-aside">{aside}</aside>}
        </div>
        <footer>
          <AppButton onClick={onClose}>{tr('Κλείσιμο')}</AppButton>
          <AppButton variant="primary" icon={<Printer size={16} />} onClick={doPrint}>
            {tr('Εκτύπωση / Αποθήκευση PDF')}
          </AppButton>
        </footer>
      </div>
    </div>
  );
}
