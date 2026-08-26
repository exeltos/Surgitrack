import {Download, Printer, X} from 'lucide-react';
import AppButton from '../ui/AppButton';
export default function PrintPreviewModal({title, html, onClose}: {title: string; html: string; onClose: () => void}) {
  const frameId = 'surgitrack-print-preview';
  const doPrint = () => {
    const frame = document.getElementById(frameId) as HTMLIFrameElement | null;
    frame?.contentWindow?.focus();
    frame?.contentWindow?.print();
  };
  const download = () => {
    const blob = new Blob([html], {type: 'text/html;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9_-]+/g, '_')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="modal-backdrop">
      <div className="print-preview-modal">
        <header>
          <div>
            <span className="eyebrow">ΠΡΟΕΠΙΣΚΟΠΗΣΗ</span>
            <h2>{title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Κλείσιμο">
            <X size={18} />
          </button>
        </header>
        <div className="print-preview-body">
          <iframe id={frameId} title={title} srcDoc={html} />
        </div>
        <footer>
          <AppButton onClick={onClose}>Κλείσιμο</AppButton>
          <AppButton icon={<Download size={16} />} onClick={download}>
            Λήψη
          </AppButton>
          <AppButton variant="primary" icon={<Printer size={16} />} onClick={doPrint}>
            Εκτύπωση / PDF
          </AppButton>
        </footer>
      </div>
    </div>
  );
}
