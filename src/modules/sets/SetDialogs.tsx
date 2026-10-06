import {useState} from 'react';
import {Camera, Trash2, X} from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import ReportTypeField from '../../components/assets/ReportTypeField';
import {filesToAssetPhotos} from '../../components/assets/photoUtils';
import {tr} from '../../i18n';
import type {AssetPhoto, SetAsset, Tool} from '../../types/domain';

/** Deleting a Set: keep its instruments (they go to Stock) or delete them with it; both stay in the bin for 30 days. */
export function SetDeleteDialog({
  memberCount,
  onClose,
  onDelete,
}: {
  memberCount: number;
  onClose: () => void;
  onDelete: (deleteTools: boolean) => void;
}) {
  return (
    <div className="modal-backdrop">
      <div className="confirm-dialog choice-dialog danger-choice">
        <header>
          <div className="confirm-icon">
            <Trash2 size={20} />
          </div>
          <div>
            <h3>{tr('Διαγραφή Σετ')}</h3>
            <p>
              {tr('Επίλεξε τι θα γίνει με τα') + ' '}
              {memberCount} {tr('φυσικά εργαλεία του Σετ.')}
            </p>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="choice-dialog-body">
          <button
            onClick={() => {
              if (
                window.confirm(
                  tr('Διαγραφή του Σετ; Τα εργαλεία του πάνε στο Απόθεμα και το Σετ μένει στον Κάδο για 30 ημέρες.'),
                )
              )
                onDelete(false);
            }}
          >
            <strong>{tr('Διαγραφή μόνο του Σετ')}</strong>
            <span>{tr('Τα εργαλεία αποδεσμεύονται και μεταφέρονται στο Απόθεμα.')}</span>
          </button>
          <button
            className="danger-option"
            onClick={() => {
              if (
                window.confirm(tr('Διαγραφή του Σετ ΚΑΙ όλων των εργαλείων του; Θα μείνουν στον Κάδο για 30 ημέρες.'))
              )
                onDelete(true);
            }}
          >
            <strong>{tr('Διαγραφή Σετ + εργαλείων')}</strong>
            <span>{tr('Διαγράφονται και τα φυσικά εργαλεία (επαναφορά από τον Κάδο).')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** A new report on a Set, or on some of the instruments in its composition. */
export function SetReportModal({
  set,
  members,
  canManage,
  canOpenManage,
  onClose,
  onManage,
  onSubmit,
}: {
  set: SetAsset;
  members: Tool[];
  canManage: boolean;
  canOpenManage: boolean;
  onClose: () => void;
  onManage: () => void;
  onSubmit: (toolIds: string[], type: string, note: string, photos: AssetPhoto[]) => void;
}) {
  const [target, setTarget] = useState<'SET' | 'TOOLS'>('SET');
  const [toolIds, setToolIds] = useState<string[]>([]);
  const [type, setType] = useState('Βλάβη');
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<AssetPhoto[]>([]);
  return (
    <div className="modal-backdrop">
      <div className="asset-modal set-report-modal">
        <header>
          <div>
            <h2>{tr('Νέα αναφορά')}</h2>
            <p>
              {set.barcode} {tr('· επίλεξε αν αφορά το Σετ ή εργαλεία της σύνθεσης.')}
            </p>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">
          <div className="report-target-switch">
            <button className={target === 'SET' ? 'active' : ''} onClick={() => setTarget('SET')}>
              {tr('Ολόκληρο Σετ')}
            </button>
            <button className={target === 'TOOLS' ? 'active' : ''} onClick={() => setTarget('TOOLS')}>
              {tr('Εργαλεία του Σετ')}
            </button>
          </div>
          {target === 'TOOLS' && (
            <div className="report-tool-picker">
              {members.map(tool => (
                <label key={tool.id}>
                  <input
                    type="checkbox"
                    checked={toolIds.includes(tool.id)}
                    onChange={e =>
                      setToolIds(ids => (e.target.checked ? [...ids, tool.id] : ids.filter(id => id !== tool.id)))
                    }
                  />
                  <span>
                    <strong>{tool.name}</strong>
                    <small>
                      {tool.barcode} · {tool.code}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          )}
          <div className="form-grid">
            <ReportTypeField
              kind="SET"
              value={type}
              onChange={setType}
              canManage={canManage}
              onManage={canOpenManage ? onManage : undefined}
            />
            <label className="span-2">
              {tr('Παρατήρηση')}
              <textarea
                rows={3}
                value={note}
                onChange={e => setNote(e.target.value)}
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
                onChange={async e => setPhotos(await filesToAssetPhotos(Array.from(e.target.files || [])))}
              />
              <small>
                {photos.length
                  ? tr('{0} φωτογραφίες έτοιμες', photos.length)
                  : tr('Λήψη από κάμερα ή επιλογή πολλών φωτογραφιών')}
              </small>
            </label>
          </div>
        </div>
        <footer>
          <AppButton onClick={onClose}>{tr('Ακύρωση')}</AppButton>
          <AppButton
            variant="primary"
            disabled={target === 'TOOLS' && !toolIds.length}
            onClick={() => onSubmit(target === 'TOOLS' ? toolIds : [], type, note, photos)}
          >
            {tr('Καταχώρηση αναφοράς')}
          </AppButton>
        </footer>
      </div>
    </div>
  );
}
