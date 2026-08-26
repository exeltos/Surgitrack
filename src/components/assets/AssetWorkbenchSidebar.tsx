import {useLibraries} from '../../core/LibraryStore';
import {useEffect, useState} from 'react';
import {Barcode, Camera, Check, Images, Pencil, X} from 'lucide-react';
import type {AssetKind, AssetState, SetAsset, Tool} from '../../types/domain';
import StatusBadge from '../ui/StatusBadge';
import AssetTypeIcon from './AssetTypeIcon';

type EditablePatch = Partial<
  Pick<SetAsset, 'name' | 'code' | 'department' | 'specialty' | 'manufacturer' | 'state' | 'maxUses'>
> & {serialNumber?: string};
type Props = {
  kind: AssetKind;
  asset: SetAsset | Tool;
  memberCount?: number;
  expectedCount?: number;
  setName?: string;
  setDepartment?: string;
  onPhotos: () => void;
  onSave?: (patch: EditablePatch) => void;
  workflowLocked?: boolean;
};
const states: Array<{value: AssetState; label: string}> = [
  {value: 'IN_DEPARTMENT', label: 'Στο τμήμα'},
  {value: 'IN_STOCK', label: 'Stock'},
  {value: 'PENDING_STERILIZATION', label: 'Αναμονή αποστείρωσης'},
  {value: 'IN_WASHING', label: 'Καθαρισμός & Απολύμανση'},
  {value: 'IN_PREPARATION', label: 'Προετοιμασία'},
  {value: 'IN_PACKAGING', label: 'Συσκευασία & Σήμανση'},
  {value: 'IN_STERILIZATION', label: 'Αποστείρωση'},
  {value: 'AWAITING_RELEASE', label: 'Αναμονή αποδέσμευσης'},
  {value: 'IN_STORAGE', label: 'Αποθήκευση'},
  {value: 'READY_FOR_PICKUP', label: 'Έτοιμο για παραλαβή'},
  {value: 'SERVICE', label: 'Service'},
  {value: 'LOST', label: 'Απωλεσθέν'},
];
export default function AssetWorkbenchSidebar({
  kind,
  asset,
  memberCount,
  expectedCount,
  setName,
  setDepartment,
  onPhotos,
  onSave,
  workflowLocked = false,
}: Props) {
  const {systemSettings} = useLibraries();
  const tool = kind === 'TOOL' ? (asset as Tool) : null;
  const photos = asset.photos || [];
  const cover = photos[0]?.dataUrl || tool?.imageUrl;
  const displayStateLabel = tool?.mode === 'SET_MEMBER' ? 'Μέλος Set' : null;
  const makeDraft = () => ({
    name: asset.name,
    code: asset.code,
    department: asset.department || '',
    specialty: asset.specialty || '',
    manufacturer: asset.manufacturer || '',
    state: asset.state,
    serialNumber: tool?.serialNumber || '',
    usageType: asset.maxUses !== undefined ? 'LIMITED' : 'UNLIMITED',
    maxUses: asset.maxUses?.toString() || '',
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(makeDraft);
  useEffect(() => {
    if (!editing) setDraft(makeDraft());
  }, [
    asset.id,
    asset.name,
    asset.code,
    asset.department,
    asset.specialty,
    asset.manufacturer,
    asset.state,
    tool?.serialNumber,
    asset.maxUses,
    editing,
  ]);
  const textField = (key: keyof typeof draft, value: string) => (
    <input
      className="asset-inline-input"
      value={value}
      onChange={e => setDraft(current => ({...current, [key]: e.target.value}))}
    />
  );
  const save = () => {
    const maxUses = draft.usageType === 'LIMITED' ? Math.max(1, Number(draft.maxUses) || 1) : undefined;
    onSave?.({
      name: draft.name.trim(),
      code: draft.code.trim(),
      department: draft.department.trim(),
      specialty: draft.specialty.trim(),
      manufacturer: draft.manufacturer.trim(),
      state: draft.state,
      maxUses,
      ...(kind === 'TOOL' ? {serialNumber: draft.serialNumber.trim() || undefined} : {}),
    });
    setEditing(false);
  };
  const cancel = () => {
    setDraft(makeDraft());
    setEditing(false);
  };
  return (
    <aside
      className={`asset-workbench-sidebar ${kind === 'TOOL' ? 'asset-workbench-sidebar-tool' : 'asset-workbench-sidebar-set'}`}
    >
      <div className="asset-workbench-title">
        <div className="asset-workbench-title-main">
          <AssetTypeIcon kind={kind} maxUses={asset.maxUses} framed size={19} />
          <div>
            <span className="eyebrow">
              {kind === 'SET'
                ? 'ΚΑΡΤΕΛΑ ΣΕΤ'
                : asset.maxUses !== undefined
                  ? 'ΚΑΡΤΕΛΑ ΕΡΓΑΛΕΙΟΥ · ΠΕΡΙΟΡΙΣΜΕΝΩΝ ΧΡΗΣΕΩΝ'
                  : 'ΚΑΡΤΕΛΑ ΕΡΓΑΛΕΙΟΥ'}
            </span>
            <h1>{asset.name}</h1>
            <p>{asset.code}</p>
          </div>
        </div>
        <div className="asset-workbench-title-status">
          {displayStateLabel ? (
            <span className="status-badge asset-member-status">{displayStateLabel}</span>
          ) : (
            <StatusBadge value={asset.state} />
          )}{' '}
          {workflowLocked && <small>Ενεργή διαδικασία · αλλαγές στοιχείων κλειδωμένες</small>}
        </div>
      </div>
      <div className="asset-fields-heading">
        <strong>Στοιχεία</strong>
        {onSave && !workflowLocked && !editing && (
          <button
            type="button"
            className="asset-inline-edit"
            onClick={() => setEditing(true)}
            title="Ξεκλείδωμα πεδίων"
          >
            <Pencil size={15} />
            <span>Επεξεργασία</span>
          </button>
        )}
        {editing && (
          <div className="asset-inline-edit-actions">
            <button type="button" className="asset-inline-save" onClick={save}>
              <Check size={14} />
              Αποθήκευση
            </button>
            <button type="button" className="asset-inline-cancel" onClick={cancel} title="Ακύρωση">
              <X size={14} />
            </button>
          </div>
        )}
      </div>
      <dl className="asset-workbench-fields">
        <div>
          <dt>Κατάσταση</dt>
          <dd>
            {!editing && displayStateLabel ? (
              <span className="status-badge asset-member-status">{displayStateLabel}</span>
            ) : editing ? (
              <select
                className="asset-inline-input"
                value={draft.state}
                onChange={e => setDraft(c => ({...c, state: e.target.value as AssetState}))}
              >
                {states.map(s => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            ) : (
              <StatusBadge value={asset.state} />
            )}
          </dd>
        </div>
        <div>
          <dt>Κωδικός</dt>
          <dd>{editing ? textField('code', draft.code) : asset.code}</dd>
        </div>
        <div>
          <dt>Ονομασία</dt>
          <dd>{editing ? textField('name', draft.name) : asset.name}</dd>
        </div>
        <div>
          <dt>Ειδικότητα</dt>
          <dd>{editing ? textField('specialty', draft.specialty) : asset.specialty || '—'}</dd>
        </div>
        <div>
          <dt>Τμήμα</dt>
          <dd>
            {tool?.mode === 'STOCK' ? (
              <span className="asset-field-na">— Stock</span>
            ) : tool?.mode === 'SET_MEMBER' ? (
              setDepartment || asset.department || '—'
            ) : kind === 'SET' && (editing ? draft.state : asset.state) === 'IN_STOCK' ? (
              <span className="asset-field-na">— Stock Σετ</span>
            ) : editing ? (
              textField('department', draft.department)
            ) : (
              asset.department || '—'
            )}
          </dd>
        </div>
        <div>
          <dt>Κατασκευαστής</dt>
          <dd>
            {editing
              ? textField('manufacturer', draft.manufacturer)
              : (asset as Tool).manufacturer || (asset as SetAsset).manufacturer || '—'}
          </dd>
        </div>
        {kind === 'TOOL' && (
          <>
            <div>
              <dt>Τύπος</dt>
              <dd>{tool?.mode === 'SET_MEMBER' ? 'Μέλος Σετ' : tool?.mode === 'STOCK' ? 'Stock' : 'Μεμονωμένο'}</dd>
            </div>
            {setName && (
              <div>
                <dt>Σετ εργαλείων</dt>
                <dd>{setName}</dd>
              </div>
            )}
            <div>
              <dt>Serial</dt>
              <dd>{editing ? textField('serialNumber', draft.serialNumber) : tool?.serialNumber || '—'}</dd>
            </div>
          </>
        )}
        <div className="asset-usage-field">
          <dt>Τύπος χρήσης</dt>
          <dd>
            {editing ? (
              <select
                className="asset-inline-input"
                value={draft.usageType}
                onChange={e =>
                  setDraft(c => ({
                    ...c,
                    usageType: e.target.value,
                    maxUses: e.target.value === 'LIMITED' ? c.maxUses || '50' : '',
                  }))
                }
              >
                <option value="UNLIMITED">Χωρίς όριο</option>
                <option value="LIMITED">Περιορισμένων χρήσεων</option>
              </select>
            ) : asset.maxUses !== undefined ? (
              'Περιορισμένων χρήσεων'
            ) : (
              'Χωρίς όριο'
            )}
          </dd>
        </div>
        <div className="asset-usage-field">
          <dt>Αρχικό όριο χρήσεων</dt>
          <dd>
            {editing && draft.usageType === 'LIMITED' ? (
              <input
                className="asset-inline-input"
                type="number"
                min="1"
                value={draft.maxUses}
                onChange={e => setDraft(c => ({...c, maxUses: e.target.value}))}
              />
            ) : (
              (asset.maxUses ?? '—')
            )}
          </dd>
        </div>
        {asset.maxUses !== undefined && (
          <>
            <div>
              <dt>Χρήσεις</dt>
              <dd>{asset.uses || 0}</dd>
            </div>
            <div>
              <dt>Υπόλοιπο χρήσεων</dt>
              <dd
                className={asset.maxUses - (asset.uses || 0) <= systemSettings.usageWarningThreshold ? 'warn-text' : ''}
              >
                {Math.max(0, asset.maxUses - (asset.uses || 0))}
              </dd>
            </div>
          </>
        )}
      </dl>
      <div className="asset-sidebar-quickfacts">
        <div className="asset-barcode-card">
          <div>
            <Barcode size={17} />
            <span>Barcode {kind === 'SET' ? 'Set' : 'Tool'}</span>
          </div>
          <strong className="mono">{asset.barcode}</strong>
        </div>
        {kind === 'SET' ? (
          <div className="asset-workbench-mini">
            <AssetTypeIcon kind="SET" size={17} />
            <div>
              <span>Περιεχόμενα Σετ</span>
              <strong>
                {memberCount}/{expectedCount} εργαλεία
              </strong>
            </div>
          </div>
        ) : (
          <>
            <div className="asset-workbench-mini">
              <AssetTypeIcon kind="TOOL" maxUses={tool?.maxUses} size={17} />
              <div>
                <span>Χρήσεις</span>
                <strong>{tool?.maxUses ? `${tool.uses}/${tool.maxUses}` : `${tool?.uses || 0} · χωρίς όριο`}</strong>
              </div>
            </div>
            <button className="asset-tool-photo-card" type="button" onClick={onPhotos} aria-label="Άνοιγμα φωτογραφιών">
              {cover ? (
                <img src={cover} alt={asset.name} />
              ) : (
                <div className="asset-tool-photo-empty">
                  <Camera size={22} />
                  <div>
                    <strong>Φωτογραφία</strong>
                    <span>Λήψη ή upload</span>
                  </div>
                </div>
              )}
              <span className="asset-cover-count">
                <Images size={14} />
                {photos.length}
              </span>
            </button>
          </>
        )}
      </div>
      {kind === 'SET' && (
        <button className="asset-cover" type="button" onClick={onPhotos} aria-label="Άνοιγμα φωτογραφιών">
          {cover ? (
            <img src={cover} alt={asset.name} />
          ) : (
            <div className="asset-cover-empty">
              <Camera size={30} />
              <strong>Χωρίς φωτογραφία</strong>
              <span>Λήψη ή upload</span>
            </div>
          )}
          <span className="asset-cover-count">
            <Images size={14} />
            {photos.length}
          </span>
        </button>
      )}
    </aside>
  );
}
