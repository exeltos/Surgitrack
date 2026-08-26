import {useMemo, useState} from 'react';
import {Link, useNavigate, useParams} from 'react-router-dom';
import {
  ArrowLeft,
  Barcode,
  Camera,
  ChevronDown,
  ChevronRight,
  Copy,
  Flag,
  History,
  Layers3,
  List,
  Plus,
  Printer,
  Send,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';
import {useSurgi} from '../../store/SurgiStore';
import type {AssetPhoto} from '../../types/domain';
import StatusBadge from '../../components/ui/StatusBadge';
import AssetTabs, {type AssetTab} from '../../components/assets/AssetTabs';
import UsageLimitCard from '../../components/assets/UsageLimitCard';
import AssetEmptyState from '../../components/assets/AssetEmptyState';
import AddToolsToSetModal from '../../components/assets/AddToolsToSetModal';
import PrintPreviewModal from '../../components/assets/PrintPreviewModal';
import AppButton from '../../components/ui/AppButton';
import IconToggleButton from '../../components/ui/IconToggleButton';
import AssetFilterBar from '../../components/assets/AssetFilterBar';
import {barcodeLabelHtml, compositionHtml} from '../sterilization/printUtils';
import AssetPhotosCard from '../../components/assets/AssetPhotosCard';
import AssetWorkbenchSidebar from '../../components/assets/AssetWorkbenchSidebar';
import {filesToAssetPhotos} from '../../components/assets/photoUtils';
import DepartmentDispatchModal from '../../components/department/DepartmentDispatchModal';

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
    addAssetPhotos,
    removeAssetPhoto,
    updateSet,
    role,
    can,
  } = useSurgi();
  const navigate = useNavigate();
  const {id} = useParams();
  const set = sets.find(item => item.id === id);
  const [tab, setTab] = useState<AssetTab>('CONTENTS');
  const [photosOpen, setPhotosOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<'SET' | 'TOOLS'>('SET');
  const [reportToolIds, setReportToolIds] = useState<string[]>([]);
  const [reportType, setReportType] = useState('Βλάβη');
  const [reportNote, setReportNote] = useState('');
  const [reportPhotos, setReportPhotos] = useState<AssetPhoto[]>([]);
  const [addToolsOpen, setAddToolsOpen] = useState(false);

  const [preview, setPreview] = useState<'COMPOSITION' | 'BARCODE' | null>(null);
  const [grouped, setGrouped] = useState(false);
  const [toolQuery, setToolQuery] = useState('');
  const [toolManufacturer, setToolManufacturer] = useState('');
  const [toolSpecialty, setToolSpecialty] = useState('');
  const [toolState, setToolState] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Hooks must run unconditionally on every render (Rules of Hooks), so the
  // "set not found" / "wrong department" guards below happen AFTER these,
  // using optional access so they stay safe when `set` is undefined.
  const members = useMemo(() => (set ? tools.filter(tool => tool.setId === set.id) : []), [tools, set]);
  const visibleMembers = useMemo(
    () =>
      members.filter(
        tool =>
          (!toolManufacturer || tool.manufacturer === toolManufacturer) &&
          (!toolSpecialty || tool.specialty === toolSpecialty) &&
          (!toolState || tool.state === toolState) &&
          `${tool.name} ${tool.code} ${tool.barcode} ${tool.serialNumber || ''} ${tool.manufacturer} ${tool.specialty} ${tool.department || ''}`
            .toLowerCase()
            .includes(toolQuery.toLowerCase()),
      ),
    [members, toolQuery, toolManufacturer, toolSpecialty, toolState],
  );
  const groupedMembers = useMemo(() => {
    const map = new Map<string, typeof visibleMembers>();
    visibleMembers.forEach(tool => {
      const key = `${tool.code}|${tool.name}|${tool.manufacturer}`;
      map.set(key, [...(map.get(key) || []), tool]);
    });
    return [...map.entries()];
  }, [visibleMembers]);

  if (!set)
    return (
      <div className="empty">
        <strong>Το Set δεν βρέθηκε.</strong>
        <span>Επιστρέψτε στη λίστα των Set και επιλέξτε ξανά.</span>
        <Link className="primary-link" to={role === 'DEPARTMENT' ? '/department' : '/sets'}>
          Πίσω στη λίστα
        </Link>
      </div>
    );
  if (role === 'DEPARTMENT' && set.department !== currentUser.department)
    return (
      <div className="empty">
        <strong>Δεν υπάρχει πρόσβαση σε αυτό το Σετ.</strong>
        <span>Ο χρήστης του τμήματος βλέπει μόνο τον εξοπλισμό του δικού του τμήματος.</span>
        <Link className="primary-link" to="/department">
          Πίσω στα Σετ & Εργαλεία
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
  const preparedAt = new Date().toLocaleString('el-GR', {dateStyle: 'short', timeStyle: 'short'});
  const uses = set.uses || 0;
  const memberValues = (key: 'manufacturer' | 'specialty' | 'state') =>
    [...new Set(members.map(tool => String(tool[key] || '')).filter(Boolean))].sort();
  const toggleGroup = (key: string) =>
    setExpandedGroups(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const departmentView = role === 'DEPARTMENT';
  const backTo = departmentView ? '/department' : '/sets';
  const workflowLocked = !['IN_DEPARTMENT', 'IN_STOCK', 'SERVICE', 'LOST'].includes(set.state);

  return (
    <div className="asset-detail-workspace set-detail-workspace legacy-inspired-workspace">
      <div className="asset-workbench-actions">
        <div className="asset-action-group">
          <AppButton icon={<Printer size={18} />} onClick={() => setPreview('COMPOSITION')}>
            Εκτύπωση σύνθεσης
          </AppButton>
          <AppButton icon={<Barcode size={18} />} onClick={() => setPreview('BARCODE')}>
            Εκτύπωση Barcode
          </AppButton>
          {can('asset.duplicate') && (
            <AppButton icon={<Copy size={18} />} onClick={() => setDuplicateOpen(true)}>
              Duplicate
            </AppButton>
          )}
          {can('asset.delete') && (
            <AppButton
              variant="danger"
              icon={<Trash2 size={18} />}
              disabled={workflowLocked}
              title={
                workflowLocked
                  ? 'Δεν επιτρέπεται διαγραφή όσο το Σετ βρίσκεται σε ενεργή διαδικασία αποστείρωσης.'
                  : undefined
              }
              onClick={() => setDeleteOpen(true)}
            >
              Διαγραφή Σετ
            </AppButton>
          )}
          {can('issue.create') && (
            <AppButton icon={<Flag size={18} />} onClick={() => setReportOpen(true)}>
              Αναφορά
            </AppButton>
          )}
          {can('department.dispatch') && set.state === 'IN_DEPARTMENT' && (
            <AppButton variant="primary" icon={<Send size={18} />} onClick={() => setDispatchOpen(true)}>
              Προς Αποστείρωση
            </AppButton>
          )}
        </div>
        <div className="asset-action-group">
          <Link to={backTo} className="asset-action-link">
            <ArrowLeft size={18} /> Πίσω στη λίστα
          </Link>
        </div>
      </div>
      <div className="asset-workbench-grid">
        <AssetWorkbenchSidebar
          kind="SET"
          asset={set}
          memberCount={members.length}
          expectedCount={set.expected}
          onPhotos={() => setPhotosOpen(true)}
          workflowLocked={workflowLocked}
          onSave={can('asset.edit') ? patch => updateSet(set.id, patch) : undefined}
        />
        <section className="asset-workbench-main">
          <AssetTabs
            value={tab}
            onChange={setTab}
            issueCount={memberIssues.length}
            showContents
            className="asset-detail-tabs"
          />
          <main className="asset-detail-body">
            {tab === 'SUMMARY' && (
              <section className="asset-section asset-detail-full-panel">
                <div className="asset-section-head">
                  <div>
                    <span className="eyebrow">ΣΥΝΟΨΗ</span>
                    <h2>Κατάσταση & κύκλος ζωής</h2>
                    <p>Μόνο η λειτουργική σύνοψη του Σετ· τα στοιχεία ταυτότητας παραμένουν αριστερά.</p>
                  </div>
                </div>
                <div className="asset-section-body">
                  <UsageLimitCard
                    uses={uses}
                    maxUses={set.maxUses}
                    description="Κύκλος ζωής του Σετ, όταν έχει οριστεί όριο χρήσεων."
                  />
                  <dl className="asset-definition-list compact-status-list">
                    <div>
                      <dt>Σύνθεση</dt>
                      <dd className={missing ? 'warn-text' : ''}>
                        {members.length}/{set.expected}
                      </dd>
                    </div>
                    <div>
                      <dt>Ελλείψεις</dt>
                      <dd className={missing ? 'warn-text' : ''}>{missing}</dd>
                    </div>
                    <div>
                      <dt>Ανοικτές εκκρεμότητες</dt>
                      <dd className={memberIssues.length ? 'warn-text' : ''}>{memberIssues.length}</dd>
                    </div>
                  </dl>
                  {!complete && (
                    <div className="asset-alert warning asset-side-alert">
                      <TriangleAlert size={18} />
                      <div>
                        <strong>Μη πλήρης σύνθεση</strong>
                        <span>
                          Λείπουν {missing} {missing === 1 ? 'φυσικό εργαλείο' : 'φυσικά εργαλεία'}.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {tab === 'CONTENTS' && (
              <section className="asset-section set-composition-fixed asset-detail-full-panel">
                <div className="asset-section-head set-composition-head">
                  <div>
                    <span className="eyebrow">ΣΥΝΘΕΣΗ ΣΕΤ</span>
                    <h2>Φυσικά εργαλεία</h2>
                    <p>Κάθε barcode είναι ξεχωριστό φυσικό εργαλείο. Η λίστα αξιοποιεί όλο τον διαθέσιμο χώρο.</p>
                  </div>
                  <div className="set-composition-actions">
                    {can('asset.edit') && (
                      <AppButton
                        icon={<Plus size={18} />}
                        disabled={workflowLocked}
                        title={
                          workflowLocked
                            ? 'Η σύνθεση δεν αλλάζει όσο το Σετ βρίσκεται σε ενεργή διαδικασία αποστείρωσης.'
                            : undefined
                        }
                        onClick={() => setAddToolsOpen(true)}
                      >
                        Προσθήκη εργαλείων
                      </AppButton>
                    )}
                    <IconToggleButton
                      active={grouped}
                      activeIcon={<List size={18} />}
                      inactiveIcon={<Layers3 size={18} />}
                      activeTitle="Εμφάνιση φυσικών εγγραφών"
                      inactiveTitle="Ομαδοποίηση ίδιων εργαλείων"
                      aria-label={grouped ? 'Εμφάνιση φυσικών εγγραφών' : 'Ομαδοποίηση ίδιων εργαλείων'}
                      onClick={() => setGrouped(value => !value)}
                    />
                    <div className={`asset-count-state ${complete ? 'ok' : 'warning'}`}>
                      <strong>
                        {members.length}/{set.expected}
                      </strong>
                      <span>{complete ? 'Πλήρες' : `Έλλειψη ${missing}`}</span>
                    </div>
                  </div>
                </div>
                <AssetFilterBar
                  compact
                  className="set-composition-filters"
                  query={toolQuery}
                  onQueryChange={setToolQuery}
                  placeholder="Εργαλείο, κωδικός, barcode ή serial..."
                  filters={[
                    {
                      key: 'specialty',
                      value: toolSpecialty,
                      placeholder: 'Όλες οι ειδικότητες',
                      options: memberValues('specialty').map(value => ({value, label: value})),
                      onChange: setToolSpecialty,
                    },
                    {
                      key: 'manufacturer',
                      value: toolManufacturer,
                      placeholder: 'Όλες οι εταιρείες',
                      options: memberValues('manufacturer').map(value => ({value, label: value})),
                      onChange: setToolManufacturer,
                    },
                    {
                      key: 'state',
                      value: toolState,
                      placeholder: 'Όλες οι καταστάσεις',
                      options: memberValues('state').map(value => ({value, label: value})),
                      onChange: setToolState,
                    },
                  ]}
                />
                <div className="set-tool-list">
                  {grouped
                    ? groupedMembers.map(([key, group], groupIndex) => {
                        const first = group[0];
                        const open = expandedGroups.has(key);
                        const groupHasIssue = group.some(tool =>
                          memberIssues.some(issue => issue.asset.startsWith(tool.barcode)),
                        );
                        return (
                          <div className="set-tool-group" key={key}>
                            <button
                              className={`set-tool-row set-tool-group-row ${groupHasIssue ? 'has-issue' : ''}`}
                              onClick={() => toggleGroup(key)}
                            >
                              <span className="set-tool-index">{groupIndex + 1}</span>
                              <div className="set-tool-code">
                                <strong className="qty-inline">{group.length} τεμ.</strong>
                                <small>{first.code}</small>
                              </div>
                              <div className="set-tool-name">
                                <strong>{first.name}</strong>
                                <small>
                                  {first.manufacturer} ·{' '}
                                  {open ? 'Απόκρυψη φυσικών barcodes' : 'Προβολή φυσικών barcodes'}
                                </small>
                              </div>
                              <div className="set-tool-uses">
                                <span>Ομάδα</span>
                                <strong>{group.length}</strong>
                              </div>
                              <div className="set-tool-state">
                                <span className="group-disclosure">
                                  {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                </span>
                                {groupHasIssue && <small>Υπάρχει αναφορά</small>}
                              </div>
                            </button>
                            {open && (
                              <div className="set-tool-group-children">
                                {group.map((tool, index) => {
                                  const hasIssue = memberIssues.some(issue => issue.asset.startsWith(tool.barcode));
                                  return (
                                    <Link
                                      to={`/tools/${tool.id}`}
                                      className={`set-tool-row set-tool-child-row ${hasIssue ? 'has-issue' : ''}`}
                                      key={tool.id}
                                    >
                                      <span className="set-tool-index">{index + 1}</span>
                                      <div className="set-tool-code">
                                        <strong className="mono">{tool.barcode}</strong>
                                        <small>{tool.code}</small>
                                      </div>
                                      <div className="set-tool-name">
                                        <strong>{tool.name}</strong>
                                        <small>{tool.serialNumber ? `S/N ${tool.serialNumber}` : 'Χωρίς serial'}</small>
                                      </div>
                                      <div className="set-tool-uses">
                                        <span>Χρήσεις</span>
                                        <strong>
                                          {tool.maxUses ? `${tool.uses}/${tool.maxUses}` : `${tool.uses} · χωρίς όριο`}
                                        </strong>
                                      </div>
                                      <div className="set-tool-state">
                                        <StatusBadge value={tool.state} />
                                        {hasIssue && <small>Ανοικτή αναφορά</small>}
                                      </div>
                                    </Link>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })
                    : visibleMembers.map((tool, index) => {
                        const hasIssue = memberIssues.some(issue => issue.asset.startsWith(tool.barcode));
                        return (
                          <Link
                            to={`/tools/${tool.id}`}
                            className={`set-tool-row ${hasIssue ? 'has-issue' : ''}`}
                            key={tool.id}
                          >
                            <span className="set-tool-index">{index + 1}</span>
                            <div className="set-tool-code">
                              <strong className="mono">{tool.barcode}</strong>
                              <small>{tool.code}</small>
                            </div>
                            <div className="set-tool-name">
                              <strong>{tool.name}</strong>
                              <small>
                                {tool.manufacturer}
                                {tool.serialNumber ? ` · S/N ${tool.serialNumber}` : ''}
                              </small>
                            </div>
                            <div className="set-tool-uses">
                              <span>Χρήσεις</span>
                              <strong>
                                {tool.maxUses ? `${tool.uses}/${tool.maxUses}` : `${tool.uses} · χωρίς όριο`}
                              </strong>
                            </div>
                            <div className="set-tool-state">
                              <StatusBadge value={tool.state} />
                              {hasIssue && <small>Ανοικτή αναφορά</small>}
                            </div>
                          </Link>
                        );
                      })}
                </div>
              </section>
            )}

            {tab === 'HISTORY' && (
              <section className="asset-section asset-detail-full-panel">
                <div className="asset-section-head">
                  <div>
                    <span className="eyebrow">ΙΧΝΗΛΑΣΙΜΟΤΗΤΑ</span>
                    <h2>Ιστορικό κινήσεων</h2>
                  </div>
                  <History size={19} />
                </div>
                <div className="asset-history asset-detail-scroll">
                  {history.length ? (
                    history.map(item => (
                      <div className="asset-history-row" key={item.id}>
                        <span className="history-dot" />
                        <div>
                          <strong>{item.status}</strong>
                          <p>
                            {item.from} → {item.to}
                          </p>
                          <small>
                            {item.at} · {item.by}
                            {item.patientCode ? ` · ${item.patientCode}` : ''}
                          </small>
                        </div>
                      </div>
                    ))
                  ) : (
                    <AssetEmptyState>Δεν υπάρχει καταγεγραμμένη κίνηση.</AssetEmptyState>
                  )}
                </div>
              </section>
            )}
            {tab === 'ISSUES' && (
              <section className="asset-section asset-detail-full-panel">
                <div className="asset-section-head">
                  <div>
                    <span className="eyebrow">ΕΚΚΡΕΜΟΤΗΤΕΣ</span>
                    <h2>Ανοικτές αναφορές</h2>
                  </div>
                </div>
                <div className="asset-detail-scroll asset-issue-list">
                  {memberIssues.length ? (
                    memberIssues.map(issue => (
                      <div className="asset-issue-row" key={issue.id}>
                        <TriangleAlert size={17} />
                        <div>
                          <strong>{issue.asset}</strong>
                          <span>{issue.type}</span>
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
                    <AssetEmptyState>Δεν υπάρχουν ανοικτές εκκρεμότητες.</AssetEmptyState>
                  )}
                </div>
              </section>
            )}
            {tab === 'NOTES' && (
              <section className="asset-section asset-detail-full-panel">
                <div className="asset-section-head">
                  <div>
                    <span className="eyebrow">ΣΗΜΕΙΩΣΕΙΣ</span>
                    <h2>Μόνιμες παρατηρήσεις</h2>
                  </div>
                </div>
                <div className="asset-section-body asset-notes-tab">
                  {set.notes ? (
                    <p>{set.notes}</p>
                  ) : (
                    <AssetEmptyState>Δεν υπάρχουν σημειώσεις για το Set.</AssetEmptyState>
                  )}
                </div>
              </section>
            )}
          </main>
        </section>
      </div>
      {!departmentView && addToolsOpen && <AddToolsToSetModal setId={set.id} onClose={() => setAddToolsOpen(false)} />}
      {preview === 'COMPOSITION' && (
        <PrintPreviewModal
          title={`Σύνθεση ${set.barcode}`}
          html={compositionHtml(
            set,
            members,
            currentUser.name,
            preparedAt,
            memberIssues.map(issue => issue.asset.split(' · ')[0]),
          )}
          onClose={() => setPreview(null)}
        />
      )}
      {preview === 'BARCODE' && (
        <PrintPreviewModal
          title={`Barcode ${set.barcode}`}
          html={barcodeLabelHtml(set, 'SET', members.length)}
          onClose={() => setPreview(null)}
        />
      )}
      {photosOpen && (
        <div className="modal-backdrop" onMouseDown={e => e.currentTarget === e.target && setPhotosOpen(false)}>
          <div className="asset-modal asset-photo-manager-modal">
            <header>
              <div>
                <h2>Φωτογραφίες Σετ</h2>
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
                    ? 'Φωτογραφική τεκμηρίωση του Σετ. Προβολή μόνο για τον ενεργό ρόλο.'
                    : 'Πολλαπλές φωτογραφίες. Η λήψη ενεργοποιεί την κάμερα της συσκευής.'
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
        <div className="modal-backdrop">
          <div className="confirm-dialog choice-dialog">
            <header>
              <div className="confirm-icon">
                <Copy size={20} />
              </div>
              <div>
                <h3>Duplicate Σετ</h3>
                <p>Τι θέλεις να αντιγραφεί από το {set.barcode};</p>
              </div>
              <button className="icon-button" onClick={() => setDuplicateOpen(false)}>
                <X size={18} />
              </button>
            </header>
            <div className="choice-dialog-body">
              <button
                onClick={() => {
                  duplicateSet(set.id, false);
                  setDuplicateOpen(false);
                }}
              >
                <strong>Μόνο το Σετ</strong>
                <span>Δημιουργεί νέο κενό Σετ, χωρίς φυσικά εργαλεία.</span>
              </button>
              <button
                onClick={() => {
                  duplicateSet(set.id, true);
                  setDuplicateOpen(false);
                }}
              >
                <strong>Σετ + εργαλεία</strong>
                <span>Δημιουργεί νέα φυσικά εργαλεία με νέα μοναδικά barcodes.</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {can('asset.delete') && deleteOpen && (
        <div className="modal-backdrop">
          <div className="confirm-dialog choice-dialog danger-choice">
            <header>
              <div className="confirm-icon">
                <Trash2 size={20} />
              </div>
              <div>
                <h3>Διαγραφή Σετ</h3>
                <p>Επίλεξε τι θα γίνει με τα {members.length} φυσικά εργαλεία του Σετ.</p>
              </div>
              <button className="icon-button" onClick={() => setDeleteOpen(false)}>
                <X size={18} />
              </button>
            </header>
            <div className="choice-dialog-body">
              <button
                onClick={() => {
                  deleteSet(set.id, false);
                  setDeleteOpen(false);
                  navigate('/sets');
                }}
              >
                <strong>Διαγραφή μόνο του Σετ</strong>
                <span>Τα εργαλεία αποδεσμεύονται και μεταφέρονται στο Stock.</span>
              </button>
              <button
                className="danger-option"
                onClick={() => {
                  if (window.confirm('Οριστική διαγραφή του Σετ ΚΑΙ όλων των εργαλείων του;')) {
                    deleteSet(set.id, true);
                    setDeleteOpen(false);
                    navigate('/sets');
                  }
                }}
              >
                <strong>Διαγραφή Σετ + εργαλείων</strong>
                <span>Οριστική αφαίρεση και των φυσικών εργαλείων.</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {can('issue.create') && reportOpen && (
        <div className="modal-backdrop">
          <div className="asset-modal set-report-modal">
            <header>
              <div>
                <h2>Νέα αναφορά</h2>
                <p>{set.barcode} · επίλεξε αν αφορά το Σετ ή εργαλεία της σύνθεσης.</p>
              </div>
              <button className="icon-button" onClick={() => setReportOpen(false)}>
                <X size={18} />
              </button>
            </header>
            <div className="modal-body">
              <div className="report-target-switch">
                <button className={reportTarget === 'SET' ? 'active' : ''} onClick={() => setReportTarget('SET')}>
                  Ολόκληρο Σετ
                </button>
                <button className={reportTarget === 'TOOLS' ? 'active' : ''} onClick={() => setReportTarget('TOOLS')}>
                  Εργαλεία του Σετ
                </button>
              </div>
              {reportTarget === 'TOOLS' && (
                <div className="report-tool-picker">
                  {members.map(tool => (
                    <label key={tool.id}>
                      <input
                        type="checkbox"
                        checked={reportToolIds.includes(tool.id)}
                        onChange={e =>
                          setReportToolIds(ids =>
                            e.target.checked ? [...ids, tool.id] : ids.filter(id => id !== tool.id),
                          )
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
                <label>
                  Τύπος αναφοράς
                  <select value={reportType} onChange={e => setReportType(e.target.value)}>
                    <option>Βλάβη</option>
                    <option>Φθορά</option>
                    <option>Απώλεια</option>
                    <option>Έλλειψη</option>
                    <option>Service</option>
                    <option>Άλλο</option>
                  </select>
                </label>
                <label className="span-2">
                  Παρατήρηση
                  <textarea
                    rows={3}
                    value={reportNote}
                    onChange={e => setReportNote(e.target.value)}
                    placeholder="Περιγραφή συμβάντος..."
                  />
                </label>
                <label className="span-2 report-photo-input">
                  <Camera size={17} /> Φωτογραφίες
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={async e => setReportPhotos(await filesToAssetPhotos(Array.from(e.target.files || [])))}
                  />
                  <small>
                    {reportPhotos.length
                      ? `${reportPhotos.length} φωτογραφίες έτοιμες`
                      : 'Λήψη από κάμερα ή επιλογή πολλών φωτογραφιών'}
                  </small>
                </label>
              </div>
            </div>
            <footer>
              <AppButton onClick={() => setReportOpen(false)}>Ακύρωση</AppButton>
              <AppButton
                variant="primary"
                disabled={reportTarget === 'TOOLS' && !reportToolIds.length}
                onClick={() => {
                  reportSetIssue(
                    set.id,
                    reportTarget === 'TOOLS' ? reportToolIds : [],
                    reportType,
                    reportNote,
                    reportPhotos,
                  );
                  setReportOpen(false);
                  setReportToolIds([]);
                  setReportNote('');
                  setReportPhotos([]);
                }}
              >
                Καταχώρηση αναφοράς
              </AppButton>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
