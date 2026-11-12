import {Activity, Printer} from 'lucide-react';
import AppButton from '../../../components/ui/AppButton';
import {loadLabel} from '../../../core/loadLabel';
import {LOAD_STATUS} from '../../reports/reportsMeta';
import type {ProcessLoadRecord} from '../../../types/domain';
import {tr, trData} from '../../../i18n';
import LoadContents from './LoadContents';

/**
 * The details of a load in a sterilizer: its cycle (live for a simulated one), and the Sets and instruments in
 * it, each Set with the instruments inside. Opened from «Λεπτομέρειες» of a row.
 */
export default function LoadDetailsDialog({
  load,
  onClose,
  onPrint,
  onReport,
}: {
  load: ProcessLoadRecord;
  onClose: () => void;
  onPrint?: (loadId: string) => void;
  onReport?: (loadId: string) => void;
}) {
  const data = load.cycleData;
  return (
    <div className="modal-backdrop" onMouseDown={e => e.currentTarget === e.target && onClose()}>
      <div className="load-details" role="dialog" aria-modal="true" aria-label={loadLabel(load)}>
        <header>
          <div>
            <h3>
              {trData(load.equipment)} · {tr('Κύκλος')} {load.cycleNumber}
            </h3>
            <p>
              {load.program} · {tr('Φορτώθηκε {0} από {1}', load.createdAt, trData(load.createdByName))} ·{' '}
              <b>{tr(LOAD_STATUS[load.status] || load.status)}</b>
            </p>
          </div>
        </header>
        <div className="load-details-body">
          <LoadContents load={load} />
        </div>
        <footer>
          {onPrint && (
            <AppButton icon={<Printer size={15} />} onClick={() => onPrint(load.id)}>
              {tr('Έντυπο')}
            </AppButton>
          )}
          {onReport && data && (
            <AppButton icon={<Activity size={15} />} onClick={() => onReport(load.id)}>
              {tr('Report κύκλου')}
            </AppButton>
          )}
          <AppButton variant="primary" onClick={onClose}>
            {tr('Κλείσιμο')}
          </AppButton>
        </footer>
      </div>
    </div>
  );
}
