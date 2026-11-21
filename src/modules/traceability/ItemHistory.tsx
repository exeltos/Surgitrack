import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useUndoneMovements} from '../../components/assets/useUndoneMovements';
import QuickFilters from '../../components/ui/QuickFilters';
import {tr} from '../../i18n';
import {useSurgi} from '../../store/SurgiStore';
import type {SetAsset, Tool} from '../../types/domain';
import TraceFlow from './TraceFlow';
import {roundsBetween, traceOf, type Round} from './traceModel';

type Props = {
  rounds: Round[];
  onPatient?: (code: string) => void;
  onLoad?: (loadId: string) => void;
  /** The heading over it; none when the page already says it. */
  title?: string;
};

/** What the history shows: the round under way, every round, or the rounds on the days asked for. */
type View = 'CURRENT' | 'ALL' | 'DATES';

/** «Ιστορικό»: an item's rounds as a flow — the current one first, every one, or those of some days (from, to). */
export default function ItemHistory({rounds, onPatient, onLoad, title = tr('Ιστορικό')}: Props) {
  const undone = useUndoneMovements();
  const [view, setView] = useState<View>('CURRENT');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const inDates = roundsBetween(rounds, from, to);
  const shown = view === 'CURRENT' ? rounds.slice(0, 1) : view === 'ALL' ? rounds : inDates;
  return (
    <section className="trace-history-block" aria-label={title}>
      <div className="trace-history-head">
        <h3 className="trace-section-title">{title}</h3>
        <QuickFilters
          label={tr('Προβολή ιστορικού')}
          items={[
            {
              key: 'current',
              label: tr('Τρέχων γύρος'),
              count: Math.min(1, rounds.length),
              active: view === 'CURRENT',
              onClick: () => setView('CURRENT'),
            },
            {
              key: 'all',
              label: tr('Όλοι οι γύροι'),
              count: rounds.length,
              active: view === 'ALL',
              onClick: () => setView('ALL'),
            },
            {
              key: 'dates',
              label: tr('Ημερομηνίες'),
              count: inDates.length,
              active: view === 'DATES',
              onClick: () => setView('DATES'),
            },
          ]}
        />
        {view === 'DATES' && (
          <div className="trace-dates">
            <label>
              <span>{tr('Από')}</span>
              <input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} />
            </label>
            <label>
              <span>{tr('Έως')}</span>
              <input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} />
            </label>
            {(from || to) && (
              <button
                type="button"
                className="trace-link"
                onClick={() => {
                  setFrom('');
                  setTo('');
                }}
              >
                {tr('Καθαρισμός')}
              </button>
            )}
          </div>
        )}
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
  const {sets, movements, processLoads, sterilizationCycles, can} = useSurgi();
  // A patient or a load opens in Ιχνηλάτηση: only for those who may see it (not a department).
  const trace = can('traceability.view');
  const navigate = useNavigate();
  const {rounds} = traceOf(item, sets, movements, processLoads, sterilizationCycles);
  return (
    <ItemHistory
      rounds={rounds}
      title={tr('Ιστορικό κινήσεων')}
      onPatient={trace ? code => navigate(`/traceability?tab=patients&patient=${encodeURIComponent(code)}`) : undefined}
      onLoad={trace ? id => navigate(`/traceability?tab=load&load=${encodeURIComponent(id)}`) : undefined}
    />
  );
}
