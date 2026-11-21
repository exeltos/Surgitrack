import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useUndoneMovements} from '../../components/assets/useUndoneMovements';
import {tr} from '../../i18n';
import {useSurgi} from '../../store/SurgiStore';
import type {SetAsset, Tool} from '../../types/domain';
import TraceFlow from './TraceFlow';
import {roundsBetween, traceOf, type Round} from './traceModel';

type Props = {
  rounds: Round[];
  onPatient: (code: string) => void;
  onLoad: (loadId: string) => void;
  /** The heading over it; none when the page already says it. */
  title?: string;
};

/** «Ιστορικό»: an item's rounds as a flow, cut to the days asked for (from, to). */
export default function ItemHistory({rounds, onPatient, onLoad, title = tr('Ιστορικό')}: Props) {
  const undone = useUndoneMovements();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const shown = roundsBetween(rounds, from, to);
  const cut = !!(from || to);
  return (
    <section className="trace-history-block" aria-label={title}>
      <div className="trace-history-head">
        <h3 className="trace-section-title">
          {title}
          <small>{cut ? tr('{0} από {1} γύρους', shown.length, rounds.length) : tr('{0} γύροι', rounds.length)}</small>
        </h3>
        <div className="trace-dates">
          <label>
            <span>{tr('Από')}</span>
            <input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} />
          </label>
          <label>
            <span>{tr('Έως')}</span>
            <input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} />
          </label>
          {cut && (
            <button
              type="button"
              className="trace-link"
              onClick={() => {
                setFrom('');
                setTo('');
              }}
            >
              {tr('Όλες οι ημερομηνίες')}
            </button>
          )}
        </div>
      </div>
      {rounds.length === 0 ? (
        <p className="trace-hint">{tr('Δεν βρέθηκαν κινήσεις')}</p>
      ) : shown.length === 0 ? (
        <p className="trace-hint">{tr('Καμία κίνηση σε αυτές τις ημερομηνίες')}</p>
      ) : (
        <TraceFlow rounds={shown} undone={undone} onPatient={onPatient} onLoad={onLoad} />
      )}
    </section>
  );
}

/** The same «Ιστορικό» on a Set's or an instrument's own page: a patient or a load opens in Ιχνηλάτηση. */
export function AssetItemHistory({item}: {item: SetAsset | Tool}) {
  const {sets, movements, processLoads, sterilizationCycles} = useSurgi();
  const navigate = useNavigate();
  const {rounds} = traceOf(item, sets, movements, processLoads, sterilizationCycles);
  return (
    <ItemHistory
      rounds={rounds}
      title={tr('Ιστορικό κινήσεων')}
      onPatient={code => navigate(`/traceability?tab=patients&patient=${encodeURIComponent(code)}`)}
      onLoad={id => navigate(`/traceability?tab=load&load=${encodeURIComponent(id)}`)}
    />
  );
}
