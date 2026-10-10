import {useLibraries} from '../../core/LibraryStore';
import {useEffect, useState} from 'react';
import {useUnsavedChanges} from '../../app/UnsavedChanges';
import {Barcode, Camera, Check, Images, Palette, Pencil, X} from 'lucide-react';
import ColorMarker from './ColorMarker';
import type {AssetKind, AssetState, Ownership, SetAsset, Tool} from '../../types/domain';
import StatusBadge from '../ui/StatusBadge';
import ExpiryBadge from '../ui/ExpiryBadge';
import {STERILE_STATES, expiryStatus, formatExpiry, sterilizedOnOf} from '../../core/sterileExpiry';
import AssetTypeIcon from './AssetTypeIcon';
import {tr, trData} from '../../i18n';

type EditablePatch = Partial<
  Pick<
    SetAsset,
    'name' | 'code' | 'department' | 'specialty' | 'manufacturer' | 'state' | 'maxUses' | 'ownership' | 'ownerName'
  >
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
  /** The color marker shown (an instrument's own or its Set's), a note on where it comes from, and its editor. */
  markerTapes?: string[];
  markerNote?: string;
  onEditMarker?: () => void;
  /** Lives (usage limit) are editable only by the admin and the Sterilization supervisor. */
  canEditUsage?: boolean;
};
const states: Array<{value: AssetState; label: string}> = [
  {value: 'IN_DEPARTMENT', label: 'Στο τμήμα'},
  {value: 'IN_STOCK', label: 'Απόθεμα'},
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
const ownerships: Array<{value: Ownership; label: string}> = [
  {value: 'HOSPITAL', label: 'Νοσοκομείο'},
  {value: 'DOCTOR', label: 'Ιατρός'},
  {value: 'OTHER', label: 'Άλλο'},
];
/** "Ιατρός · ΠΑΠΑΔΟΠΟΥΛΟΣ", "Νοσοκομείο", or '—' when not recorded. */
const ownershipLabel = (asset: {ownership?: Ownership; ownerName?: string}) => {
  const kind = ownerships.find(o => o.value === asset.ownership);
  if (!kind) return asset.ownerName || '—';
  return asset.ownerName && kind.value !== 'HOSPITAL' ? `${tr(kind.label)} · ${asset.ownerName}` : tr(kind.label);
};
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
  markerTapes,
  markerNote,
  onEditMarker,
  canEditUsage = false,
}: Props) {
  const {systemSettings} = useLibraries();
  const tool = kind === 'TOOL' ? (asset as Tool) : null;
  const photos = asset.photos || [];
  const cover = photos[0]?.dataUrl || tool?.imageUrl;
  const displayStateLabel = tool?.mode === 'SET_MEMBER' ? tr('Μέλος Σετ') : null;
  // A released Set or instrument shows how long it stays sterile.
  const sterile =
    asset.sterileUntil && (STERILE_STATES as readonly string[]).includes(asset.state)
      ? expiryStatus(asset.sterileUntil, asset.shelfLifeMonths)
      : undefined;
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
    ownership: (asset.ownership || '') as Ownership | '',
    ownerName: asset.ownerName || '',
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(makeDraft);
  useEffect(() => {
    if (!editing) setDraft(makeDraft());
    // makeDraft is rebuilt every render; the fields it reads are listed instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    asset.ownership,
    asset.ownerName,
    editing,
  ]);
  useUnsavedChanges(editing && JSON.stringify(draft) !== JSON.stringify(makeDraft()));
  const textField = (key: keyof typeof draft, value: string) => (
    <input
      className="asset-inline-input"
      value={value}
      onChange={e => setDraft(current => ({...current, [key]: e.target.value}))}
    />
  );
  const save = () => {
    const maxUses = !canEditUsage
      ? asset.maxUses
      : draft.usageType === 'LIMITED'
        ? Math.max(1, Number(draft.maxUses) || 1)
        : undefined;
    onSave?.({
      name: draft.name.trim(),
      code: draft.code.trim(),
      department: draft.department.trim(),
      specialty: draft.specialty.trim(),
      manufacturer: draft.manufacturer.trim(),
      state: draft.state,
      ...(canEditUsage ? {maxUses} : {}),
      ownership: draft.ownership || undefined,
      ownerName: ((draft.ownership === 'DOCTOR' || draft.ownership === 'OTHER') && draft.ownerName.trim()) || undefined,
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
            <span className="eyebrow">{kind === 'SET' ? tr('ΚΑΡΤΕΛΑ ΣΕΤ') : tr('ΚΑΡΤΕΛΑ ΕΡΓΑΛΕΙΟΥ')}</span>
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
          {sterile && sterile.state !== 'OK' && <ExpiryBadge entry={sterile} />}
          {workflowLocked && <small>{tr('Ενεργή διαδικασία · αλλαγές στοιχείων κλειδωμένες')}</small>}
        </div>
      </div>
      <div className="asset-fields-heading">
        <strong>{tr('Στοιχεία')}</strong>
        {onSave && !workflowLocked && !editing && (
          <button
            type="button"
            className="asset-inline-edit"
            onClick={() => setEditing(true)}
            title={tr('Ξεκλείδωμα πεδίων')}
          >
            <Pencil size={15} />
            <span>{tr('Επεξεργασία')}</span>
          </button>
        )}
        {editing && (
          <div className="asset-inline-edit-actions">
            <button type="button" className="asset-inline-save" onClick={save}>
              <Check size={14} />
              {tr('Αποθήκευση')}
            </button>
            <button type="button" className="asset-inline-cancel" onClick={cancel} title={tr('Ακύρωση')}>
              <X size={14} />
            </button>
          </div>
        )}
      </div>
      <dl className="asset-workbench-fields">
        <div>
          <dt>{tr('Κατάσταση')}</dt>
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
                    {tr(s.label)}
                  </option>
                ))}
              </select>
            ) : (
              <StatusBadge value={asset.state} />
            )}
          </dd>
        </div>
        {/* Always shown: the dates once released, a dash while the item is not sterile. */}
        <div>
          <dt>{tr('Αποστείρωση')}</dt>
          <dd className="sterile-dd">
            {sterile && asset.sterileUntil && sterilizedOnOf(asset) ? (
              formatExpiry(sterilizedOnOf(asset)!)
            ) : (
              <span className="muted" title={tr('Συμπληρώνεται στην αποδέσμευση από τον κλίβανο')}>
                —
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>{tr('Λήξη')}</dt>
          <dd className="sterile-dd">
            {sterile && asset.sterileUntil ? (
              formatExpiry(asset.sterileUntil)
            ) : (
              <span className="muted" title={tr('Συμπληρώνεται στην αποδέσμευση από τον κλίβανο')}>
                —
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>{tr('Κωδικός')}</dt>
          <dd>{editing ? textField('code', draft.code) : asset.code}</dd>
        </div>
        <div>
          <dt>{tr('Ονομασία')}</dt>
          <dd>{editing ? textField('name', draft.name) : asset.name}</dd>
        </div>
        <div>
          <dt>{tr('Ειδικότητα')}</dt>
          <dd>{editing ? textField('specialty', draft.specialty) : trData(asset.specialty) || '—'}</dd>
        </div>
        <div>
          <dt>{tr('Τμήμα')}</dt>
          <dd>
            {tool?.mode === 'STOCK' ? (
              <span className="asset-field-na">— Stock</span>
            ) : tool?.mode === 'SET_MEMBER' ? (
              trData(setDepartment || asset.department) || '—'
            ) : kind === 'SET' && (editing ? draft.state : asset.state) === 'IN_STOCK' ? (
              <span className="asset-field-na">{tr('— Απόθεμα Σετ')}</span>
            ) : editing ? (
              textField('department', draft.department)
            ) : (
              trData(asset.department) || '—'
            )}
          </dd>
        </div>
        <div>
          <dt>{tr('Κατασκευαστής')}</dt>
          <dd>
            {editing
              ? textField('manufacturer', draft.manufacturer)
              : (asset as Tool).manufacturer || (asset as SetAsset).manufacturer || '—'}
          </dd>
        </div>
        <div className="asset-ownership-field">
          <dt>{tr('Ιδιοκτησία')}</dt>
          <dd>
            {editing ? (
              <>
                <select
                  className="asset-inline-input"
                  value={draft.ownership}
                  onChange={e => setDraft(c => ({...c, ownership: e.target.value as Ownership | ''}))}
                >
                  <option value="">—</option>
                  {ownerships.map(o => (
                    <option key={o.value} value={o.value}>
                      {tr(o.label)}
                    </option>
                  ))}
                </select>
                {(draft.ownership === 'DOCTOR' || draft.ownership === 'OTHER') && (
                  <input
                    className="asset-inline-input"
                    value={draft.ownerName}
                    placeholder={draft.ownership === 'DOCTOR' ? tr('Όνομα ιατρού') : tr('Σε ποιον ανήκει')}
                    onChange={e => setDraft(c => ({...c, ownerName: e.target.value}))}
                  />
                )}
              </>
            ) : (
              ownershipLabel(asset)
            )}
          </dd>
        </div>
        <div className="asset-marker-field">
          <dt>{tr('Χρωματικός μάρτυρας')}</dt>
          <dd>
            <ColorMarker tapes={markerTapes} empty={tr('Χωρίς χρώμα')} />
            {markerNote && <small>{markerNote}</small>}
            {onEditMarker && (
              <button type="button" className="asset-marker-edit" onClick={onEditMarker} title={tr('Αλλαγή χρώματος')}>
                <Palette size={14} />
              </button>
            )}
          </dd>
        </div>
        {kind === 'TOOL' && (
          <>
            <div>
              <dt>{tr('Τύπος')}</dt>
              <dd>
                {tool?.mode === 'SET_MEMBER' ? tr('Μέλος Σετ') : tool?.mode === 'STOCK' ? 'Απόθεμα' : tr('Μεμονωμένο')}
              </dd>
            </div>
            {setName && (
              <div>
                <dt>{tr('Σετ εργαλείων')}</dt>
                <dd>{setName}</dd>
              </div>
            )}
            <div>
              <dt>{tr('Σειριακός αριθμός')}</dt>
              <dd>{editing ? textField('serialNumber', draft.serialNumber) : tool?.serialNumber || '—'}</dd>
            </div>
          </>
        )}
        <div className="asset-usage-field">
          <dt>{tr('Τύπος χρήσης')}</dt>
          <dd>
            {editing && canEditUsage ? (
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
                <option value="UNLIMITED">{tr('Χωρίς όριο')}</option>
                <option value="LIMITED">{tr('Περιορισμένων χρήσεων')}</option>
              </select>
            ) : asset.maxUses !== undefined ? (
              tr('Περιορισμένων χρήσεων')
            ) : (
              tr('Χωρίς όριο')
            )}
          </dd>
        </div>
        <div className="asset-usage-field">
          <dt>{tr('Αρχικό όριο χρήσεων')}</dt>
          <dd>
            {editing && canEditUsage && draft.usageType === 'LIMITED' ? (
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
              <dt>{tr('Χρήσεις')}</dt>
              <dd>{asset.uses || 0}</dd>
            </div>
            <div>
              <dt>{tr('Υπόλοιπο χρήσεων')}</dt>
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
            <span>{kind === 'SET' ? tr('Barcode Σετ') : tr('Barcode εργαλείου')}</span>
          </div>
          <strong className="mono">{asset.barcode}</strong>
        </div>
        {kind === 'SET' ? (
          <div className="asset-workbench-mini">
            <AssetTypeIcon kind="SET" size={17} />
            <div>
              <span>{tr('Περιεχόμενα Σετ')}</span>
              <strong>
                {memberCount}/{expectedCount} {tr('εργαλεία')}
              </strong>
            </div>
          </div>
        ) : (
          <>
            <div className="asset-workbench-mini">
              <AssetTypeIcon kind="TOOL" maxUses={tool?.maxUses} size={17} />
              <div>
                <span>{tr('Χρήσεις')}</span>
                <strong>{tool?.maxUses ? `${tool.uses}/${tool.maxUses}` : tr('{0} χρήσεις', tool?.uses || 0)}</strong>
              </div>
            </div>
            <button
              className="asset-tool-photo-card"
              type="button"
              onClick={onPhotos}
              aria-label={cover ? `${tr('Άνοιγμα φωτογραφιών')} ${photos.length}` : undefined}
            >
              {cover ? (
                <img src={cover} alt={asset.name} />
              ) : (
                <div className="asset-tool-photo-empty">
                  <Camera size={22} />
                  <div>
                    <strong>{tr('Φωτογραφία')}</strong>
                    <span>{tr('Λήψη ή upload')}</span>
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
        <button
          className="asset-cover"
          type="button"
          onClick={onPhotos}
          aria-label={cover ? `${tr('Άνοιγμα φωτογραφιών')} ${photos.length}` : undefined}
        >
          {cover ? (
            <img src={cover} alt={asset.name} />
          ) : (
            <div className="asset-cover-empty">
              <Camera size={30} />
              <strong>{tr('Χωρίς φωτογραφία')}</strong>
              <span>{tr('Λήψη ή upload')}</span>
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
