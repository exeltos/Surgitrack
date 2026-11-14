import {useState} from 'react';
import {Link} from 'react-router-dom';
import {ChevronDown, ExternalLink, MapPin} from 'lucide-react';
import AssetTypeIcon from '../../components/assets/AssetTypeIcon';
import {useUndoneMovements} from '../../components/assets/useUndoneMovements';
import {formatDate} from '../../core/displayDate';
import {movementText} from '../../core/movementText';
import {tr, trData} from '../../i18n';
import {statusLabel} from '../../components/ui/statusLabel';
import type {Movement, SetAsset, Tool} from '../../types/domain';
import {daysUntil, isSetAsset, patientsIn, time, type CycleEntry, type Round} from './traceModel';

type Props = {
  asset: SetAsset | Tool;
  /** The Set an instrument travels in, when it is a member of one. */
  carrierSet?: SetAsset;
  moves: Movement[];
  cycles: CycleEntry[];
  rounds: Round[];
  onPatient: (code: string) => void;
  onLoad: (loadId: string) => void;
};

const day = (value: string) => value.split(' ')[0];

/**
 * One Set or instrument: where it is now and what its last cycle, patient, uses and expiry are, then its history
 * round by round (a cycle and what followed it). The newest round is open, the older ones one line each.
 */
