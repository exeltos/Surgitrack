import {useState} from 'react';
import {Link, useNavigate, useParams} from 'react-router-dom';
import {ArrowLeft, Camera, Copy, Flag, History, Layers3, Printer, Send, Trash2, TriangleAlert, X} from 'lucide-react';
import {useSurgi} from '../../store/SurgiStore';
import type {AssetPhoto} from '../../types/domain';
import StatusBadge from '../../components/ui/StatusBadge';
import AssetTabs, {type AssetTab} from '../../components/assets/AssetTabs';
import UsageLimitCard from '../../components/assets/UsageLimitCard';
import AssetEmptyState from '../../components/assets/AssetEmptyState';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import PrintPreviewModal from '../../components/assets/PrintPreviewModal';
import AppButton from '../../components/ui/AppButton';
import {barcodeLabelHtml} from '../sterilization/printUtils';
import AssetPhotosCard from '../../components/assets/AssetPhotosCard';
import AssetWorkbenchSidebar from '../../components/assets/AssetWorkbenchSidebar';
import {filesToAssetPhotos} from '../../components/assets/photoUtils';
import DepartmentDispatchModal from '../../components/department/DepartmentDispatchModal';
import {tr, trData} from '../../i18n';

export default function ToolDetailPage() {
  const {
    sets,
    tools,
    movements,
    issues,
    reportIssue,
    addAssetPhotos,
    removeAssetPhoto,
    updateTool,
    duplicateTool,
    deleteTool,
    role,
    currentUser,
    can,
  } = useSurgi();
  const navigate = useNavigate();
  const {id} = useParams();
  const tool = tools.find(item => item.id === id);
  const [tab, setTab] = useState<AssetTab>('HISTORY');
  const [photosOpen, setPhotosOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBlockedOpen, setDeleteBlockedOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [reportType, setReportType] = useState('Βλάβη');
  const [reportNote, setReportNote] = useState('');
  const [reportPhotos, setReportPhotos] = useState<AssetPhoto[]>([]);
  if (!tool)
    return (
      <div className="empty">
        <strong>{tr('Το εργαλείο δεν βρέθηκε.')}</strong>
        <span>{tr('Επιστρέψτε στη λίστα εργαλείων και επιλέξτε ξανά.')}</span>
        <Link className="primary-link" to={role === 'DEPARTMENT' ? '/department' : '/tools'}>
          {tr('Πίσω στη λίστα')}
        </Link>
      </div>
    );
  if (role === 'DEPARTMENT' && tool.department !== currentUser.department)
    return (
      <div className="empty">
        <strong>{tr('Δεν υπάρχει πρόσβαση σε αυτό το εργαλείο.')}</strong>
        <span>{tr('Ο χρήστης του τμήματος βλέπει μόνο τον εξοπλισμό του δικού του τμήματος.')}</span>
        <Link className="primary-link" to="/department">
          {tr('Πίσω στα Σετ & Εργαλεία')}
        </Link>
      </div>
    );

  const set = sets.find(item => item.id === tool.setId);
  const knownBarcodes = [tool.barcode, ...(tool.legacyBarcodes || [])];
  const history = movements
    .filter(movement => knownBarcodes.some(barcode => movement.asset.includes(barcode)))
    .slice(0, 30);
  const toolIssues = issues.filter(issue => issue.status === 'OPEN' && issue.asset.startsWith(tool.barcode));
  const location = set
    ? `Set ${set.barcode}`
    : tool.mode === 'STOCK'
      ? 'Stock'
      : tool.department
        ? trData(tool.department)
        : tr('Μεμονωμένο');
  const departmentView = role === 'DEPARTMENT';
  const backTo = departmentView ? '/department' : '/tools';
  const workflowLocked = !['IN_DEPARTMENT', 'IN_STOCK', 'SERVICE', 'LOST'].includes(tool.state);

  return (
    <div className="asset-detail-workspace tool-detail-workspace legacy-inspired-workspace">
      <div className="asset-workbench-actions">
        <div className="asset-action-group">
          {can('asset.barcode.reissue') && (
            <AppButton icon={<Printer size={18} />} onClick={() => setPreview(true)}>
              {tr('Εκτύπωση Barcode')}
            </AppButton>
          )}
          {can('asset.duplicate') && (
            <AppButton icon={<Copy size={18} />} onClick={() => setDuplicateOpen(true)}>
              Duplicate
            </AppButton>
          )}
          {can('asset.delete') && (
            <AppButton
              variant="danger"
              icon={<Trash2 size={18} />}
              title={
                workflowLocked
                  ? tr('Η διαγραφή είναι κλειδωμένη όσο το εργαλείο βρίσκεται σε ενεργή διαδικασία αποστείρωσης.')
                  : undefined
              }
              onClick={() => (workflowLocked ? setDeleteBlockedOpen(true) : setDeleteOpen(true))}
            >
              {tr('Διαγραφή Εργαλείου')}
            </AppButton>
          )}
          {can('issue.create') && (
            <AppButton icon={<Flag size={18} />} onClick={() => setReportOpen(true)}>
              {tr('Αναφορά')}
            </AppButton>
          )}
          {can('department.dispatch') && tool.state === 'IN_DEPARTMENT' && (
            <AppButton variant="primary" icon={<Send size={18} />} onClick={() => setDispatchOpen(true)}>
              {tr('Προς Αποστείρωση')}
            </AppButton>
          )}
        </div>
        <div className="asset-action-group">
          <Link to={backTo} className="asset-action-link">
            <ArrowLeft size={18} /> {tr('Πίσω στη λίστα')}
          </Link>
        </div>
      </div>
      <div className="asset-workbench-grid">
        <AssetWorkbenchSidebar
          kind="TOOL"
          asset={tool}
          setName={set ? `${set.barcode} · ${set.name}` : undefined}
          setDepartment={trData(set?.department)}
          onPhotos={() => setPhotosOpen(true)}
          workflowLocked={workflowLocked}
          onSave={can('asset.edit') ? patch => updateTool(tool.id, patch) : undefined}
        />
        <section className="asset-workbench-main">
          <AssetTabs value={tab} onChange={setTab} issueCount={toolIssues.length} className="asset-detail-tabs" />
          <main className="asset-detail-body">
            {tab === 'HISTORY' && (
              <section className="asset-section asset-detail-full-panel">
                <div className="asset-section-head">
                  <div>
                    <span className="eyebrow">{tr('ΙΧΝΗΛΑΣΙΜΟΤΗΤΑ')}</span>
                    <h2>{tr('Ιστορικό κινήσεων')}</h2>
                    <p>{tr('Όλες οι κινήσεις του συγκεκριμένου φυσικού εργαλείου.')}</p>
                  </div>
                  <History size={19} />
                </div>
                <div className="asset-history asset-detail-scroll">
                  {history.length ? (
                    history.map(item => (
                      <div className="asset-history-row" key={item.id}>
                        <span className="history-dot" />
                        <div>
                          <strong>{trData(item.status)}</strong>
                          <p>
                            {trData(item.from)} → {trData(item.to)}
                          </p>
                          <small>
                            {item.at} · {trData(item.by)}
                          </small>
                        </div>
                      </div>
                    ))
                  ) : (
                    <AssetEmptyState>{tr('Δεν υπάρχει καταγεγραμμένη κίνηση.')}</AssetEmptyState>
                  )}
                </div>
              </section>
            )}
            {tab === 'ISSUES' && (
              <section className="asset-section asset-detail-full-panel">
                <div className="asset-section-head">
                  <div>
                    <span className="eyebrow">{tr('ΕΚΚΡΕΜΟΤΗΤΕΣ')}</span>
                    <h2>{tr('Ανοικτές αναφορές')}</h2>
                  </div>
                </div>
                <div className="asset-detail-scroll asset-issue-list">
                  {toolIssues.length ? (
                    toolIssues.map(issue => (
                      <div className="asset-issue-row" key={issue.id}>
                        <TriangleAlert size={17} />
                        <div>
                          <strong>{trData(issue.type)}</strong>
                          <span>{issue.created}</span>
                          <small>{issue.note}</small>
                          {issue.photos?.length ? (
                            <div className="asset-issue-photos">
                              {issue.photos.map(photo => (
                                <img key={photo.id} src={photo.dataUrl} alt={photo.name} />
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))
                  ) : (
                    <AssetEmptyState>{tr('Δεν υπάρχουν ανοικτές εκκρεμότητες.')}</AssetEmptyState>
                  )}
                </div>
              </section>
            )}
            {tab === 'SUMMARY' && (
              <section className="asset-section asset-detail-full-panel">
                <div className="asset-section-head">
                  <div>
                    <span className="eyebrow">{tr('ΣΥΝΟΨΗ')}</span>
                    <h2>{tr('Κατάσταση & κύκλος ζωής')}</h2>
                    <p>{tr('Η λειτουργική εικόνα του εργαλείου χωρίς επανάληψη των στοιχείων ταυτότητας.')}</p>
                  </div>
                </div>
                <div className="asset-section-body">
                  <UsageLimitCard
                    uses={tool.uses}
                    maxUses={tool.maxUses}
                    description={tr('Κύκλος ζωής του εργαλείου, όταν έχει οριστεί όριο χρήσεων.')}
                  />
                  <dl className="asset-definition-list compact-status-list">
                    <div>
                      <dt>{tr('Αποστειρώσεις')}</dt>
                      <dd>{tool.sterilizations}</dd>
                    </div>
                    <div>
                      <dt>{tr('Τρέχουσα θέση')}</dt>
                      <dd>{location}</dd>
                    </div>
                    <div>
                      <dt>{tr('Κατάσταση')}</dt>
                      <dd>
                        <StatusBadge value={tool.state} />
                      </dd>
                    </div>
                    <div>
                      <dt>{tr('Ανοικτές εκκρεμότητες')}</dt>
                      <dd className={toolIssues.length ? 'warn-text' : ''}>{toolIssues.length}</dd>
                    </div>
                  </dl>
                  {set && (
                    <Link className="asset-related-set-link" to={`/sets/${set.id}`}>
                      <Layers3 size={17} />
                      <span>
                        <small>{tr('Ανήκει στο Σετ')}</small>
                        <strong>
                          {set.barcode} · {set.name}
                        </strong>
                      </span>
                    </Link>
                  )}
                </div>
              </section>
            )}
            {tab === 'NOTES' && (
              <section className="asset-section asset-detail-full-panel">
                <div className="asset-section-head">
                  <div>
                    <span className="eyebrow">{tr('ΣΗΜΕΙΩΣΕΙΣ')}</span>
                    <h2>{tr('Μόνιμες παρατηρήσεις')}</h2>
                  </div>
                </div>
                <div className="asset-section-body asset-notes-tab">
                  {tool.notes ? (
                    <p>{tool.notes}</p>
                  ) : (
                    <AssetEmptyState>{tr('Δεν υπάρχουν σημειώσεις.')}</AssetEmptyState>
                  )}
                </div>
              </section>
            )}
          </main>
        </section>
      </div>

      {photosOpen && (
        <div className="modal-backdrop" onMouseDown={e => e.currentTarget === e.target && setPhotosOpen(false)}>
          <div className="asset-modal asset-photo-manager-modal">
            <header>
              <div>
                <h2>{tr('Φωτογραφίες Εργαλείου')}</h2>
                <p>
                  {tool.barcode} · {tool.name}
                </p>
              </div>
              <button className="icon-button modal-close-right" onClick={() => setPhotosOpen(false)}>
                <X size={18} />
              </button>
            </header>
            <div className="modal-body">
              <AssetPhotosCard
                photos={tool.photos || []}
                onAdd={async files => addAssetPhotos('TOOL', tool.id, await filesToAssetPhotos(files))}
                onRemove={photoId => removeAssetPhoto('TOOL', tool.id, photoId)}
                readOnly={!can('asset.photos.manage')}
                description={
                  !can('asset.photos.manage')
                    ? tr('Φωτογραφική τεκμηρίωση του εργαλείου. Προβολή μόνο για τον ενεργό ρόλο.')
                    : tr('Πολλαπλές φωτογραφίες. Η λήψη ενεργοποιεί την κάμερα της συσκευής.')
                }
              />
            </div>
          </div>
        </div>
      )}
      {preview && (
        <PrintPreviewModal
          title={`Barcode ${tool.barcode}`}
          html={barcodeLabelHtml(tool, 'TOOL')}
          onClose={() => setPreview(false)}
        />
      )}
      {dispatchOpen && (
        <DepartmentDispatchModal
          kind="TOOL"
          id={tool.id}
          barcode={tool.barcode}
          name={tool.name}
          onClose={() => setDispatchOpen(false)}
        />
      )}
      {can('asset.duplicate') && duplicateOpen && (
        <ConfirmDialog
          title={tr('Επιβεβαίωση Duplicate εργαλείου')}
          message={tr(
            'Θα δημιουργηθεί νέο φυσικό εργαλείο με τα ίδια βασικά στοιχεία, νέο μοναδικό barcode και χωρίς ιστορικό ή καταγεγραμμένες χρήσεις. Το νέο εργαλείο θα τοποθετηθεί στο Stock. Θέλεις να συνεχίσεις;',
          )}
          confirmLabel={tr('Ναι, δημιουργία αντιγράφου')}
          onConfirm={() => {
            const newId = duplicateTool(tool.id);
            setDuplicateOpen(false);
            if (newId) navigate(`/tools/${newId}`);
          }}
          onClose={() => setDuplicateOpen(false)}
        />
      )}
      {can('asset.delete') && deleteBlockedOpen && (
        <ConfirmDialog
          title={tr('Η διαγραφή δεν επιτρέπεται')}
          message={tr(
            'Το {0} βρίσκεται σε ενεργή διαδικασία αποστείρωσης. Η διαδικασία πρέπει να ολοκληρωθεί ή να ακυρωθεί με καταγεγραμμένο τρόπο πριν επιτραπεί η διαγραφή του εργαλείου.',
            tool.barcode,
          )}
          confirmLabel={tr('Κατάλαβα')}
          onConfirm={() => setDeleteBlockedOpen(false)}
          onClose={() => setDeleteBlockedOpen(false)}
        />
      )}
      {can('asset.delete') && deleteOpen && (
        <ConfirmDialog
          title={tr('Επιβεβαίωση διαγραφής εργαλείου')}
          message={
            set
              ? tr(
                  'Πρόκειται να διαγραφεί οριστικά το {0} και να αφαιρεθεί από τη σύνθεση του {1}. Η ενέργεια δεν αναιρείται. Θέλεις να συνεχίσεις;',
                  tool.barcode,
                  set.barcode,
                )
              : tr(
                  'Πρόκειται να διαγραφεί οριστικά το {0}. Η ενέργεια δεν αναιρείται. Θέλεις να συνεχίσεις;',
                  tool.barcode,
                )
          }
          confirmLabel={tr('Ναι, οριστική διαγραφή')}
          danger
          onConfirm={() => {
            deleteTool(tool.id);
            setDeleteOpen(false);
            navigate('/tools');
          }}
          onClose={() => setDeleteOpen(false)}
        />
      )}
      {can('issue.create') && reportOpen && (
        <div className="modal-backdrop">
          <div className="asset-modal set-report-modal tool-report-modal">
            <header>
              <div>
                <h2>{tr('Νέα αναφορά')}</h2>
                <p>
                  {tool.barcode} · {tool.name}
                </p>
              </div>
              <button className="icon-button" onClick={() => setReportOpen(false)}>
                <X size={18} />
              </button>
            </header>
            <div className="modal-body">
              <div className="form-grid">
                <label>
                  {tr('Τύπος αναφοράς')}
                  <select value={reportType} onChange={e => setReportType(e.target.value)}>
                    <option>{tr('Βλάβη')}</option>
                    <option>{tr('Φθορά')}</option>
                    <option>{tr('Απώλεια')}</option>
                    <option>{tr('Έλλειψη')}</option>
                    <option>Service</option>
                    <option>{tr('Άλλο')}</option>
                  </select>
                </label>
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
                    onChange={async e => setReportPhotos(await filesToAssetPhotos(Array.from(e.target.files || [])))}
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
              <AppButton onClick={() => setReportOpen(false)}>{tr('Ακύρωση')}</AppButton>
              <AppButton
                variant="primary"
                onClick={() => {
                  reportIssue(tool.id, reportType, reportNote, 'Καρτέλα Εργαλείου', reportPhotos);
                  setReportOpen(false);
                  setReportNote('');
                  setReportPhotos([]);
                }}
              >
                {tr('Καταχώρηση αναφοράς')}
              </AppButton>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
