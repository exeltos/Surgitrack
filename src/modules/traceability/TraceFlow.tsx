import {shortCycleNumber} from '../../core/cycleNumber';
import {movementKindOf, movementText, type MovementKind} from '../../core/movementText';
import {tr, trData} from '../../i18n';
import type {Movement} from '../../types/domain';
import {time, type CycleEntry, type Round} from './traceModel';

type Props = {
  rounds: Round[];
  undone: Set<string>;
  /** Open a patient, a load; without them (no access to Ιχνηλάτηση) the code is plain text and there is no link. */
  onPatient?: (code: string) => void;
  onLoad?: (loadId: string) => void;
};

/** The stages of one round, in the order an item goes through them. */
const STAGES: Array<{key: string; label: string; kinds: MovementKind[]}> = [
  {key: 'send', label: 'Αποστολή', kinds: ['SEND']},
  {key: 'receive', label: 'Παραλαβή', kinds: ['RECEIVE']},
  {key: 'wash', label: 'Καθαρισμός', kinds: ['WASH']},
  {key: 'prep', label: 'Σύνθεση', kinds: ['PREP']},
  {key: 'cycle', label: 'Κλίβανος', kinds: ['CYCLE']},
  {key: 'release', label: 'Αποδέσμευση', kinds: ['RELEASE']},
  {key: 'delivery', label: 'Παράδοση', kinds: ['DELIVERY']},
  {key: 'patient', label: 'Ασθενής', kinds: []},
];

/**
 * The stage of a move, by what it did: a send back with a patient code (or a count signed at the operation) is the use
 * on that patient, a send without one only the send; a recall carries the item's patient code too, but stays a recall.
 */
const stageOf = (m: Movement) => {
  const kind = movementKindOf(m.status);
  if ((kind === 'SEND' || kind === 'OTHER') && m.patientCode) return 'patient';
  return STAGES.find(s => s.kinds.includes(kind))?.key;
};

/**
 * How a stage's routine moves begin: such a move only adds what follows its name («Παραλαβή στην Αποστείρωση ·
 * υπογραφή» → «υπογραφή»). Any other move in the stage (a replacement, a recall, a receipt with a deviation) is said in
 * full, so nothing it records is lost.
 */
const ROUTINE: Record<string, string[]> = {
  send: ['αποστολη'],
  receive: ['παραλαβη', 'φυσικη παραλαβη'],
  wash: ['καθαρισμ', 'φορτιο πλυντηριου'],
  prep: ['συνθεση', 'ολοκληρωση ελεγχου'],
  cycle: ['φορτιο', 'φορτωση'],
  release: ['αποδεσμευ'],
  delivery: ['παραδοση'],
  patient: ['αποστολη'],
};
const isRoutine = (stage: string | undefined, status: string) =>
  !!stage && (ROUTINE[stage] || []).some(start => plain(status.trim()).startsWith(start));

