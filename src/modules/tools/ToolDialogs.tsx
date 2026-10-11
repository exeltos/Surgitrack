import {useState} from 'react';
import {Camera, X} from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import ReportTypeField from '../../components/assets/ReportTypeField';
import {filesToAssetPhotos} from '../../components/assets/photoUtils';
import type {AssetPhoto, Tool} from '../../types/domain';
import {tr} from '../../i18n';

/** A problem with an instrument: its type, a note and photos. */
export function ToolReportModal({
  tool,
  canManage,
  onManage,
  onClose,
  onSubmit,
}: {
  tool: Tool;
  canManage: boolean;
  /** Opens the instrument's management instead (absent while it is in a sterilization process). */
  onManage?: () => void;
  onClose: () => void;
  onSubmit: (type: string, note: string, photos: AssetPhoto[]) => void;
}) {
  const [reportType, setReportType] = useState('Βλάβη');
  const [reportNote, setReportNote] = useState('');
  const [reportPhotos, setReportPhotos] = useState<AssetPhoto[]>([]);
  return (
    <div className="modal-backdrop">
      <div className="asset-modal set-report-modal tool-report-modal">
        <header>
          <div>
            <h2>{tr('Νέα αναφορά')}</h2>
            <p>
              {tool.barcode} · {tool.name}
            </p>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">
          <div className="form-grid">
            <ReportTypeField
              kind="TOOL"
              value={reportType}
              onChange={setReportType}
              canManage={canManage}
              onManage={onManage}
            />
            <label className="span-2">
              {tr('Παρατήρηση')}
              <textarea
                rows={3}
                value={reportNote}
                onChange={e => setReportNote(e.target.value)}
                placeholder={tr('Περιγραφή συμβάντος...')}
              />
            </label>
            <label className="span-2 report-photo-input">
              <Camera size={17} /> {tr('Φωτογραφίες')}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={async e =>
                  setReportPhotos(await filesToAssetPhotos(Array.from(e.target.files || []), 'issues'))
                }
              />
              <small>
                {reportPhotos.length
                  ? tr('{0} φωτογραφίες έτοιμες', reportPhotos.length)
                  : tr('Λήψη από κάμερα ή επιλογή πολλών φωτογραφιών')}
              </small>
            </label>
          </div>
        </div>
        <footer>
          <AppButton onClick={onClose}>{tr('Ακύρωση')}</AppButton>
          <AppButton variant="primary" onClick={() => onSubmit(reportType, reportNote, reportPhotos)}>
            {tr('Καταχώρηση αναφοράς')}
          </AppButton>
        </footer>
      </div>
    </div>
  );
}
