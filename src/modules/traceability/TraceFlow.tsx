import {shortCycleNumber} from '../../core/cycleNumber';
import {movementKindOf, movementText, type MovementKind} from '../../core/movementText';
import {tr, trData} from '../../i18n';
import type {Movement} from '../../types/domain';
import {time, type CycleEntry, type Round} from './traceModel';

type Props = {
  rounds: Round[];
  undone: Set<string>;
  onPatient: (code: string) => void;
  onLoad: (loadId: string) => void;
};

/** The stages of one round, in the order an item goes through them. */
const STAGES: Array<{key: string; label: string; kinds: MovementKind[]}> = [
  {key: 'receive', label: 'Παραλαβή', kinds: ['RECEIVE']},
  {key: 'wash', label: 'Καθαρισμός', kinds: ['WASH']},
  {key: 'prep', label: 'Σύνθεση', kinds: ['PREP']},
  {key: 'cycle', label: 'Κλίβανος', kinds: ['CYCLE']},
  {key: 'release', label: 'Αποδέσμευση', kinds: ['RELEASE']},
  {key: 'delivery', label: 'Παράδοση', kinds: ['DELIVERY']},
  {key: 'patient', label: 'Ασθενής', kinds: ['SEND']},
];

/**
 * The stage of a move, by what it did: a send back (and a count signed at the operation) is the use on the patient;
 * a recall carries the item's patient code too, but stays a recall.
 */
const stageOf = (m: Movement) => {
  const kind = movementKindOf(m.status);
  if (kind === 'SEND' || (kind === 'OTHER' && m.patientCode)) return 'patient';
  return STAGES.find(s => s.kinds.includes(kind))?.key;
};

/** Stages that gather more than one action: the action is said on each event. */
const MIXED = new Set(['release', 'patient']);

const day = (at: string) => at.split(' ')[0];

/**
 * An item's history as a flow: one line per round (newest first), each a row of stages from its receipt in
 * sterilization to its use on a patient, with when, by whom, which sterilizer and which patient. A stage with
 * nothing recorded stays faint, so a gap shows.
 */
export default function TraceFlow({rounds, undone, onPatient, onLoad}: Props) {
  return (
    <ol className="trace-flow-rounds" aria-label={tr('Ιστορικό')}>
      {rounds.map((round, index) => {
        const byStage = new Map<string, Movement[]>();
        const others: Movement[] = [];
        [...round.moves]
          .sort((a, b) => time(a.at) - time(b.at))
          .forEach(m => {
            const stage = stageOf(m);
            if (!stage) return others.push(m);
            byStage.set(stage, [...(byStage.get(stage) || []), m]);
          });
        const dates = [...round.moves.map(m => m.at), ...(round.cycle ? [round.cycle.at] : [])].sort(
          (a, b) => time(a) - time(b),
        );
        const from = dates[0] && day(dates[0]);
        const to = dates.length > 1 ? day(dates[dates.length - 1]) : undefined;
        return (
          <li key={round.key} className="trace-flow-round">
            <h4>
              {index === 0 ? tr('Τρέχων γύρος') : tr('Γύρος')}
              {from && <span>{to && to !== from ? `${from} – ${to}` : from}</span>}
            </h4>
            <ol className="trace-flow">
              {STAGES.map(stage => {
                const moves = byStage.get(stage.key) || [];
                const cycle = stage.key === 'cycle' ? round.cycle : undefined;
                // A released load fills the release, when no move recorded it.
                const released =
                  stage.key === 'release' && !moves.length && round.cycle?.releasedAt ? round.cycle : undefined;
                const empty = !moves.length && !cycle && !released;
                return (
                  <li key={stage.key} className={`trace-flow-step ${stage.key}${empty ? ' is-empty' : ''}`}>
                    <strong>{tr(stage.label)}</strong>
                    {empty && <span className="trace-flow-none">—</span>}
                    {cycle && <CycleStep cycle={cycle} onLoad={onLoad} />}
                    {released && (
                      <div className="trace-flow-event">
                        <span className="trace-when">{released.releasedAt}</span>
                        <b>
                          {tr('Φορτίο')} #{shortCycleNumber(released.cycleNumber)}
                        </b>
                      </div>
                    )}
                    {moves.map(m => (
                      <MoveStep key={m.id} move={m} undone={undone.has(m.id)} onPatient={onPatient} />
                    ))}
                  </li>
                );
              })}
            </ol>
            {others.length > 0 && (
              <ul className="trace-flow-others">
                {others.map(m => (
                  <li key={m.id} className={undone.has(m.id) ? 'undone' : undefined}>
                    <span className="trace-when">{m.at}</span> <b>{movementText(m.status)}</b>
                    {(m.from || m.to) && ` · ${trData(m.from) || '—'} → ${trData(m.to) || '—'}`} · {trData(m.by)}
                    {undone.has(m.id) && <span className="undone-badge">{tr('Αναιρέθηκε')}</span>}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function CycleStep({cycle: c, onLoad}: {cycle: CycleEntry; onLoad: (loadId: string) => void}) {
  return (
    <div className="trace-flow-event">
      <span className="trace-when">{c.at}</span>
      <b className="wrap">{c.sterilizer}</b>
      <small>
        {tr('κύκλος {0}', shortCycleNumber(c.cycleNumber))}
        {c.program ? ` · ${c.program}` : ''}
      </small>
      {c.via && <small>{tr('με το Σετ {0}', c.via)}</small>}
      {c.by && <small className="wrap">{trData(c.by)}</small>}
      <span className="trace-flow-result">
        <i className={`trace-tone ${c.tone}`}>{tr(c.label)}</i>
        {c.loadId && (
          <button type="button" className="trace-link" onClick={() => onLoad(c.loadId!)}>
            {tr('Φορτίο')}
          </button>
        )}
      </span>
    </div>
  );
}

function MoveStep({move: m, undone, onPatient}: {move: Movement; undone: boolean; onPatient: (code: string) => void}) {
  const stage = stageOf(m);
  const back = stage === 'receive' || stage === 'patient';
  const place = back ? m.from : m.to;
  return (
    <div className={`trace-flow-event${undone ? ' undone' : ''}`} title={movementText(m.status)}>
      <span className="trace-when">{m.at}</span>
      {stage && MIXED.has(stage) && <small className="trace-flow-action">{movementText(m.status)}</small>}
      {m.patientCode && (
        <button type="button" className="trace-link" onClick={() => onPatient(m.patientCode!)}>
          {m.patientCode}
        </button>
      )}
      {place &&
        (stage === 'patient' ? (
          <small>{trData(place)}</small>
        ) : (
          <b>
            {back ? '←' : '→'} {trData(place)}
          </b>
        ))}
      <small className="wrap">{trData(m.by)}</small>
      {undone && <span className="undone-badge">{tr('Αναιρέθηκε')}</span>}
    </div>
  );
}