const plain = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** A problem written in a move's text (a failure, a deviation on receipt, a damage, a missing piece): shown as one. */
const PROBLEM = /αποτυχ|αποκλισ|ελλειψ|βλαβ|fail|deviat|missing|damage/;
/** «Χωρίς εμφανή απόκλιση», «no deviation»: said to be fine, not a problem. */
const DENIED = /χωρις [^·]*(αποκλισ|ελλειψ|βλαβ)|no [^·]*(deviat|damage)/;
const FAILED = {test: (status: string) => PROBLEM.test(plain(status)) && !DENIED.test(plain(status))};

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
        // The load's own moves (into the sterilizer, its result) are the cycle shown once in «Κλίβανος».
        const loadText = round.cycle?.loadId && `Φορτίο ${round.cycle.loadId} `;
        // Who loaded it and who recorded its result (they can differ): every one of them, once, on the cycle.
        const loadPeople = [
          ...new Set(
            [
              round.cycle?.by,
              ...round.moves.filter(m => loadText && m.status.startsWith(loadText)).map(m => m.by),
            ].filter((name): name is string => !!name),
          ),
        ];
        [...round.moves]
          .filter(m => !loadText || !m.status.startsWith(loadText))
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
                // The load's release fills the release, when no move recorded it.
                const released =
                  stage.key === 'release' &&
                  !moves.length &&
                  (round.cycle?.releasedAt || round.cycle?.status === 'AWAITING_RELEASE')
                    ? round.cycle
                    : undefined;
                const empty = !moves.length && !cycle && !released;
                return (
                  <li key={stage.key} className={`trace-flow-step ${stage.key}${empty ? ' is-empty' : ''}`}>
                    <strong>{tr(stage.label)}</strong>
                    {empty && <span className="trace-flow-none">—</span>}
                    {cycle && <CycleStep cycle={cycle} people={loadPeople} onLoad={onLoad} />}
                    {released && (
                      <div className="trace-flow-event">
                        {released.releasedAt ? (
                          <span className="trace-when">{released.releasedAt}</span>
                        ) : (
                          <span className="trace-flow-result">
                            <i className="trace-tone wait">{tr('Αναμονή αποδέσμευσης')}</i>
                          </span>
                        )}
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
                    {m.undoes && m.note ? ` · ${tr('Αιτιολογία')}: ${m.note}` : ''}
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

/** A load past its cycle: the cycle went well; its release is said in «Αποδέσμευση». */
const CYCLE_OK = new Set(['PASSED', 'AWAITING_RELEASE', 'RELEASED']);

function CycleStep({
  cycle: c,
  people,
  onLoad,
}: {
  cycle: CycleEntry;
  people: string[];
  onLoad?: (loadId: string) => void;
}) {
  const ok = !!c.status && CYCLE_OK.has(c.status);
  const startDay = c.start && c.start !== c.at ? day(c.start) : undefined;
  return (
    <div className="trace-flow-event">
      <span className="trace-when">
        {startDay
          ? startDay === day(c.at)
            ? `${c.start} – ${c.at.split(' ')[1] || ''}`
            : `${c.start} – ${c.at}`
          : c.at}
      </span>
      <b>{c.sterilizer}</b>
      <small>
        {tr('κύκλος {0}', shortCycleNumber(c.cycleNumber))}
        {c.program ? ` · ${c.program}` : ''}
      </small>
      {c.via && <small>{tr('με το Σετ {0}', c.via)}</small>}
      {people.length > 0 && <small>{people.map(name => trData(name)).join(' · ')}</small>}
      <span className="trace-flow-result">
        <i className={`trace-tone ${ok ? 'ok' : c.tone}`}>{ok ? tr('Επιτυχία') : tr(c.label)}</i>
        {c.loadId && onLoad && (
          <button type="button" className="trace-link" onClick={() => onLoad(c.loadId!)}>
            {tr('Φορτίο')}
          </button>
        )}
      </span>
    </div>
  );
}

/** Two names the same, ignoring case and accents. */
const sameName = (a?: string, b?: string) => !!a && !!b && plain(a.trim()) === plain(b.trim());

/**
 * Who did what in a move, said with words: who sent it, who handed it over, who took it. The names come from the
 * move's text («… · παρέδωσε Χ · παρέλαβε Υ») and from who recorded it («Υ · παρέδωσε Χ» on a receipt); what is
 * left of the text (a deviation, «αναμονή φυσικής παραλαβής») is said once, without the names again.
 */
const peopleOf = (m: Movement, stage?: string) => {
  const [recorder, ...byRest] = (m.by || '').split(' · ');
  // The stored text, untranslated: the roles are read from its Greek words, and only what is shown is translated.
  const segments = m.status.split(' · ');
  const name = (prefix: RegExp) =>
    [...segments, ...byRest].map(seg => seg.match(prefix)?.[1]).find((found): found is string => !!found);
  const handedBy = name(/^παρέδωσε\s+(.+)$/i);
  const receivedBy = name(/^παρέλαβε\s+(.+)$/i);
  // A sender written in the text with their account («Αβράμπου Κ. (u-12)») is the recorder again.
  const strip = (seg: string) => seg.replace(/\s*\([^)]*\)\s*$/, '');
  const rest = segments
    .slice(1)
    .filter(
      seg =>
        !/^παρ(έδωσε|έλαβε)\s/i.test(seg) &&
        !sameName(strip(seg), recorder) &&
        !sameName(strip(seg), handedBy) &&
        !sameName(strip(seg), receivedBy),
    );
  const roles: Array<[string, string]> =
    stage === 'send'
      ? [[tr('Έστειλε'), recorder]]
      : stage === 'receive'
        ? [...(handedBy ? ([[tr('Παρέδωσε'), handedBy]] as Array<[string, string]>) : []), [tr('Παρέλαβε'), recorder]]
        : stage === 'delivery'
          ? [
              [tr('Παρέδωσε'), handedBy || recorder],
              ...(receivedBy ? ([[tr('Παρέλαβε'), receivedBy]] as Array<[string, string]>) : []),
            ]
          : [['', recorder]];
  return {
    action: movementText(segments[0]),
    rest: rest.map(movementText).join(' · '),
    roles: roles.filter(([, who]) => !!who),
  };
};

function MoveStep({move: m, undone, onPatient}: {move: Movement; undone: boolean; onPatient?: (code: string) => void}) {
  const stage = stageOf(m);
  const {action, rest, roles} = peopleOf(m, stage);
  // Only a department is a place worth saying (where it came from, where it went): the steps inside Sterilization
  // (→ Σύνθεση, → Φόρτωση) are the stages themselves.
  const from = stage === 'send' || stage === 'receive' ? m.from : undefined;
  const to = stage === 'delivery' ? m.to : undefined;
  const elsewhere = !stage && (m.from || m.to);
  const routine = !m.undoes && isRoutine(stage, m.status);
  const failed = FAILED.test(m.status);
  return (
    <div className={`trace-flow-event${undone ? ' undone' : ''}`} title={movementText(m.status)}>
      <span className="trace-when">{m.at}</span>
      {/* What was done: a routine move only what it adds to its stage's name; any other in full, once. */}
      {!routine && (
        <small className={`trace-flow-action${failed || m.undoes ? ' failed' : ''}`}>
          {[action, rest].filter(Boolean).join(' · ')}
        </small>
      )}
      {routine && rest && <small className={`trace-flow-action${failed ? ' failed' : ''}`}>{rest}</small>}
      {m.undoes && m.note && (
        <small>
          {tr('Αιτιολογία')}: {m.note}
        </small>
      )}
      {m.patientCode &&
        (onPatient ? (
          <button type="button" className="trace-link" onClick={() => onPatient(m.patientCode!)}>
            {m.patientCode}
          </button>
        ) : (
          <b>{m.patientCode}</b>
        ))}
      {stage === 'patient' && m.from && <small>{trData(m.from)}</small>}
      {from && (
        <span className="trace-flow-role">
          <i>{tr('Από')}</i> <b>{trData(from)}</b>
        </span>
      )}
      {to && (
        <span className="trace-flow-role">
          <i>{tr('Προς')}</i> <b>{trData(to)}</b>
        </span>
      )}
      {elsewhere && (
        <span className="trace-flow-role">
          <b>
            {trData(m.from) || '—'} → {trData(m.to) || '—'}
          </b>
        </span>
      )}
      {roles.map(([role, who]) =>
        role ? (
          <span key={role} className="trace-flow-role">
            <i>{role}</i> {trData(who)}
          </span>
        ) : (
          <small key="by">{trData(who)}</small>
        ),
      )}
      {undone && <span className="undone-badge">{tr('Αναιρέθηκε')}</span>}
    </div>
  );
}
