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
          <span className="asset-create-mode-label">ΝΕΑ ΚΑΤΑΧΩΡΙΣΗ</span>
          <AppButton variant="primary" icon={<Save size={17} />} disabled={!valid} onClick={save}>
            Αποθήκευση
          </AppButton>
          <AppButton icon={<X size={17} />} onClick={() => navigate(backTo)}>
            Ακύρωση
          </AppButton>
        </div>
        <div className="asset-action-group">
          <button className="asset-action-link" onClick={() => navigate(backTo)}>
            <ArrowLeft size={18} /> Πίσω στη λίστα
          </button>
        </div>
      </div>

      <div className="asset-workbench-grid">
        <aside className="asset-workbench-sidebar asset-create-sidebar">
          <div className="asset-workbench-title">
            <div className="asset-workbench-title-main">
              <AssetTypeIcon kind={kind} maxUses={limited ? Number(maxUses) || 1 : undefined} framed size={19} />
              <div>
                <span className="eyebrow">{kind === 'SET' ? 'ΝΕΑ ΚΑΡΤΕΛΑ ΣΕΤ' : 'ΝΕΑ ΚΑΡΤΕΛΑ ΕΡΓΑΛΕΙΟΥ'}</span>
                <h1>{name || 'Χωρίς ονομασία'}</h1>
                <p>{code || 'Συμπλήρωσε κωδικό'}</p>
              </div>
            </div>
            <span className="status-badge">ΝΕΟ</span>
          </div>

          <div className="asset-fields-heading">
            <strong>Στοιχεία</strong>
            <span className="asset-create-required">* υποχρεωτικά</span>
          </div>
          <div className="asset-create-field-list">
            <label>
              <span>Κωδικός *</span>
              <input
                className="asset-inline-input"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="π.χ. 12.15.321"
              />
            </label>
            <label>
              <span>Ονομασία *</span>
              <input
                className="asset-inline-input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={kind === 'SET' ? 'π.χ. Σετ Λαπαροτομίας' : 'π.χ. Λαβίδα Kocher 20 cm'}
              />
            </label>
            <label>
              <span>Ειδικότητα</span>
              <select className="asset-inline-input" value={specialty} onChange={e => setSpecialty(e.target.value)}>
                <option value="">— Χωρίς ειδικότητα —</option>
                {specialties.map(x => (
                  <option key={x.id} value={x.el}>
                    {x.el}
                  </option>
                ))}
              </select>
              <small>Προαιρετικό για Σετ και εργαλεία.</small>
            </label>
            <label>
              <span>Τμήμα</span>
              <select className="asset-inline-input" value={department} onChange={e => setDepartment(e.target.value)}>
                <option value="">— Χωρίς τμήμα / Stock —</option>
                {allowedDepartments.map(x => (
                  <option key={x.id} value={x.el}>
                    {x.el}
                  </option>
                ))}
              </select>
              <small>
                {kind === 'SET'
                  ? 'Χωρίς Τμήμα, το Σετ καταχωρείται αυτόματα ως Stock Σετ και παραμένει ενιαίο.'
                  : 'Χωρίς Τμήμα, το εργαλείο καταχωρείται αυτόματα στο Stock εργαλείων. Με Τμήμα, καταχωρείται ως μεμονωμένο σε χρήση.'}
              </small>
            </label>
            <label>
              <span>Κατασκευαστής</span>
              <select
                className="asset-inline-input"
                value={manufacturer}
                onChange={e => setManufacturer(e.target.value)}
              >
                <option value="">— Χωρίς κατασκευαστή —</option>
                {manufacturers.map(x => (
                  <option key={x.id} value={x.el}>
                    {x.el}
                  </option>
                ))}
              </select>
              <small>Προαιρετικό για Σετ και εργαλεία.</small>
            </label>
            {kind === 'TOOL' && (
              <label>
                <span>Serial</span>
                <input
                  className="asset-inline-input"
                  value={serialNumber}
                  disabled={quantity > 1}
                  onChange={e => setSerialNumber(e.target.value)}
                  placeholder={quantity > 1 ? 'Μόνο για 1 τεμάχιο' : 'Προαιρετικό'}
                />
              </label>
            )}
            <label>
              <span>Τύπος χρήσης</span>
              <select
                className="asset-inline-input"
                value={limited ? 'LIMITED' : 'UNLIMITED'}
                onChange={e => setLimited(e.target.value === 'LIMITED')}
              >
                <option value="UNLIMITED">Χωρίς όριο</option>
                <option value="LIMITED">Περιορισμένων χρήσεων</option>
              </select>
            </label>
            {limited && (
              <label>
                <span>Αρχικό όριο χρήσεων</span>
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
                <span>Barcode {kind === 'SET' ? 'Set' : 'Tool'}</span>
              </div>
              <strong className="mono">{barcode}</strong>
            </div>
            {kind === 'SET' ? (
              <div className="asset-workbench-mini">
                <AssetTypeIcon kind="SET" size={17} />
                <div>
                  <span>Αρχική σύνθεση</span>
                  <strong>{selected.length} εργαλεία</strong>
                </div>
              </div>
            ) : (
              <div className="asset-workbench-mini">
                <AssetTypeIcon kind="TOOL" maxUses={limited ? Number(maxUses) || 1 : undefined} size={17} />
                <div>
                  <span>Καταχώριση</span>
                  <strong>{department.trim() ? 'Μεμονωμένο σε χρήση' : 'Stock εργαλείων'}</strong>
                </div>
              </div>
            )}
          </div>

          <button
            className="asset-cover"
            type="button"
            onClick={() => setTab('PHOTOS')}
            aria-label="Προσθήκη φωτογραφιών"
          >
            {cover ? (
              <img src={cover} alt={name || 'Νέο αντικείμενο'} />
            ) : (
              <div className="asset-cover-empty">
                <Images size={30} />
                <strong>Χωρίς φωτογραφία</strong>
                <span>Λήψη ή upload πριν την αποθήκευση</span>
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
              Βασικά
            </button>
            {kind === 'SET' && (
              <button className={tab === 'COMPOSITION' ? 'active' : ''} onClick={() => setTab('COMPOSITION')}>
                Σύνθεση <span>{selected.length}</span>
              </button>
            )}
            <button className={tab === 'PHOTOS' ? 'active' : ''} onClick={() => setTab('PHOTOS')}>
              Φωτογραφίες <span>{photos.length}</span>
            </button>
            <button className={tab === 'NOTES' ? 'active' : ''} onClick={() => setTab('NOTES')}>
              Σημειώσεις
            </button>
          </div>

          <main className="asset-detail-body">
            {tab === 'DETAILS' && (
              <section className="asset-section asset-detail-full-panel">
                <div className="asset-section-head">
                  <div>
                    <span className="eyebrow">ΝΕΑ ΚΑΤΑΧΩΡΙΣΗ</span>
                    <h2>{kind === 'SET' ? 'Ρυθμίσεις νέου Σετ' : 'Ρυθμίσεις νέου εργαλείου'}</h2>
                    <p>
                      Η καρτέλα δημιουργείται με τα ίδια στοιχεία που θα χρησιμοποιείς αργότερα στην προβολή και
                      επεξεργασία.
                    </p>
                  </div>
                </div>
                <div className="asset-section-body">
                  <div className="form-grid form-grid-comfortable">
                    {kind === 'SET' && (
                      <div className="asset-inline-info">
                        <strong>{department.trim() ? 'Σετ σε χρήση' : 'Stock Σετ'}</strong>
                        <small>
                          {department.trim()
                            ? `Θα καταχωρηθεί στο τμήμα ${department}.`
                            : 'Χωρίς Τμήμα, θα καταχωρηθεί αυτόματα ως ενιαίο Stock Σετ.'}
                        </small>
                      </div>
                    )}
                    {kind === 'TOOL' && (
                      <>
                        <div className="asset-inline-info">
                          <strong>{department.trim() ? 'Μεμονωμένο σε χρήση' : 'Stock εργαλείων'}</strong>
                          <small>
                            {department.trim()
                              ? `Θα καταχωρηθεί στο τμήμα ${department}.`
                              : 'Χωρίς Τμήμα, θα καταχωρηθεί αυτόματα στο Stock εργαλείων.'}
                          </small>
                        </div>
                        <label>
                          Ποσότητα
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={quantity}
                            onChange={e => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                          />
                          <small>Κάθε φυσικό τεμάχιο παίρνει δικό του barcode.</small>
                        </label>
                      </>
                    )}
                    <label className="span-2">
                      Barcode
                      <input className="mono" value={barcode} readOnly />
                      <small>
                        Αποδίδεται αυτόματα κατά την αποθήκευση. Ο κωδικός και το barcode παραμένουν διαφορετικά
                        στοιχεία.
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
                    <span className="eyebrow">ΣΥΝΘΕΣΗ</span>
                    <h2>Εργαλεία νέου Σετ</h2>
                    <p>Επίλεξε τα φυσικά εργαλεία που θα ανήκουν στο Σετ από την πρώτη αποθήκευση.</p>
                  </div>
                  <span className="selection-count">{selected.length} επιλεγμένα</span>
                </div>
                <div className="create-card-composition-body">
                  <div className="source-tabs create-set-source-tabs">
                    <button className={source === 'STOCK' ? 'active' : ''} onClick={() => setSource('STOCK')}>
                      Stock <span>{tools.filter(t => t.mode === 'STOCK').length}</span>
                    </button>
                    <button className={source === 'SET_MEMBER' ? 'active' : ''} onClick={() => setSource('SET_MEMBER')}>
                      Από άλλο Σετ
                    </button>
                    <button className={source === 'STANDALONE' ? 'active' : ''} onClick={() => setSource('STANDALONE')}>
                      Μεμονωμένα
                    </button>
                  </div>
                  <div className="composer-search create-set-search">
                    <Search size={17} />
                    <input
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder="Barcode, κωδικός ή ονομασία εργαλείου..."
                    />
                  </div>
                  <div className="create-set-list-head">
                    <span></span>
                    <span>Barcode / Κωδικός</span>
                    <span>Εργαλείο</span>
                    <span>Προέλευση</span>
                  </div>
                  <div className="composer-list create-set-tools-list">
                    {candidates.map(t => {
                      const parent = sets.find(s => s.id === t.setId);
                      const sourceLabel =
                        t.mode === 'STOCK'
                          ? 'Stock'
                          : t.mode === 'SET_MEMBER'
                            ? `${parent?.barcode || 'Σετ'} · ${parent?.name || ''}`
                            : t.department || '—';
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
                      <div className="empty-inline">Δεν υπάρχουν διαθέσιμα εργαλεία σε αυτή την κατηγορία.</div>
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
                title={kind === 'SET' ? 'Φωτογραφίες νέου Σετ' : 'Φωτογραφίες νέου εργαλείου'}
                description="Μπορείς να κάνεις λήψη με την κάμερα ή upload πολλών φωτογραφιών πριν από την πρώτη αποθήκευση."
              />
            )}

            {tab === 'NOTES' && (
              <section className="asset-section asset-detail-full-panel">
                <div className="asset-section-head">
                  <div>
                    <span className="eyebrow">ΣΗΜΕΙΩΣΕΙΣ</span>
                    <h2>Μόνιμες παρατηρήσεις</h2>
                    <p>Οι σημειώσεις θα αποθηκευτούν στην ίδια καρτέλα του αντικειμένου.</p>
                  </div>
                </div>
                <div className="asset-section-body asset-notes-tab">
                  <textarea
                    className="asset-create-notes"
                    rows={9}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Τεχνικές ή μόνιμες παρατηρήσεις..."
                  />
                </div>
              </section>
            )}
          </main>
        </section>
      </div>
    </div>
  );
}
