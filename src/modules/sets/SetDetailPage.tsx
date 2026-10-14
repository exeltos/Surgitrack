import {useMemo, useState} from 'react';
import BrowseArrows from '../../components/assets/BrowseArrows';
import {Link, useNavigate, useParams, useSearchParams} from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRightLeft,
  Barcode,
  Copy,
  Flag,
  History,
  Printer,
  Send,
  Settings2,
  Trash2,
  TriangleAlert,
  X,
  ClipboardCheck,
} from 'lucide-react';
import {useSurgi} from '../../store/SurgiStore';
import AssetTabs, {type AssetTab} from '../../components/assets/AssetTabs';
import UsageLimitCard from '../../components/assets/UsageLimitCard';
import AssetEmptyState from '../../components/assets/AssetEmptyState';
import AddToolsToSetModal from '../../components/assets/AddToolsToSetModal';
import PrintPreviewModal from '../../components/assets/PrintPreviewModal';
import BarcodeLabelPreview from '../../components/assets/BarcodeLabelPreview';
import {useCompositionOptions} from '../../components/assets/usePrintLook';
import AppButton from '../../components/ui/AppButton';
import {compositionHtml} from '../sterilization/printUtils';
import AssetPhotosCard from '../../components/assets/AssetPhotosCard';
import AssetWorkbenchSidebar from '../../components/assets/AssetWorkbenchSidebar';
import {filesToAssetPhotos} from '../../components/assets/photoUtils';
import DepartmentDispatchModal from '../../components/department/DepartmentDispatchModal';
import {tr, trData} from '../../i18n';
import {useRememberedState} from '../../core/listMemory';
import BackLink from '../../components/ui/BackLink';
import {SetDeleteDialog, SetDuplicateDialog, SetReportModal} from './SetDialogs';
import AssetManageModal from '../../components/assets/AssetManageModal';
import ColorMarkerPicker from '../../components/assets/ColorMarkerPicker';
import {markerText, useColorTapes} from '../../components/assets/colorMarkerUtils';
import ActionMenu from '../../components/ui/ActionMenu';
import NewBarcodeModal from '../../components/assets/NewBarcodeModal';
import {useConfirm} from '../../components/ui/useConfirm';
import {printCountForm} from '../../components/department/printCountForm';
import {formatDateTime} from '../../core/displayDate';
import SetContents from './SetContents';

