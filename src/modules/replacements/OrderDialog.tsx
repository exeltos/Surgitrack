import {useMemo, useState} from 'react';
import {Plus, ShoppingCart, Trash2, X} from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import {useSurgi} from '../../store/SurgiStore';
import {useLibraries} from '../../core/LibraryStore';
import {addOrderLine, toolKinds} from '../../core/replacements';
import type {PurchaseOrderLine} from '../../types/domain';
import {tr} from '../../i18n';
import {pieces} from './pieces';

/**
 * The order being recorded, from wherever it was started (a replacement, an issue, a new order): one
 * line per instrument kind with editable quantity, any instrument of the catalogue or a free-typed
 * one can be added, plus supplier and note.
 */
export default function OrderDialog({
  initialLines,
  onClose,
  onSave,
}: {
  initialLines: PurchaseOrderLine[];
  onClose: () => void;
  onSave: (lines: PurchaseOrderLine[], details: {supplier?: string; note?: string}) => void;
}) {
  const {tools, retiredTools} = useSurgi();
  const [lines, setLines] = useState<PurchaseOrderLine[]>(initialLines);
  // The Studio suppliers library, as suggestions; any other name can be typed.
  const suppliers = useLibraries().suppliers.map(item => item.el);
  const [supplier, setSupplier] = useState('');
  const [note, setNote] = useState('');
  const kinds = useMemo(() => toolKinds([...tools, ...retiredTools]), [tools, retiredTools]);
  const [pick, setPick] = useState('');
  const [quantity, setQuantity] = useState(1);
  const total = lines.reduce((sum, line) => sum + line.quantity, 0);
  const label = (t: {code?: string; name: string}) => (t.code ? `${t.code} · ${t.name}` : t.name);
  const add = () => {
    const text = pick.trim();
    if (!text || quantity < 1) return;
    const known = kinds.find(t => label(t) === text || t.name === text || t.code === text);
    setLines(current =>
      addOrderLine(current, {
        code: known?.code || '',
        name: known?.name || text,
        manufacturer: known?.manufacturer,
        quantity,
        reason: tr('Νέα προμήθεια'),
        toolIds: [],
        barcodes: [],
      }),
    );
    setPick('');
    setQuantity(1);
  };
  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="replacements-order-modal" role="dialog" aria-label={tr('Νέα παραγγελία αγοράς')}>
        <header>
          <div>
            <span className="eyebrow">{tr('ΠΑΡΑΓΓΕΛΙΑ ΑΓΟΡΑΣ')}</span>
            <h2>{tr('Νέα παραγγελία αγοράς')}</h2>
            <p>{tr('Μία γραμμή ανά είδος εργαλείου. Αλλάξτε την ποσότητα ή προσθέστε οποιοδήποτε άλλο εργαλείο.')}</p>
          </div>
          <button type="button" className="modal-x" aria-label={tr('Κλείσιμο')} onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="replacements-order-lines">
          <table>
            <thead>
              <tr>
                <th>{tr('Κωδικός')}</th>
                <th>{tr('Εργαλείο')}</th>
                <th>{tr('Αιτία')}</th>
                <th>{tr('Αντικαθιστά')}</th>
                <th>{tr('Ποσ.')}</th>
                <th>
                  <span className="visually-hidden">{tr('Αφαίρεση')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={`${line.code}-${line.name}`}>
                  <td className="mono">{line.code || '—'}</td>
                  <td>
                    <strong>{line.name}</strong>
                    <small>{line.manufacturer || ''}</small>
                  </td>
                  <td>{line.reason}</td>
                  <td className="mono barcodes">{line.barcodes.join(', ') || '—'}</td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={line.quantity}
                      aria-label={tr('Ποσότητα')}
                      onChange={e =>
                        setLines(current =>
                          current.map((l, i) =>
                            i === index ? {...l, quantity: Math.max(1, Math.min(999, Number(e.target.value) || 1))} : l,
                          ),
                        )
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={tr('Αφαίρεση γραμμής')}
                      onClick={() => setLines(current => current.filter((_, i) => i !== index))}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {!lines.length && (
                <tr>
                  <td colSpan={6} className="empty">
                    {tr('Προσθέστε το πρώτο εργαλείο από τη φόρμα παρακάτω.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="replacements-order-add">
          <label>
            {tr('Προσθήκη εργαλείου')}
            <input
              value={pick}
              onChange={e => setPick(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
              placeholder={tr('Κωδικός ή ονομασία (από το κατάλογο ή ελεύθερο κείμενο)')}
              list="replacement-kinds"
            />
            <datalist id="replacement-kinds">
              {kinds.map(t => (
                <option key={`${t.code}-${t.name}`} value={label(t)} />
              ))}
            </datalist>
          </label>
          <label className="qty">
            {tr('Ποσότητα')}
            <input
              type="number"
              min={1}
              max={999}
              value={quantity}
              onChange={e => setQuantity(Math.max(1, Math.min(999, Number(e.target.value) || 1)))}
            />
          </label>
          <AppButton icon={<Plus size={15} />} disabled={!pick.trim()} onClick={add}>
            {tr('Προσθήκη')}
          </AppButton>
        </div>
        <div className="replacements-order-fields">
          <label>
            {tr('Προμηθευτής')}
            <input
              value={supplier}
              onChange={e => setSupplier(e.target.value)}
              placeholder={tr('Επιλέξτε ή γράψτε (προαιρετικό)')}
              list="replacement-suppliers"
            />
            <datalist id="replacement-suppliers">
              {suppliers.map(name => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
          <label>
            {tr('Σημείωση')}
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={tr('Π.χ. επείγον, προϋπολογισμός…')}
            />
          </label>
        </div>
        <footer>
          <span>{pieces(total)}</span>
          <AppButton onClick={onClose}>{tr('Ακύρωση')}</AppButton>
          <AppButton
            variant="primary"
            icon={<ShoppingCart size={15} />}
            disabled={!total}
            onClick={() => onSave(lines, {supplier, note})}
          >
            {tr('Καταχώρηση παραγγελίας')}
          </AppButton>
        </footer>
      </div>
    </div>
  );
}
