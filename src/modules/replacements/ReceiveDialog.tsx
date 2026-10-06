import {useState} from 'react';
import {PackageCheck, X} from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import {lineRemaining} from '../../core/purchaseReceipt';
import type {PurchaseOrder} from '../../types/domain';
import {tr} from '../../i18n';
import {pieces} from './pieces';

/** What arrived of an order: pieces per line (everything still expected by default); fewer makes it a partial receipt. */
export default function ReceiveDialog({
  order,
  onClose,
  onReceive,
}: {
  order: PurchaseOrder;
  onClose: () => void;
  onReceive: (quantities: number[]) => void;
}) {
  const [quantities, setQuantities] = useState(() => order.lines.map(lineRemaining));
  const total = quantities.reduce((sum, n) => sum + n, 0);
  const remaining = order.lines.reduce((sum, line, i) => sum + lineRemaining(line) - quantities[i], 0);
  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="replacements-order-modal receive-modal" role="dialog" aria-label={tr('Παραλαβή παραγγελίας')}>
        <header>
          <div>
            <span className="eyebrow">{order.number}</span>
            <h2>{tr('Παραλαβή παραγγελίας')}</h2>
            <p>{tr('Γράψε πόσα τεμάχια ήρθαν από κάθε είδος. Όσα λείπουν μένουν σε αναμονή.')}</p>
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
                <th>{tr('Παραγγέλθηκαν')}</th>
                <th>{tr('Έχουν ήρθει')}</th>
                <th>{tr('Έρχονται τώρα')}</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((line, i) => (
                <tr key={`${line.code}-${line.name}`}>
                  <td className="mono">{line.code || '—'}</td>
                  <td>
                    <strong>{line.name}</strong>
                    <small>{line.manufacturer || ''}</small>
                  </td>
                  <td>{line.quantity}</td>
                  <td>{line.received || 0}</td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={lineRemaining(line)}
                      value={quantities[i]}
                      disabled={lineRemaining(line) === 0}
                      aria-label={tr('Τεμάχια που ήρθαν για {0}', line.name)}
                      onChange={e =>
                        setQuantities(current =>
                          current.map((q, j) =>
                            j === i
                              ? Math.max(0, Math.min(lineRemaining(line), Math.floor(Number(e.target.value)) || 0))
                              : q,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      className="link-button"
                      disabled={lineRemaining(line) === 0}
                      onClick={() =>
                        setQuantities(current => current.map((q, j) => (j === i ? lineRemaining(line) : q)))
                      }
                    >
                      {tr('Όλα')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer>
          <span>
            {pieces(total)}
            {remaining > 0 && ` · ${tr('{0} σε αναμονή', remaining)}`}
          </span>
          <AppButton onClick={onClose}>{tr('Ακύρωση')}</AppButton>
          <AppButton
            variant="primary"
            icon={<PackageCheck size={15} />}
            disabled={!total}
            onClick={() => onReceive(quantities)}
          >
            {remaining > 0 ? tr('Μερική παραλαβή') : tr('Παραλαβή στο Απόθεμα')}
          </AppButton>
        </footer>
      </div>
    </div>
  );
}
