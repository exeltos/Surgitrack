import {Printer, X} from 'lucide-react';
import AppButton from '../ui/AppButton';
import {tr} from '../../i18n';
export default function PrintPreviewModal({title, html, onClose}: {title: string; html: string; onClose: () => void}) {
  const frameId = 'surgitrack-print-preview';
  const doPrint = () => {
    const frame = document.getElementById(frameId) as HTMLIFrameElement | null;
    frame?.contentWindow?.focus();
    frame?.contentWindow?.print();
  };
  return (
    <div className="modal-backdrop">
      <div className="print-preview-modal">
        <header>
          <div>
            <span className="eyebrow">{tr('ΠΡΟΕΠΙΣΚΟΠΗΣΗ')}</span>
            <h2>{title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label={tr('Κλείσιμο')}>
            <X size={18} />
          </button>
        </header>
        <div className="print-preview-body">
          <iframe id={frameId} title={title} srcDoc={html} />
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
