import {useMemo, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {CheckCircle2, Info, Plus, ShoppingCart, TriangleAlert} from 'lucide-react';
import {useSurgi} from '../../store/SurgiStore';
import {useLibraries} from '../../core/LibraryStore';
import AppButton from '../../components/ui/AppButton';
import EmptyState from '../../components/ui/EmptyState';
import ScrollableListPanel from '../../components/ui/ScrollableListPanel';
import {useConfirm} from '../../components/ui/useConfirm';
import OrderDialog from '../replacements/OrderDialog';
import {pieces} from '../replacements/pieces';
import {kindKey, toolKinds} from '../../core/replacements';
import {belowMinimum, minimumRows, orderLinesForMinimums, type MinimumRow} from '../../core/stockMinimums';
import type {PurchaseOrderLine} from '../../types/domain';
import {tr} from '../../i18n';

const STATUS: Record<MinimumRow['status'], {label: string; className: string}> = {
  OK: {label: 'Επαρκές', className: 'ok'},
  LOW: {label: 'Χαμηλό', className: 'low'},
  OUT: {label: 'Έχει εξαντληθεί', className: 'out'},
  NONE: {label: 'Χωρίς ελάχιστο', className: 'none'},
};

/**
 * The least to keep in Stock of each instrument kind. The admin sets the minimums; whoever manages Stock
 * sees what is below them and orders what is still missing (counting orders already placed).
 */
export default function StockMinimums() {
  const {tools, retiredTools, purchaseOrders, createPurchaseOrder, can, role, currentUser} = useSurgi();
  const {systemSettings, updateSystemSettings} = useLibraries();
  const navigate = useNavigate();
  const [confirm, ask] = useConfirm();
  const [ordering, setOrdering] = useState<PurchaseOrderLine[] | null>(null);
  const [pick, setPick] = useState('');
  const minimums = systemSettings.stockMinimums;
  const editable = role === 'ADMIN';
  const rows = useMemo(
    () => minimumRows([...tools, ...retiredTools], purchaseOrders, minimums),
    [tools, retiredTools, purchaseOrders, minimums],
  );
  // Kinds already listed (in Stock or with a minimum) get their minimum in the list itself; the picker
  // is for the others.
  const kinds = useMemo(() => {
    const listed = new Set(rows.map(r => r.key));
    return toolKinds([...tools, ...retiredTools]).filter(k => !listed.has(kindKey(k)));
  }, [tools, retiredTools, rows]);
  const anyMinimum = rows.some(r => r.min > 0);
  const low = belowMinimum(rows);
  const toOrder = rows.filter(r => r.missing > 0);
  const missingTotal = toOrder.reduce((sum, r) => sum + r.missing, 0);
  const label = (t: {code?: string; name: string}) => (t.code ? `${t.code} · ${t.name}` : t.name);

  const setMin = (key: string, value: number) => {
    const next = {...(minimums || {})};
    const n = Math.max(0, Math.min(9999, Math.floor(value) || 0));
    if (n) next[key] = n;
    else delete next[key];
    updateSystemSettings({stockMinimums: next}, currentUser.name, tr('Ελάχιστο απόθεμα'));
  };
  const addKind = () => {
    const kind = kinds.find(k => label(k) === pick.trim() || k.name === pick.trim() || k.code === pick.trim());
    if (!kind) return;
    if (!minimums?.[kindKey(kind)]) setMin(kindKey(kind), 1);
    setPick('');
  };
  const orderFor = (list: MinimumRow[]) => setOrdering(orderLinesForMinimums(list));

  return (
    <>
      <div className="stock-min-summary">
        <div className={low.length ? 'warn' : anyMinimum ? 'good' : 'none'}>
          {low.length ? <TriangleAlert size={18} /> : anyMinimum ? <CheckCircle2 size={18} /> : <Info size={18} />}
          <span>
            {low.length
              ? tr('{0} είδη είναι κάτω από το ελάχιστο απόθεμα.', low.length)
              : anyMinimum
                ? tr('Όλα τα είδη με ορισμένο ελάχιστο είναι επαρκή.')
                : editable
                  ? tr(
                      'Δεν έχει οριστεί ελάχιστο για κανένα είδος. Συμπληρώστε το Ελάχιστο σε όσα είδη θέλετε να παρακολουθείτε.',
                    )
                  : tr('Δεν έχει οριστεί ελάχιστο για κανένα είδος.')}
            {missingTotal > 0 && ` ${tr('Για να φτάσουν στο ελάχιστο λείπουν {0}.', pieces(missingTotal))}`}
          </span>
        </div>
        {can('stock.manage') && toOrder.length > 0 && (
          <AppButton variant="primary" icon={<ShoppingCart size={15} />} onClick={() => orderFor(toOrder)}>
            {tr('Παραγγελία για όσα λείπουν')}
          </AppButton>
        )}
      </div>
      {editable && (
        <div className="stock-min-add">
          <label>
            {tr('Είδος που δεν υπάρχει στο Απόθεμα')}
            <input
              value={pick}
              onChange={e => setPick(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addKind())}
              placeholder={tr('Κωδικός ή ονομασία εργαλείου')}
              list="stock-min-kinds"
            />
            <datalist id="stock-min-kinds">
              {kinds.map(k => (
                <option key={kindKey(k)} value={label(k)} />
              ))}
            </datalist>
          </label>
          <AppButton icon={<Plus size={15} />} disabled={!pick.trim()} onClick={addKind}>
            {tr('Προσθήκη')}
          </AppButton>
          <small>{tr('Τα είδη του Αποθέματος είναι ήδη στη λίστα: συμπληρώστε το Ελάχιστο δίπλα τους.')}</small>
        </div>
      )}
      <ScrollableListPanel ariaLabel={tr('Ελάχιστα αποθέματα')}>
        {rows.length === 0 ? (
          <EmptyState
            title={tr('Δεν υπάρχουν ελάχιστα αποθέματα ακόμα')}
            description={
              editable
                ? tr('Διαλέξτε ένα είδος παραπάνω και ορίστε πόσα θέλετε να υπάρχουν πάντα στο Απόθεμα.')
                : tr('Ο διαχειριστής ορίζει πόσα εργαλεία κάθε είδους πρέπει να υπάρχουν πάντα στο Απόθεμα.')
            }
          />
        ) : (
          <table className="asset-registry-table stock-min-table">
            <thead>
              <tr>
                <th>{tr('Είδος')}</th>
                <th>{tr('Στο Απόθεμα')}</th>
                <th>{tr('Ελάχιστο')}</th>
                <th>{tr('Σε παραγγελία')}</th>
                <th>{tr('Κατάσταση')}</th>
                <th>
                  <span className="visually-hidden">{tr('Ενέργειες')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.key}>
                  <td>
                    <strong>{r.name}</strong>
                    <small className="stock-min-sub">
                      {r.code || '—'}
                      {r.manufacturer ? ` · ${r.manufacturer}` : ''}
                    </small>
                  </td>
                  <td className="num" data-label={tr('Στο Απόθεμα')}>
                    {r.stock}
                  </td>
                  <td className="num" data-label={tr('Ελάχιστο')}>
                    {editable ? (
                      <input
                        key={`${r.key}-${r.min}`}
                        type="number"
                        min={0}
                        max={9999}
                        defaultValue={r.min || ''}
                        placeholder="—"
                        aria-label={tr('Ελάχιστο για {0}', r.name)}
                        onBlur={e =>
                          Number(e.target.value || 0) !== r.min && setMin(r.key, Number(e.target.value || 0))
                        }
                        onKeyDown={e => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
                      />
                    ) : (
                      r.min || '—'
                    )}
                  </td>
                  <td className="num" data-label={tr('Σε παραγγελία')}>
                    {r.onOrder || '—'}
                  </td>
                  <td>
                    <span className={`stock-min-status ${STATUS[r.status].className}`}>
                      {tr(STATUS[r.status].label)}
                    </span>
                  </td>
                  <td>
                    {can('stock.manage') && r.missing > 0 && (
                      <button type="button" className="issue-action wide" onClick={() => orderFor([r])}>
                        <ShoppingCart size={14} /> {tr('Παραγγελία {0}', r.missing)}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ScrollableListPanel>
      {ordering && (
        <OrderDialog
          initialLines={ordering}
          onClose={() => setOrdering(null)}
          onSave={(lines, details) =>
            ask({
              title: tr('Καταχώρηση παραγγελίας;'),
              message: tr('{0} είδη, {1}.', lines.length, pieces(lines.reduce((sum, line) => sum + line.quantity, 0))),
              confirmLabel: tr('Καταχώρηση'),
              onConfirm: () => {
                const number = createPurchaseOrder(lines, details);
                setOrdering(null);
                if (number) navigate('/issues?tab=replacements&view=orders');
              },
            })
          }
        />
      )}
      {confirm}
    </>
  );
}
