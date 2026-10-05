import AssetTypeIcon from '../../../components/assets/AssetTypeIcon';
import {TriangleAlert, X, Camera, ImagePlus, Trash2} from 'lucide-react';
import {tr} from '../../../i18n';
import type {SterilizationPageState} from '../useSterilizationPage';

export default function IssueReportModal({s}: {s: SterilizationPageState}) {
  const {
    addIssuePhotos,
    closeIssueReport,
    issueNote,
    issuePhotos,
    issueSource,
    issueTarget,
    issueType,
    saveIssueReport,
    setIssueCameraOpen,
    setIssueNote,
    setIssuePhotos,
    setIssueType,
    sets,
    tools,
  } = s;
  return (
    <>
      {issueTarget && (
        <div className="nested-modal-backdrop" onMouseDown={closeIssueReport}>
          <div className="tool-issue-card" onMouseDown={e => e.stopPropagation()}>
            <button className="modal-x" aria-label={tr('Κλείσιμο')} title={tr('Κλείσιμο')} onClick={closeIssueReport}>
              <X size={17} />
            </button>
            <span className="eyebrow">{issueTarget.kind === 'SET' ? tr('ΑΝΑΦΟΡΑ ΣΕΤ') : tr('ΑΝΑΦΟΡΑ ΕΡΓΑΛΕΙΟΥ')}</span>
            <h3>
              {issueTarget.kind === 'SET'
                ? `${sets.find(x => x.id === issueTarget.id)?.barcode || ''} · ${sets.find(x => x.id === issueTarget.id)?.name || ''}`
                : `${tools.find(t => t.id === issueTarget.id)?.barcode || ''} · ${tools.find(t => t.id === issueTarget.id)?.name || ''}`}
            </h3>
            <div className="issue-context">
              <AssetTypeIcon
                kind={issueTarget.kind}
                maxUses={issueTarget.kind === 'TOOL' ? tools.find(t => t.id === issueTarget.id)?.maxUses : undefined}
                framed
                size={18}
              />
              <span>{issueSource}</span>
            </div>
            <label>
              {tr('Τύπος αναφοράς')}
              <select value={issueType} onChange={e => setIssueType(e.target.value)}>
                <option>{tr('Βλάβη / μη λειτουργικό')}</option>
                <option>{tr('Φθορά')}</option>
                <option>{tr('Κατεστραμμένο')}</option>
                {issueTarget.kind === 'SET' && <option>{tr('Έλλειψη σύνθεσης')}</option>}
                <option>{tr('Άλλο πρόβλημα')}</option>
              </select>
            </label>
            <label>
              {tr('Παρατήρηση')}
              <textarea
                value={issueNote}
                onChange={e => setIssueNote(e.target.value)}
                placeholder={
                  issueTarget.kind === 'SET'
                    ? tr('Περιέγραψε το πρόβλημα που αφορά το Σετ…')
                    : tr('Περιέγραψε τι διαπιστώθηκε στο εργαλείο…')
                }
              />
            </label>
            <div className="issue-photo-field">
              <div className="issue-photo-head">
                <div>
                  <strong>{tr('Φωτογραφίες φθοράς / βλάβης')}</strong>
                  <span>{tr('Προαιρετικά, μία ή περισσότερες φωτογραφίες.')}</span>
                </div>
                <div className="issue-photo-actions">
                  <button
                    type="button"
                    className="app-button app-button-secondary app-button-sm"
                    onClick={() => setIssueCameraOpen(true)}
                  >
                    <Camera size={15} /> {tr('Λήψη')}
                  </button>
                  <label className="app-button app-button-secondary app-button-sm">
                    <ImagePlus size={15} /> Upload
                    <input
                      className="visually-hidden-file"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={async e => {
                        await addIssuePhotos([...(e.currentTarget.files || [])]);
                        e.currentTarget.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>
              {issuePhotos.length > 0 && (
                <div className="issue-photo-preview">
                  {issuePhotos.map(photo => (
                    <div key={photo.id}>
                      <img src={photo.dataUrl} alt={photo.name} />
                      <button
                        type="button"
                        onClick={() => setIssuePhotos(current => current.filter(item => item.id !== photo.id))}
                        aria-label={tr('Αφαίρεση φωτογραφίας')}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" onClick={closeIssueReport}>
                {tr('Ακύρωση')}
              </button>
              <button type="button" className="primary" onClick={saveIssueReport}>
                <TriangleAlert size={15} /> {tr('Καταχώρηση αναφοράς')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
