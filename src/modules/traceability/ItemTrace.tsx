import type {ReactNode} from 'react';
import {shortCycleNumber} from '../../core/cycleNumber';
import {Link} from 'react-router-dom';
import {ExternalLink} from 'lucide-react';
import {useUndoneMovements} from '../../components/assets/useUndoneMovements';
import {formatDate} from '../../core/displayDate';
import {tr, trData} from '../../i18n';
import {statusLabel} from '../../components/ui/statusLabel';
import type {Movement, SetAsset, Tool} from '../../types/domain';
import InfoList from './InfoList';
import ItemHistory from './ItemHistory';
import {daysUntil, isSetAsset, time, type CycleEntry, type Round} from './traceModel';

type Props = {
  asset: SetAsset | Tool;
  /** The Set an instrument travels in, when it is a member of one. */
  carrierSet?: SetAsset;
  moves: Movement[];
  cycles: CycleEntry[];
  rounds: Round[];
  onPatient: (code: string) => void;
  onLoad: (loadId: string) => void;
  /** More actions beside «Καρτέλα Σετ» (the download). */
  actions?: ReactNode;
};

/**
 * One Set or instrument: a list of what is known (where it is, last cycle, last patient, uses, expiry), then every
 * step in one table, newest first, with a line where each round (a cycle and what followed it) begins.
 */
export default function ItemTrace({asset, carrierSet, moves, cycles, rounds, onPatient, onLoad, actions}: Props) {
  const undone = useUndoneMovements();
  const isSet = isSetAsset(asset);
  const tool = isSet ? undefined : asset;
  const last = [...moves].sort((a, b) => time(b.at) - time(a.at))[0];
  const lastCycle = cycles[0];
  const lastPatient = [...moves]
    .sort((a, b) => time(b.at) - time(a.at))
    .find(m => m.patientCode && !m.undoes && !undone.has(m.id));
  // A member instrument is as sterile as its Set.
  const sterileUntil = (carrierSet || asset).sterileUntil;
  const daysLeft = daysUntil(sterileUntil);
  const uses = tool ? tool.uses : (asset as SetAsset).uses;
  const maxUses = tool?.maxUses;
  const currentCycle = rounds[0]?.cycle;
  const currentPatient = rounds[0]?.moves.some(m => m.patientCode && !undone.has(m.id));

  return (
    <>
      <div className="trace-item-head">
        <div>
          <small>
            <span className="mono">{asset.barcode}</span> · {isSet ? tr('Σετ') : tr('Εργαλείο')}
            {carrierSet && ` · ${tr('στο Σετ {0}', `${carrierSet.barcode} ${carrierSet.name}`)}`}
          </small>
          <h2>{asset.name}</h2>
        </div>
        <div className="trace-head-actions">
          {actions}
          <Link className="app-button trace-open" to={isSet ? `/sets/${asset.id}` : `/tools/${asset.id}`}>
            <ExternalLink size={16} /> {isSet ? tr('Καρτέλα Σετ') : tr('Καρτέλα εργαλείου')}
          </Link>
        </div>
      </div>
      <InfoList
        label={tr('Σύνοψη')}
        rows={[
          {
            label: tr('Πού είναι τώρα'),
            value: (
              <>
                <b>{trData(asset.department) || tr('Απόθεμα')}</b>
                <small>
                  {statusLabel(asset.state)}
                  {last && ` · ${tr('από {0}', last.at)}`}
                </small>
              </>
            ),
          },
          // What the current round already shows (its cycle, its patient) is not said again here.
          !currentCycle && {
            label: tr('Τελευταίος κύκλος'),
            value: lastCycle ? (
              <>
                <b>
                  {lastCycle.sterilizer} · #{shortCycleNumber(lastCycle.cycleNumber)}
                </b>
                <small>{lastCycle.at}</small>
                <i className={`trace-tone ${lastCycle.tone}`}>{tr(lastCycle.label)}</i>
                {lastCycle.loadId && (
                  <button type="button" className="trace-link" onClick={() => onLoad(lastCycle.loadId!)}>
                    {tr('Φορτίο')}
                  </button>
                )}
              </>
            ) : (
              '—'
            ),
          },
          !currentPatient && {
            label: tr('Τελευταίος ασθενής'),
            value: lastPatient ? (
              <>
                <button type="button" className="trace-link" onClick={() => onPatient(lastPatient.patientCode!)}>
                  {lastPatient.patientCode}
                </button>
                <small>
                  {lastPatient.at} · {trData(lastPatient.from || lastPatient.to)}
                </small>
              </>
            ) : (
              '—'
            ),
          },
          // Uses and expiry only when there is something to say.
          (!!maxUses || !!uses) && {
            label: tr('Χρήσεις'),
            value: maxUses ? (
              <>
                <b>
                  {uses ?? 0} / {maxUses}
                </b>
                <small>{tr('Απομένουν {0}', Math.max(0, maxUses - (uses ?? 0)))}</small>
              </>
            ) : (
              <b>{uses ?? '—'}</b>
            ),
          },
          !!sterileUntil && {
            label: tr('Αποστειρωμένο έως'),
            value: sterileUntil ? (
              <>
                <b>{formatDate(sterileUntil)}</b>
                {daysLeft !== undefined && (
                  <small className={daysLeft < 0 ? 'trace-expired' : undefined}>
                    {daysLeft < 0 ? tr('Έληξε') : tr('Σε {0} ημέρες', daysLeft)}
                  </small>
                )}
              </>
            ) : (
              '—'
            ),
          },
        ].filter(<T,>(row: T | false): row is T => row !== false)}
      />

      <ItemHistory key={asset.id} rounds={rounds} onPatient={onPatient} onLoad={onLoad} />
    </>
  );
}
