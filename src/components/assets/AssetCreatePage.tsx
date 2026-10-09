import {useMemo, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {ArrowLeft, Check, Images, Save, Search, X} from 'lucide-react';
import {useSurgi} from '../../store/SurgiStore';
import {useLibraries} from '../../core/LibraryStore';
import AppButton from '../ui/AppButton';
import AssetPhotosCard from './AssetPhotosCard';
import AssetTypeIcon from './AssetTypeIcon';
import {filesToAssetPhotos} from './photoUtils';
import type {AssetKind, AssetPhoto} from '../../types/domain';
import {tr, trData} from '../../i18n';

type Source = 'STOCK' | 'SET_MEMBER' | 'STANDALONE';
type CreateTab = 'DETAILS' | 'COMPOSITION' | 'PHOTOS' | 'NOTES';

export default function AssetCreatePage({kind}: {kind: AssetKind}) {
  const navigate = useNavigate();
  const {departments, manufacturers, specialties} = useLibraries();
  const {sets, tools, createTool, createSet, nextBarcode, addAssetPhotos} = useSurgi();
  const backTo = kind === 'SET' ? '/sets' : '/tools';
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [department, setDepartment] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [limited, setLimited] = useState(false);
  const [maxUses, setMaxUses] = useState('50');
  const [notes, setNotes] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [photos, setPhotos] = useState<AssetPhoto[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<Source>('STOCK');
  const [tab, setTab] = useState<CreateTab>(kind === 'SET' ? 'COMPOSITION' : 'DETAILS');
  const barcode = nextBarcode(kind);
  const valid = !!name.trim() && !!code.trim();
  const cover = photos[0]?.dataUrl;
  const candidates = useMemo(
    () =>
      tools.filter(
        t =>
          t.mode === source &&
          (!query || `${t.barcode} ${t.name} ${t.code}`.toLowerCase().includes(query.toLowerCase())),
      ),
    [tools, query, source],
  );
  const allowedDepartments = departments.filter(x => !['ster', 'biomed', 'proc'].includes(x.id));

  const removePhoto = (id: string) => setPhotos(list => list.filter(photo => photo.id !== id));
  const addPhotos = async (files: File[]) => {
    const added = await filesToAssetPhotos(files);
    setPhotos(list => [...list, ...added]);
  };
  const save = () => {
    if (!valid) return;
    const limit = limited ? Math.max(1, Number(maxUses) || 1) : undefined;
    if (kind === 'TOOL') {
      const ids = createTool({
        name: name.trim(),
        code: code.trim(),
        department: department.trim(),
        specialty: specialty.trim(),
        manufacturer: manufacturer.trim() || undefined,
        quantity,
        maxUses: limit,
        notes: notes.trim() || undefined,
        serialNumber: serialNumber.trim() || undefined,
      });
      if (photos.length) ids.forEach(id => addAssetPhotos('TOOL', id, photos));
      if (ids.length === 1) navigate(`/tools/${ids[0]}`);
      else navigate('/tools');
      return;
    }
    const id = createSet({
      name: name.trim(),
      code: code.trim(),
      department: department.trim(),
      specialty: specialty.trim(),
      manufacturer: manufacturer.trim() || undefined,
      toolIds: selected,
      maxUses: limit,
      notes: notes.trim() || undefined,
    });
    if (!id) return;
    if (photos.length) addAssetPhotos('SET', id, photos);
    navigate(`/sets/${id}`);
  };

  return (
    <div className="asset-detail-workspace asset-create-card-workspace legacy-inspired-workspace">
      <div className="asset-workbench-actions asset-create-card-actions">
        <div className="asset-action-group">
          <AppButton variant="primary" icon={<Save size={17} />} disabled={!valid} onClick={save}>
            {tr('Αποθήκευση')}
          </AppButton>
          <AppButton icon={<X size={17} />} onClick={() => navigate(backTo)}>
            {tr('Ακύρωση')}
          </AppButton>
          {!valid && (
            <small className="asset-create-hint">{tr('Συμπληρώστε Κωδικό και Ονομασία για να αποθηκευτεί.')}</small>
          )}
        </div>
        <div className="asset-action-group">
          <button className="asset-action-link" onClick={() => navigate(backTo)}>
            <ArrowLeft size={18} /> {tr('Πίσω στη λίστα')}
          </button>
        </div>
      </div>

      <div className="asset-workbench-grid">
        <aside className="asset-workbench-sidebar asset-create-sidebar">
          <div className="asset-workbench-title">
            <div className="asset-workbench-title-main">
              <AssetTypeIcon kind={kind} maxUses={limited ? Number(maxUses) || 1 : undefined} framed size={19} />
              <div>
                <span className="eyebrow">{kind === 'SET' ? tr('ΝΕΑ ΚΑΡΤΕΛΑ ΣΕΤ') : tr('ΝΕΑ ΚΑΡΤΕΛΑ ΕΡΓΑΛΕΙΟΥ')}</span>
                <h1>{name || tr('Χωρίς ονομασία')}</h1>
                <p>{code || tr('Συμπλήρωσε κωδικό')}</p>
              </div>
            </div>
            <div className="asset-workbench-title-status">
              <span className="status-badge asset-member-status">{tr('Νέα καταχώριση')}</span>
            </div>
          </div>

          <div className="asset-fields-heading">
            <strong>{tr('Στοιχεία')}</strong>
            <span className="asset-create-required">{tr('* υποχρεωτικά')}</span>
          </div>
          <div className="asset-create-field-list">
            <label>
              <span>{tr('Κωδικός *')}</span>
              <input
                className="asset-inline-input"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder={tr('π.χ. 12.15.321')}
              />
            </label>
            <label>
              <span>{tr('Ονομασία *')}</span>
              <input
                className="asset-inline-input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={kind === 'SET' ? tr('π.χ. Σετ Λαπαροτομίας') : tr('π.χ. Λαβίδα Kocher 20 cm')}
              />
            </label>
            <label>
              <span>{tr('Ειδικότητα')}</span>
              <select className="asset-inline-input" value={specialty} onChange={e => setSpecialty(e.target.value)}>
                <option value="">{tr('— Χωρίς ειδικότητα —')}</option>
                {specialties.map(x => (
                  <option key={x.id} value={x.el}>
                    {x.el}
                  </option>
                ))}
              </select>
              <small>{tr('Προαιρετικό για Σετ και εργαλεία.')}</small>
            </label>
            <label>
              <span>{tr('Τμήμα')}</span>
              <select className="asset-inline-input" value={department} onChange={e => setDepartment(e.target.value)}>
                <option value="">{tr('— Χωρίς τμήμα / Απόθεμα —')}</option>
                {allowedDepartments.map(x => (
                  <option key={x.id} value={x.el}>
                    {x.el}
                  </option>
                ))}
              </select>
              <small>
                {kind === 'SET'
                  ? tr('Χωρίς Τμήμα, το Σετ καταχωρείται αυτόματα ως Απόθεμα Σετ και παραμένει ενιαίο.')
                  : tr(
                      'Χωρίς Τμήμα, το εργαλείο καταχωρείται αυτόματα στο Απόθεμα εργαλείων. Με Τμήμα, καταχωρείται ως μεμονωμένο σε χρήση.',
                    )}
              </small>
            </label>
            <label>
              <span>{tr('Κατασκευαστής')}</span>
              <select
                className="asset-inline-input"
                value={manufacturer}
                onChange={e => setManufacturer(e.target.value)}
              >
                <option value="">{tr('— Χωρίς κατασκευαστή —')}</option>
                {manufacturers.map(x => (
                  <option key={x.id} value={x.el}>
                    {x.el}
                  </option>
                ))}
              </select>
              <small>{tr('Προαιρετικό για Σετ και εργαλεία.')}</small>
            </label>
            {kind === 'TOOL' && (
              <label>
                <span>{tr('Σειριακός αριθμός')}</span>
                <input
                  className="asset-inline-input"
                  value={serialNumber}
                  disabled={quantity > 1}
                  onChange={e => setSerialNumber(e.target.value)}
                  placeholder={quantity > 1 ? tr('Μόνο για 1 τεμάχιο') : tr('Προαιρετικό')}
                />
              </label>
            )}
            <label>
              <span>{tr('Τύπος χρήσης')}</span>
              <select
                className="asset-inline-input"
                value={limited ? 'LIMITED' : 'UNLIMITED'}
                onChange={e => setLimited(e.target.value === 'LIMITED')}
              >
                <option value="UNLIMITED">{tr('Χωρίς όριο')}</option>
                <option value="LIMITED">{tr('Περιορισμένων χρήσεων')}</option>
              </select>
            </label>
            {limited && (
              <label>
                <span>{tr('Αρχικό όριο χρήσεων')}</span>
                <input
                  className="asset-inline-input"
                  type="number"
                  min="1"
                  value={maxUses}
                  onChange={e => setMaxUses(e.target.value)}
                />
              </label>
            )}
          </div>

          <div className="asset-sidebar-quickfacts">
            <div className="asset-barcode-card">
              <div>
                <span>{kind === 'SET' ? tr('Barcode Set') : tr('Barcode εργαλείου')}</span>
              </div>
              <strong className="mono">{barcode}</strong>
            </div>
            {kind === 'SET' ? (
              <div className="asset-workbench-mini">
                <AssetTypeIcon kind="SET" size={17} />
                <div>
                  <span>{tr('Αρχική σύνθεση')}</span>
                  <strong>
                    {selected.length} {tr('εργαλεία')}
                  </strong>
                </div>
              </div>
            ) : (
              <div className="asset-workbench-mini">
                <AssetTypeIcon kind="TOOL" maxUses={limited ? Number(maxUses) || 1 : undefined} size={17} />
                <div>
                  <span>{tr('Καταχώριση')}</span>
                  <strong>{department.trim() ? tr('Μεμονωμένο σε χρήση') : tr('Απόθεμα εργαλείων')}</strong>
                </div>
              </div>
            )}
          </div>

          <button
            className="asset-cover"
            type="button"
            onClick={() => setTab('PHOTOS')}
            aria-label={cover ? `${tr('Προσθήκη φωτογραφιών')} ${photos.length}` : undefined}
          >
            {cover ? (
              <img src={cover} alt={name || tr('Νέο αντικείμενο')} />
            ) : (
              <div className="asset-cover-empty">
                <Images size={30} />
                <strong>{tr('Χωρίς φωτογραφία')}</strong>
                <span>{tr('Λήψη ή upload πριν την αποθήκευση')}</span>
              </div>
            )}
            <span className="asset-cover-count">
              <Images size={14} />
              {photos.length}
            </span>
          </button>
        </aside>

        <section className="asset-workbench-main">
          <div className="asset-tabs asset-detail-tabs asset-create-tabs">
            <button className={tab === 'DETAILS' ? 'active' : ''} onClick={() => setTab('DETAILS')}>
              {tr('Βασικά')}
            </button>
            {kind === 'SET' && (
              <button className={tab === 'COMPOSITION' ? 'active' : ''} onClick={() => setTab('COMPOSITION')}>
                {tr('Σύνθεση') + ' '}
                <span>{selected.length}</span>
              </button>
            )}
            <button className={tab === 'PHOTOS' ? 'active' : ''} onClick={() => setTab('PHOTOS')}>
              {tr('Φωτογραφίες') + ' '}
              <span>{photos.length}</span>
            </button>
            <button className={tab === 'NOTES' ? 'active' : ''} onClick={() => setTab('NOTES')}>
              {tr('Σημειώσεις')}
            </button>
          </div>

          <div className="asset-detail-body">
            {tab === 'DETAILS' && (
              <section className="asset-section asset-detail-full-panel">
                <div className="asset-section-head">
                  <div>
                    <span className="eyebrow">{tr('ΝΕΑ ΚΑΤΑΧΩΡΙΣΗ')}</span>
                    <h2>{kind === 'SET' ? tr('Ρυθμίσεις νέου Σετ') : tr('Ρυθμίσεις νέου εργαλείου')}</h2>
                    <p>
                      {tr(
                        'Η καρτέλα δημιουργείται με τα ίδια στοιχεία που θα χρησιμοποιείς αργότερα στην προβολή και επεξεργασία.',
                      )}
                    </p>
                  </div>
                </div>
                <div className="asset-section-body">
                  <div className="form-grid form-grid-comfortable">
                    {kind === 'SET' && (
                      <div className="asset-inline-info">
                        <strong>{department.trim() ? tr('Σετ σε χρήση') : tr('Απόθεμα Σετ')}</strong>
                        <small>
                          {department.trim()
                            ? tr('Θα καταχωρηθεί στο τμήμα {0}.', department)
                            : tr('Χωρίς Τμήμα, θα καταχωρηθεί αυτόματα ως ενιαίο Απόθεμα Σετ.')}
                        </small>
                      </div>
                    )}
                    {kind === 'TOOL' && (
                      <>
                        <div className="asset-inline-info">
                          <strong>{department.trim() ? tr('Μεμονωμένο σε χρήση') : tr('Απόθεμα εργαλείων')}</strong>
                          <small>
                            {department.trim()
                              ? tr('Θα καταχωρηθεί στο τμήμα {0}.', department)
                              : tr('Χωρίς Τμήμα, θα καταχωρηθεί αυτόματα στο Απόθεμα εργαλείων.')}
                          </small>
                        </div>
                        <label>
                          {tr('Ποσότητα')}
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={quantity}
                            onChange={e => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                          />
                          <small>{tr('Κάθε φυσικό τεμάχιο παίρνει δικό του barcode.')}</small>
                        </label>
                      </>
                    )}
                    <label className="span-2">
                      Barcode
                      <input className="mono" value={barcode} readOnly />
                      <small>
                        {tr(
                          'Αποδίδεται αυτόματα κατά την αποθήκευση. Ο κωδικός και το barcode παραμένουν διαφορετικά στοιχεία.',
                        )}
                      </small>
                    </label>
                  </div>
                </div>
              </section>
            )}

            {kind === 'SET' && tab === 'COMPOSITION' && (
              <section className="asset-section asset-detail-full-panel create-card-composition">
                <div className="asset-section-head">
                  <div>
                    <span className="eyebrow">{tr('ΣΥΝΘΕΣΗ')}</span>
                    <h2>{tr('Εργαλεία νέου Σετ')}</h2>
                    <p>{tr('Επίλεξε τα φυσικά εργαλεία που θα ανήκουν στο Σετ από την πρώτη αποθήκευση.')}</p>
                  </div>
                  <span className="selection-count">
                    {selected.length} {tr('επιλεγμένα')}
                  </span>
                </div>
                <div className="create-card-composition-body">
                  <div className="source-tabs create-set-source-tabs">
                    <button className={source === 'STOCK' ? 'active' : ''} onClick={() => setSource('STOCK')}>
                      Stock <span>{tools.filter(t => t.mode === 'STOCK').length}</span>
                    </button>
                    <button className={source === 'SET_MEMBER' ? 'active' : ''} onClick={() => setSource('SET_MEMBER')}>
                      {tr('Από άλλο Σετ')}
                    </button>
                    <button className={source === 'STANDALONE' ? 'active' : ''} onClick={() => setSource('STANDALONE')}>
                      {tr('Μεμονωμένα')}
                    </button>
                  </div>
                  <div className="composer-search create-set-search">
                    <Search size={17} />
                    <input
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder={tr('Barcode, κωδικός ή ονομασία εργαλείου...')}
                    />
                  </div>
                  <div className="create-set-list-head">
                    <span></span>
                    <span>{tr('Barcode / Κωδικός')}</span>
                    <span>{tr('Εργαλείο')}</span>
                    <span>{tr('Προέλευση')}</span>
                  </div>
                  <div className="composer-list create-set-tools-list">
                    {candidates.map(t => {
                      const parent = sets.find(s => s.id === t.setId);
                      const sourceLabel =
                        t.mode === 'STOCK'
                          ? 'Απόθεμα'
                          : t.mode === 'SET_MEMBER'
                            ? `${parent?.barcode || tr('Σετ')} · ${parent?.name || ''}`
                            : trData(t.department) || '—';
                      const active = selected.includes(t.id);
                      return (
                        <button
                          type="button"
                          className={`composer-row create-set-tool-row ${active ? 'selected' : ''}`}
                          key={t.id}
                          onClick={() => setSelected(ids => (active ? ids.filter(id => id !== t.id) : [...ids, t.id]))}
                        >
                          <span className="select-mark">{active && <Check size={14} />}</span>
                          <span>
                            <b className="mono">{t.barcode}</b>
                            <small>{t.code}</small>
                          </span>
                          <span>
                            <b>{t.name}</b>
                            <small>{[t.manufacturer, t.specialty].filter(Boolean).join(' · ') || '—'}</small>
                          </span>
                          <span className="source-pill">{sourceLabel}</span>
                        </button>
                      );
                    })}
                    {!candidates.length && (
                      <div className="empty-inline">{tr('Δεν υπάρχουν διαθέσιμα εργαλεία σε αυτή την κατηγορία.')}</div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {tab === 'PHOTOS' && (
              <AssetPhotosCard
                photos={photos}
                onAdd={addPhotos}
                onRemove={removePhoto}
                title={kind === 'SET' ? tr('Φωτογραφίες νέου Σετ') : tr('Φωτογραφίες νέου εργαλείου')}
                description={tr(
                  'Μπορείς να κάνεις λήψη με την κάμερα ή upload πολλών φωτογραφιών πριν από την πρώτη αποθήκευση.',
                )}
              />
            )}

            {tab === 'NOTES' && (
              <section className="asset-section asset-detail-full-panel">
                <div className="asset-section-head">
                  <div>
                    <span className="eyebrow">{tr('ΣΗΜΕΙΩΣΕΙΣ')}</span>
                    <h2>{tr('Μόνιμες παρατηρήσεις')}</h2>
                    <p>{tr('Οι σημειώσεις θα αποθηκευτούν στην ίδια καρτέλα του αντικειμένου.')}</p>
                  </div>
                </div>
                <div className="asset-section-body asset-notes-tab">
                  <textarea
                    className="asset-create-notes"
                    rows={9}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder={tr('Τεχνικές ή μόνιμες παρατηρήσεις...')}
                  />
                </div>
              </section>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