export default function ItemTrace({asset, carrierSet, moves, cycles, rounds, onPatient, onLoad}: Props) {
  const undone = useUndoneMovements();
  const [opened, setOpened] = useState<string[]>([]);
  const isSet = isSetAsset(asset);
  const tool = isSet ? undefined : asset;
  const last = [...moves].sort((a, b) => time(b.at) - time(a.at))[0];
  const lastCycle = cycles[0];
  const lastPatient = [...moves]
    .sort((a, b) => time(b.at) - time(a.at))
    .find(m => m.patientCode && !m.undoes && !undone.has(m.id));
  // A member instrument is as sterile as its Set.
  const sterileHolder = carrierSet || asset;
  const sterileUntil = sterileHolder.sterileUntil;
  const daysLeft = daysUntil(sterileUntil);
  const uses = tool ? tool.uses : (asset as SetAsset).uses;
  const maxUses = tool?.maxUses;
  const toggle = (key: string) =>
    setOpened(list => (list.includes(key) ? list.filter(k => k !== key) : [...list, key]));

  return (
    <>
      <section className="trace-summary" aria-label={tr('Σύνοψη')}>
        <div className="trace-summary-head">
          <AssetTypeIcon
            kind={isSet ? 'SET' : 'TOOL'}
            maxUses={tool?.maxUses}
            wearCheck={tool?.wearCheck}
            framed
            size={16}
          />
          <div className="trace-summary-title">
            <small>
              <span className="mono">{asset.barcode}</span> · {isSet ? tr('Σετ') : tr('Εργαλείο')}
              {carrierSet && ` · ${tr('στο Σετ {0}', `${carrierSet.barcode} ${carrierSet.name}`)}`}
            </small>
            <h2>{asset.name}</h2>
          </div>
          <div className="trace-now">
            <span className="trace-now-place">
              <MapPin size={16} aria-hidden="true" /> {trData(asset.department) || tr('Απόθεμα')}
            </span>
            <small>
              {statusLabel(asset.state)}
              {last && ` · ${tr('από {0}', last.at)}`}
            </small>
          </div>
        </div>
        <dl className="trace-facts">
          <div>
            <dt>{tr('Τελευταίος κύκλος')}</dt>
            {lastCycle ? (
              <dd>
                <b>
                  {lastCycle.sterilizer} · #{lastCycle.cycleNumber}
                </b>
                <span>
                  {lastCycle.at} <i className={`trace-tone ${lastCycle.tone}`}>{tr(lastCycle.label)}</i>
                </span>
              </dd>
            ) : (
              <dd>
                <b>—</b>
              </dd>
            )}
          </div>
          <div>
            <dt>{tr('Τελευταίος ασθενής')}</dt>
            {lastPatient ? (
              <dd>
                <button type="button" className="trace-link" onClick={() => onPatient(lastPatient.patientCode!)}>
                  {lastPatient.patientCode}
                </button>
                <span>
                  {day(lastPatient.at)} · {trData(lastPatient.from || lastPatient.to)}
                </span>
              </dd>
            ) : (
              <dd>
                <b>—</b>
              </dd>
            )}
          </div>
          <div>
            <dt>{tr('Χρήσεις')}</dt>
            <dd>
              <b>{maxUses ? `${uses ?? 0} / ${maxUses}` : (uses ?? '—')}</b>
              {maxUses ? <span>{tr('Απομένουν {0}', Math.max(0, maxUses - (uses ?? 0)))}</span> : null}
            </dd>
          </div>
          <div>
            <dt>{tr('Αποστειρωμένο έως')}</dt>
            <dd>
              <b>{sterileUntil ? formatDate(sterileUntil) : '—'}</b>
              {daysLeft !== undefined && (
                <span className={daysLeft < 0 ? 'trace-expired' : undefined}>
                  {daysLeft < 0 ? tr('Έληξε') : tr('Σε {0} ημέρες', daysLeft)}
                </span>
              )}
            </dd>
          </div>
        </dl>
        <Link className="app-button trace-open" to={isSet ? `/sets/${asset.id}` : `/tools/${asset.id}`}>
          <ExternalLink size={16} /> {isSet ? tr('Καρτέλα Σετ') : tr('Καρτέλα εργαλείου')}
        </Link>
      </section>

      <section className="trace-rounds" aria-label={tr('Ιστορικό ανά γύρο')}>
        <h3>{tr('Ιστορικό ανά γύρο')}</h3>
        {rounds.length === 0 && <p className="trace-hint">{tr('Δεν βρέθηκαν κινήσεις')}</p>}
        {rounds.map((round, index) => {
          const open = index === 0 || opened.includes(round.key);
          // The cycle among the moves, in the order they happened.
          const steps: Array<{at: string; move?: Movement; cycle?: CycleEntry}> = [
            ...round.moves.map(m => ({at: m.at, move: m})),
            ...(round.cycle ? [{at: round.cycle.at, cycle: round.cycle}] : []),
          ].sort((a, b) => time(a.at) - time(b.at));
          const first = steps[0]?.at || '';
          const end = steps[steps.length - 1]?.at;
          const range = index === 0 ? tr('από {0}', day(first)) : `${day(first)} – ${day(end || first)}`;
          const patients = patientsIn(round.moves);
          const title = index === 0 ? tr('Τρέχων γύρος') : range;
          const headline = [
            round.cycle ? `${round.cycle.sterilizer} · #${round.cycle.cycleNumber}` : tr('Χωρίς καταγεγραμμένο κύκλο'),
            patients.length ? tr('ασθενής {0}', patients.join(', ')) : '',
          ]
            .filter(Boolean)
            .join(' · ');
          if (!open)
            return (
              <button
                key={round.key}
                type="button"
                className="trace-round-line"
                aria-expanded={false}
                onClick={() => toggle(round.key)}
              >
                <b>{title}</b>
                <span>{headline}</span>
                <ChevronDown size={18} aria-hidden="true" />
              </button>
            );
          return (
            <div key={round.key} className={`trace-round ${index === 0 ? 'current' : ''}`}>
              <div className="trace-round-head">
                <b>{title}</b>
                <span>{index === 0 ? range : headline}</span>
                {index > 0 && (
                  <button type="button" className="trace-link" aria-expanded onClick={() => toggle(round.key)}>
                    {tr('Κλείσιμο')}
                  </button>
                )}
              </div>
              <ol className="trace-steps">
                {steps.map(({move: m, cycle: c}) =>
                  c ? (
                    <li key={c.id}>
                      <time>{c.at}</time>
                      <span>
                        <b>{tr('Αποστείρωση')}</b>
                        <small>
                          {c.sterilizer} · {tr('κύκλος {0}', c.cycleNumber)}
                          {c.program ? ` · ${c.program}` : ''}
                          {c.via ? ` · ${tr('με το Σετ {0}', c.via)}` : ''}
                        </small>
                      </span>
                      <span className="trace-step-end">
                        <i className={`trace-tone ${c.tone}`}>{tr(c.label)}</i>
                        {c.loadId && (
                          <button type="button" className="trace-link" onClick={() => onLoad(c.loadId!)}>
                            {tr('Φορτίο')}
                          </button>
                        )}
                      </span>
                    </li>
                  ) : (
                    <li key={m!.id}>
                      <time>{m!.at}</time>
                      <span>
                        <b>
                          {movementText(m!.status)}{' '}
                          {undone.has(m!.id) && <span className="undone-badge">{tr('Αναιρέθηκε')}</span>}
                        </b>
                        <small>
                          {trData(m!.from)} → {trData(m!.to)} · {trData(m!.by)}
                        </small>
                      </span>
                      <span className="trace-step-end">
                        {m!.patientCode && (
                          <button type="button" className="trace-link" onClick={() => onPatient(m!.patientCode!)}>
                            {tr('Ασθενής {0}', m!.patientCode)}
                          </button>
                        )}
                      </span>
                    </li>
                  ),
                )}
              </ol>
            </div>
          );
        })}
      </section>
    </>
  );
}