export default function SetDetailPage() {
  const {
    sets,
    tools,
    movements,
    issues,
    currentUser,
    duplicateSet,
    deleteSet,
    reportSetIssue,
    markLost,
    addAssetPhotos,
    removeAssetPhoto,
    updateSet,
    role,
    can,
    setColorMarker,
    counts,
    preparations,
    sterilizationReleases,
    organizationName,
    correctUses,
  } = useSurgi();
  const navigate = useNavigate();
  const [confirmNode, ask] = useConfirm();
  const {id} = useParams();
  const [searchParams] = useSearchParams();
  const scannedOldBarcode = searchParams.get('replaced');
  const set = sets.find(item => item.id === id);
  const [tab, setTab] = useRememberedState<AssetTab>('tab', 'CONTENTS');
  const [photosOpen, setPhotosOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [newBarcodeOpen, setNewBarcodeOpen] = useState(false);
  const [markerOpen, setMarkerOpen] = useState(false);
  const tapesById = useColorTapes();
  const compositionOptions = useCompositionOptions();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [addToolsOpen, setAddToolsOpen] = useState(false);

  const [preview, setPreview] = useState<'COMPOSITION' | 'BARCODE' | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Hooks must run unconditionally on every render (Rules of Hooks), so the
  // "set not found" / "wrong department" guards below happen AFTER these,
  // using optional access so they stay safe when `set` is undefined.
  const members = useMemo(() => (set ? tools.filter(tool => tool.setId === set.id) : []), [tools, set]);

  if (!set)
    return (
      <div className="empty">
        <strong>{tr('Το Σετ δεν βρέθηκε.')}</strong>
        <span>{tr('Επιστρέψτε στη λίστα των Σετ και επιλέξτε ξανά.')}</span>
        <Link className="primary-link" to={role === 'DEPARTMENT' ? '/department' : '/sets'}>
          {tr('Πίσω στη λίστα')}
        </Link>
      </div>
    );
  if (role === 'DEPARTMENT' && set.department !== currentUser.department)
    return (
      <div className="empty">
        <strong>{tr('Δεν υπάρχει πρόσβαση σε αυτό το Σετ.')}</strong>
        <span>{tr('Ο χρήστης του τμήματος βλέπει μόνο τον εξοπλισμό του δικού του τμήματος.')}</span>
        <Link className="primary-link" to="/department">
          {tr('Πίσω στα Σετ & Εργαλεία')}
        </Link>
      </div>
    );

  const knownBarcodes = [set.barcode, ...(set.legacyBarcodes || [])];
  const history = movements
    .filter(movement => knownBarcodes.some(barcode => movement.asset.includes(barcode)))
    .slice(0, 30);
  const memberIssues = issues.filter(
    issue =>
      issue.status === 'OPEN' &&
      (issue.asset.startsWith(set.barcode) || members.some(tool => issue.asset.startsWith(tool.barcode))),
  );
  const missing = Math.max(0, set.expected - members.length);
  const complete = missing === 0;
  const preparedAt = formatDateTime();
  const uses = set.uses || 0;
  const departmentView = role === 'DEPARTMENT';
  const backTo = departmentView ? '/department' : '/sets';
  const workflowLocked = !['IN_DEPARTMENT', 'IN_STOCK', 'SERVICE', 'LOST'].includes(set.state);

  return (
    <div className="asset-detail-workspace set-detail-workspace legacy-inspired-workspace">
      <div className="asset-workbench-actions">
        <div className="asset-action-group">
          <BackLink fallback={backTo} className="asset-action-link">
            <ArrowLeft size={18} /> {tr('Πίσω στη λίστα')}
          </BackLink>
          {!departmentView && <BrowseArrows base="/sets" id={set.id} />}
        </div>
        <div className="asset-action-group">
          <ActionMenu
            icon={<Printer size={18} />}
            label={tr('Εκτύπωση')}
            items={[
              {
                key: 'composition',
                icon: <Printer size={16} />,
                label: tr('Σύνθεση Σετ'),
                hint: tr('Λίστα εργαλείων για έλεγχο και αρχειοθέτηση'),
                onSelect: () => setPreview('COMPOSITION'),
              },
              {
                key: 'count',
                icon: <ClipboardCheck size={16} />,
                label: tr('Έντυπο καταμέτρησης'),
                hint: tr('Αποστείρωση προϋπογεγραμμένη · καταμέτρηση χειρουργείου'),
                onSelect: () => {
                  // The latest count since the Set left Sterilization; otherwise part B prints blank.
                  const release = sterilizationReleases.find(r => r.assetId === set.id && r.decision === 'RELEASED');
                  const count = counts.find(c => c.setId === set.id);
                  printCountForm({
                    asset: set,
                    items: members.filter(t => t.state !== 'RETIRED'),
                    hospital: organizationName,
                    preparation: preparations.find(r => r.assetId === set.id),
                    release,
                    count: set.state === 'IN_DEPARTMENT' ? undefined : count,
                  });
                },
              },
              ...(can('asset.barcode.reissue')
                ? [
                    {
                      key: 'label',
                      icon: <Barcode size={16} />,
                      label: tr('Ετικέτα barcode'),
                      hint: tr('Ανατύπωση της ίδιας ετικέτας'),
                      onSelect: () => setPreview('BARCODE'),
                    },
                  ]
                : []),
            ]}
          />
          <ActionMenu
            icon={<Settings2 size={18} />}
            label={tr('Ενέργειες')}
            align="right"
            items={[
              ...(can('issue.create')
                ? [
                    {
                      key: 'report',
                      icon: <Flag size={16} />,
                      label: tr('Αναφορά προβλήματος'),
                      hint: can('asset.composition.manage')
                        ? tr('Βλάβη, φθορά, έλλειψη ή άλλο πρόβλημα')
                        : tr('Βλάβη, φθορά, έλλειψη, απώλεια ή άλλο πρόβλημα'),
                      onSelect: () => setReportOpen(true),
                    },
                  ]
                : []),
              ...(can('asset.composition.manage')
                ? [
                    {
                      key: 'moves',
                      icon: <ArrowRightLeft size={16} />,
                      label: tr('Διαχείριση'),
                      hint: tr('Τμήμα, Service, απώλεια, επιστροφή'),
                      disabled: workflowLocked,
                      title: workflowLocked
                        ? tr('Η διαχείριση είναι κλειδωμένη όσο βρίσκεται σε ενεργή διαδικασία αποστείρωσης.')
                        : undefined,
                      onSelect: () => setManageOpen(true),
                    },
                  ]
                : []),
              ...(can('asset.barcode.reissue')
                ? [
                    {
                      key: 'barcode',
                      icon: <Barcode size={16} />,
                      label: tr('Νέο barcode'),
                      hint: tr('Όταν η ετικέτα χάθηκε, φθάρηκε ή είναι διπλή'),
                      onSelect: () => setNewBarcodeOpen(true),
                    },
                  ]
                : []),
              ...(can('asset.duplicate')
                ? [
                    {
                      key: 'duplicate',
                      icon: <Copy size={16} />,
                      label: tr('Αντίγραφο'),
                      hint: tr('Νέο Σετ με τα ίδια στοιχεία'),
                      onSelect: () => setDuplicateOpen(true),
                    },
                  ]
                : []),
              ...(can('asset.delete')
                ? [
                    {
                      key: 'delete',
                      icon: <Trash2 size={16} />,
                      label: tr('Διαγραφή Σετ'),
                      danger: true,
                      disabled: workflowLocked,
                      title: workflowLocked
                        ? tr('Δεν επιτρέπεται διαγραφή όσο το Σετ βρίσκεται σε ενεργή διαδικασία αποστείρωσης.')
                        : undefined,
                      onSelect: () => setDeleteOpen(true),
                    },
                  ]
                : []),
            ]}
          />
          {can('department.dispatch') && set.state === 'IN_DEPARTMENT' && (
            <AppButton variant="primary" icon={<Send size={18} />} onClick={() => setDispatchOpen(true)}>
              {tr('Προς Αποστείρωση')}
            </AppButton>
          )}
        </div>
      </div>
      {scannedOldBarcode && (
        <div className="replaced-barcode-banner">
          <Barcode size={18} />
          <span>
            {tr(
              'Σαρώθηκε παλιό barcode {0}. Το τωρινό barcode είναι {1}: κολλήστε τη νέα ετικέτα.',
              scannedOldBarcode,
              set.barcode,
            )}
          </span>
        </div>
      )}
      <div className="asset-workbench-grid">
        <AssetWorkbenchSidebar
          kind="SET"
          asset={set}
          memberCount={members.length}
          expectedCount={set.expected}
          onPhotos={() => setPhotosOpen(true)}
          workflowLocked={workflowLocked}
          onSave={can('asset.edit') ? patch => updateSet(set.id, patch) : undefined}
          markerTapes={set.colorTapes}
          onEditMarker={can('asset.edit') && !workflowLocked ? () => setMarkerOpen(true) : undefined}
          canEditUsage={can('asset.usage.configure')}
          onCorrectUses={can('asset.usage.configure') ? delta => correctUses('SET', set.id, delta) : undefined}
        />
        <section className="asset-workbench-main">
          <AssetTabs
            value={tab}
            onChange={setTab}
            issueCount={memberIssues.length}
            showContents
            className="asset-detail-tabs"
          />
          <div className="asset-detail-body">
            {tab === 'SUMMARY' && (
              <section className="asset-section asset-detail-full-panel">
                <div className="asset-section-head">
                  <div>
                    <span className="eyebrow">{tr('ΣΥΝΟΨΗ')}</span>
                    <h2>{tr('Κατάσταση & κύκλος ζωής')}</h2>
                    <p>{tr('Μόνο η λειτουργική σύνοψη του Σετ· τα στοιχεία ταυτότητας παραμένουν αριστερά.')}</p>
                  </div>
                </div>
                <div className="asset-section-body">
                  <UsageLimitCard
                    uses={uses}
                    maxUses={set.maxUses}
                    onCorrect={can('asset.usage.configure') ? delta => correctUses('SET', set.id, delta) : undefined}
                    description={tr('Κύκλος ζωής του Σετ, όταν έχει οριστεί όριο χρήσεων.')}
                  />
                  <dl className="asset-definition-list compact-status-list">
                    <div>
                      <dt>{tr('Σύνθεση')}</dt>
                      <dd className={missing ? 'warn-text' : ''}>
                        {members.length}/{set.expected}
                      </dd>
                    </div>
                    <div>
                      <dt>{tr('Ελλείψεις')}</dt>
                      <dd className={missing ? 'warn-text' : ''}>{missing}</dd>
                    </div>
                    <div>
                      <dt>{tr('Ανοικτές εκκρεμότητες')}</dt>
                      <dd className={memberIssues.length ? 'warn-text' : ''}>{memberIssues.length}</dd>
                    </div>
                  </dl>
                  {!complete && (
                    <div className="asset-alert warning asset-side-alert">
                      <TriangleAlert size={18} />
                      <div>
                        <strong>{tr('Μη πλήρης σύνθεση')}</strong>
                        <span>
                          {tr('Λείπουν') + ' '}
                          {missing} {missing === 1 ? tr('φυσικό εργαλείο') : tr('φυσικά εργαλεία')}.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {tab === 'CONTENTS' && (
              <SetContents
                set={set}
                members={members}
                memberIssues={memberIssues}
                workflowLocked={workflowLocked}
                expandedGroups={expandedGroups}
                setExpandedGroups={setExpandedGroups}
                onAddTools={() => setAddToolsOpen(true)}
              />
            )}

            {tab === 'HISTORY' && (
              <section className="asset-section asset-detail-full-panel">
                <div className="asset-section-head">
                  <div>
                    <span className="eyebrow">{tr('ΙΧΝΗΛΑΣΙΜΟΤΗΤΑ')}</span>
                    <h2>{tr('Ιστορικό κινήσεων')}</h2>
                  </div>
                  <History size={19} />
                </div>
                <div
                  className="asset-history asset-detail-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label={tr('Ιστορικό κινήσεων')}
                >
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
                            {item.patientCode ? ` · ${item.patientCode}` : ''}
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
                  {memberIssues.length ? (
                    memberIssues.map(issue => (
                      <div className="asset-issue-row" key={issue.id}>
                        <TriangleAlert size={17} />
                        <div>
                          <strong>{issue.asset}</strong>
                          <span>{trData(issue.type)}</span>
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
            {tab === 'NOTES' && (
              <section className="asset-section asset-detail-full-panel">
                <div className="asset-section-head">
                  <div>
                    <span className="eyebrow">{tr('ΣΗΜΕΙΩΣΕΙΣ')}</span>
                    <h2>{tr('Μόνιμες παρατηρήσεις')}</h2>
                  </div>
                </div>
                <div className="asset-section-body asset-notes-tab">
                  {set.notes ? (
                    <p>{set.notes}</p>
                  ) : (
                    <AssetEmptyState>{tr('Δεν υπάρχουν σημειώσεις για το Σετ.')}</AssetEmptyState>
                  )}
                </div>
              </section>
            )}
          </div>
        </section>
      </div>
      {!departmentView && addToolsOpen && <AddToolsToSetModal setId={set.id} onClose={() => setAddToolsOpen(false)} />}
      {preview === 'COMPOSITION' && (
        <PrintPreviewModal
          title={tr('Σύνθεση {0}', set.barcode)}
          html={compositionHtml(
            set,
            members,
            currentUser.name,
            preparedAt,
            memberIssues.map(issue => ({barcode: issue.asset.split(' · ')[0], type: issue.type})),
            compositionOptions(set.colorTapes),
          )}
          onClose={() => setPreview(null)}
        />
      )}
      {preview === 'BARCODE' && (
        <BarcodeLabelPreview asset={set} kind="SET" toolCount={members.length} onClose={() => setPreview(null)} />
      )}
      {photosOpen && (
        <div className="modal-backdrop" onMouseDown={e => e.currentTarget === e.target && setPhotosOpen(false)}>
          <div className="asset-modal asset-photo-manager-modal">
            <header>
              <div>
                <h2>{tr('Φωτογραφίες Σετ')}</h2>
                <p>
                  {set.barcode} · {set.name}
                </p>
              </div>
              <button className="icon-button" onClick={() => setPhotosOpen(false)}>
                <X size={18} />
              </button>
            </header>
            <div className="modal-body">
              <AssetPhotosCard
                photos={set.photos || []}
                onAdd={async files => addAssetPhotos('SET', set.id, await filesToAssetPhotos(files))}
                onRemove={photoId => removeAssetPhoto('SET', set.id, photoId)}
                readOnly={!can('asset.photos.manage')}
                description={
                  !can('asset.photos.manage')
                    ? tr('Φωτογραφική τεκμηρίωση του Σετ. Προβολή μόνο για τον ενεργό ρόλο.')
                    : tr('Πολλαπλές φωτογραφίες. Η λήψη ενεργοποιεί την κάμερα της συσκευής.')
                }
              />
            </div>
          </div>
        </div>
      )}
      {dispatchOpen && (
        <DepartmentDispatchModal
          kind="SET"
          id={set.id}
          barcode={set.barcode}
          name={set.name}
          onClose={() => setDispatchOpen(false)}
        />
      )}
      {can('asset.duplicate') && duplicateOpen && (
        <SetDuplicateDialog
          barcode={set.barcode}
          onClose={() => setDuplicateOpen(false)}
          onDuplicate={withTools => {
            duplicateSet(set.id, withTools);
            setDuplicateOpen(false);
          }}
        />
      )}
      {can('asset.delete') && deleteOpen && (
        <SetDeleteDialog
          memberCount={members.length}
          onClose={() => setDeleteOpen(false)}
          onDelete={deleteTools => {
            deleteSet(set.id, deleteTools);
            setDeleteOpen(false);
            navigate('/sets');
          }}
        />
      )}
      {can('issue.create') && reportOpen && (
        <SetReportModal
          set={set}
          members={members}
          canManage={can('asset.composition.manage')}
          canOpenManage={!workflowLocked}
          onClose={() => setReportOpen(false)}
          onManage={() => {
            setReportOpen(false);
            setManageOpen(true);
          }}
          onSubmit={(toolIds, type, note, photos) => {
            if (type === 'Απώλεια' && can('asset.composition.manage')) {
              ask({
                title: tr('Δήλωση απώλειας;'),
                message: toolIds.length
                  ? tr('Τα {0} εργαλεία δηλώνονται ως χαμένα και αφαιρούνται από το Σετ.', toolIds.length)
                  : tr('Το Σετ {0} δηλώνεται ως χαμένο.', set.barcode),
                confirmLabel: tr('Δήλωση απώλειας'),
                danger: true,
                onConfirm: () => {
                  if (toolIds.length) toolIds.forEach(toolId => markLost('TOOL', toolId, note.trim()));
                  else markLost('SET', set.id, note.trim());
                  setReportOpen(false);
                },
              });
              return;
            }
            reportSetIssue(set.id, toolIds, type, note, photos);
            setReportOpen(false);
          }}
        />
      )}
      {confirmNode}
      {manageOpen && <AssetManageModal kind="SET" asset={set} onClose={() => setManageOpen(false)} />}
      {markerOpen && (
        <ColorMarkerPicker
          kind="SET"
          title={`${set.barcode} · ${set.name}`}
          value={{tapes: set.colorTapes || []}}
          otherSets={sets.filter(s => s.id !== set.id)}
          onClose={() => setMarkerOpen(false)}
          onSave={value => {
            setColorMarker(
              'SET',
              set.id,
              value,
              value.tapes.length ? markerText(value.tapes, tapesById, 'el') : tr('χωρίς χρώμα'),
            );
            setMarkerOpen(false);
          }}
        />
      )}
      {newBarcodeOpen && (
        <NewBarcodeModal
          kind="SET"
          asset={set}
          onClose={() => setNewBarcodeOpen(false)}
          onDone={() => {
            setNewBarcodeOpen(false);
            setPreview('BARCODE');
          }}
        />
      )}
    </div>
  );
}
