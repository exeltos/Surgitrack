import {useMemo, useState} from 'react';
import {PackageCheck, ShoppingCart, Undo2} from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import {useConfirm} from '../../components/ui/useConfirm';
import {useSurgi} from '../../store/SurgiStore';
import {orderLineFromTool, REASON_LABEL, replacementItems, allocateStock} from '../../core/replacements';
import type {PurchaseOrderLine, Tool} from '../../types/domain';
import OrderDialog from '../replacements/OrderDialog';
import {pieces} from '../replacements/pieces';
import {tr, trData} from '../../i18n';

/**
 * What can be done with a damaged, lost or in-Service instrument, from its own page: replace it with the
 * same instrument from Stock, order it, or bring it back from Service / when it is found.
 */
export default function ToolReplacementPanel({tool}: {tool: Tool}) {
  const store = useSurgi();
  const {tools, retiredTools, sets, issues, movements, purchaseOrders, can} = store;
  const [confirm, ask] = useConfirm();
  const [ordering, setOrdering] = useState<PurchaseOrderLine[] | null>(null);
  const item = useMemo(
    () =>
      replacementItems({tools, retiredTools, sets, issues, movements, purchaseOrders}).find(i => i.tool.id === tool.id),
    [tools, retiredTools, sets, issues, movements, purchaseOrders, tool.id],
  );
  if (!item) return null;
  const editable = can('stock.manage');
  const canReplace = editable && item.status !== 'REPLACED' && !!item.set && item.stock.length > 0;
  const canReturn = editable && (item.reason === 'SERVICE' || item.reason === 'LOST') && item.status !== 'REPLACED';
  const statusText =
    item.status === 'REPLACED'
      ? tr('Αντικαταστάθηκε')
      : item.status === 'IN_ORDER'
        ? tr('Σε παραγγελία {0}', item.order?.number || '')
        : tr('Χρειάζεται αντικατάσταση');
  return (
    <div className="tool-replacement-panel">
      <div>
        <strong>{tr(REASON_LABEL[item.reason])}</strong>
        <span>{statusText}</span>
        <small>
          {item.set ? `${item.set.barcode} · ${trData(item.set.name)}` : tr('Χωρίς Σετ')}
          {' · '}
          {item.stock.length
            ? tr('Στο Απόθεμα: {0}', pieces(item.stock.length))
            : tr('Δεν υπάρχει ίδιο εργαλείο στο Απόθεμα')}
        </small>
      </div>
      {editable && item.status !== 'REPLACED' && (
        <div className="tool-replacement-actions">
          {canReplace && (
            <AppButton
              variant="primary"
              icon={<PackageCheck size={16} />}
              onClick={() => {
                const pairs = allocateStock([item]);
                if (!pairs.length) return;
                ask({
                  title: tr('Αντικατάσταση από το Απόθεμα;'),
                  message: tr(
                    'Ένα ίδιο εργαλείο από το Απόθεμα μπαίνει στο Σετ και το {0} πάει σε Service. Οι αλλαγές καταγράφονται στο Ιστορικό.',
                    tool.barcode,
                  ),
                  confirmLabel: tr('Αντικατάσταση'),
                  onConfirm: () => store.replaceFromStock(pairs),
                });
              }}
            >
              {tr('Αντικατάσταση')}
            </AppButton>
          )}
          {item.status === 'NEEDED' && (
            <AppButton
              icon={<ShoppingCart size={16} />}
              onClick={() => setOrdering([orderLineFromTool(tool, REASON_LABEL[item.reason])])}
            >
              {tr('Παραγγελία')}
            </AppButton>
          )}
          {canReturn && (
            <AppButton
              icon={<Undo2 size={16} />}
              onClick={() =>
                ask({
                  title: item.reason === 'LOST' ? tr('Βρέθηκε το εργαλείο;') : tr('Επιστροφή από Service;'),
                  message:
                    item.reason === 'LOST'
                      ? tr('Το εργαλείο {0} βρέθηκε και μπαίνει στο Απόθεμα.', tool.barcode)
                      : tr('Το εργαλείο {0} επέστρεψε επισκευασμένο και μπαίνει στο Απόθεμα.', tool.barcode),
                  confirmLabel: tr('Επιστροφή στο Απόθεμα'),
                  onConfirm: () => store.returnToService('TOOL', tool.id),
                })
              }
            >
              {item.reason === 'LOST' ? tr('Βρέθηκε') : tr('Επιστροφή')}
            </AppButton>
          )}
        </div>
      )}
      {confirm}
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
                store.createPurchaseOrder(lines, details);
                setOrdering(null);
              },
            })
          }
        />
      )}
    </div>
  );
}
