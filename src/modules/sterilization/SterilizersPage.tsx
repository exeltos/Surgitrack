import {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import {Flame, FlaskConical, Hourglass, Maximize2, Minimize2, Power} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import AppButton from '../../components/ui/AppButton';
import {useSurgi} from '../../store/SurgiStore';
import {useLibraries} from '../../core/LibraryStore';
import {
  MIN_HOLD_PRESSURE,
  currentSample,
  elapsedMinutes,
  endMinute,
  isFinished,
  planFor,
} from '../../core/cycleSimulator';
import type {ProcessLoadRecord} from '../../types/domain';
import {tr, trData} from '../../i18n';
import CycleChart from './parts/CycleChart';
import {phaseText} from './parts/cycleLabels';
import {useNow} from './parts/simulationClock';

const SHOWN_ITEMS = 6;

/** A sterilizer that is running: its readings and curve live for a simulated cycle, else what is known of the load. */
function RunningCard({name, load, now}: {name: string; load: ProcessLoadRecord; now: number}) {
  const run = load.simulation;
  const plan = planFor(load.program);
  const sample = run ? currentSample(run, plan, now) : undefined;
  const end = run ? endMinute(plan, run.scenario) : 0;
  const minute = run ? Math.min(elapsedMinutes(run, now), end) : 0;
  const done = !!run && isFinished(run, plan, now);
  const progress = run ? Math.round((minute / end) * 100) : 0;
  const hidden = Math.max(load.items.length - SHOWN_ITEMS, 0);
  return (
    <article className={`sterilizer-wall-card busy${done ? ' done' : ''}`}>
      <header>
        {done ? <Hourglass size={20} aria-hidden="true" /> : <Flame size={20} aria-hidden="true" />}
        <h2>{trData(name)}</h2>
        {run && (
          <span className="wall-sim">
            <FlaskConical size={12} /> {tr('Προσομοίωση')}
          </span>
        )}
        <span className="wall-phase">{sample ? phaseText(sample.phase) : tr('Κύκλος σε εξέλιξη')}</span>
      </header>
      {sample ? (
        <>
          <div className="wall-readings">
            <div>
              <small>{tr('Θερμοκρασία')}</small>
              <b>{sample.temperature.toFixed(1)} °C</b>
            </div>
            <div>
              <small>{tr('Πίεση')}</small>
              <b className={sample.phase === 'HOLDING' && sample.pressure < MIN_HOLD_PRESSURE ? 'bad' : ''}>
                {sample.pressure.toFixed(2)} bar
              </b>
            </div>
            <div>
              <small>{tr('Απομένουν')}</small>
              <b>{done ? '—' : `${Math.max(Math.ceil(end - minute), 0)}′`}</b>
            </div>
          </div>
          <div
            className="tile-progress"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={tr('Πρόοδος κύκλου')}
          >
            <i style={{width: `${progress}%`}} />
          </div>
          <CycleChart load={load} now={now} />
        </>
      ) : (
        <p className="wall-nodata">{tr('Χωρίς ζωντανά δεδομένα')}</p>
      )}
      <footer>
        <span>
          {tr('Κύκλος')} <b>{load.cycleNumber}</b> · {load.program}
        </span>
        <span className="wall-items">
          {load.items.slice(0, SHOWN_ITEMS).map(item => (
            <code key={`${item.assetKind}:${item.assetId}`}>{item.barcode}</code>
          ))}
          {hidden > 0 && <em>+{hidden}</em>}
        </span>
        <Link to="/sterilization?queue=IN_STERILIZER">{tr('Άνοιγμα φορτίου')}</Link>
      </footer>
    </article>
  );
}

/** A free sterilizer, with the cycle it last ran. */
function FreeCard({name, last}: {name: string; last?: ProcessLoadRecord}) {
  const result = last?.cycleData
    ? last.cycleData.result === 'PASS'
      ? tr('Τηρήθηκαν')
      : tr('Δεν τηρήθηκαν')
    : last?.status === 'FAILED'
      ? tr('Αποτυχία κύκλου')
      : '';
  return (
    <article className="sterilizer-wall-card free">
      <header>
        <Power size={20} aria-hidden="true" />
        <h2>{trData(name)}</h2>
        <span className="wall-phase">{tr('Ελεύθερος')}</span>
      </header>
      {last ? (
        <p className="wall-last">
          {tr('Τελευταίος κύκλος')} <b>{last.cycleNumber}</b> · {last.completedAt || last.createdAt}
          {result ? ` · ${result}` : ''}
        </p>
      ) : (
        <p className="wall-last">{tr('Δεν έχει τρέξει κύκλο ακόμα')}</p>
      )}
    </article>
  );
}

/**
 * All the hospital's sterilizers on one screen, each with its cycle in progress (live for a simulated one): what
 * the Sterilization staff looks at from across the room. «Πλήρης οθόνη» fills the display with it.
 */
export default function SterilizersPage() {
  const {processLoads} = useSurgi();
  const {sterilizers} = useLibraries();
  const sterilizerLoads = processLoads.filter(load => load.kind === 'STERILIZATION');
  const running = sterilizerLoads.filter(load => load.status === 'OPEN');
  const now = useNow(running.some(load => !!load.simulation));
  const names = sterilizers.map(item => item.el);
  const all = [...new Set([...names, ...running.map(load => load.equipment)])];
  const [full, setFull] = useState(false);
  useEffect(() => {
    const sync = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  };
  const busy = all.filter(name => running.some(load => load.equipment === name)).length;
  return (
    <div className="sterilizers-page">
      <PageHeader
        eyebrow={tr('ΚΕΝΤΡΙΚΗ ΑΠΟΣΤΕΙΡΩΣΗ')}
        title={tr('Κλίβανοι')}
        description={
          busy
            ? tr('{0} σε λειτουργία · {1} ελεύθεροι', busy, all.length - busy)
            : tr('Όλοι οι κλίβανοι είναι ελεύθεροι.')
        }
        actions={
          <AppButton onClick={toggleFull} icon={full ? <Minimize2 size={16} /> : <Maximize2 size={16} />}>
            {full ? tr('Έξοδος από πλήρη οθόνη') : tr('Πλήρης οθόνη')}
          </AppButton>
        }
      />
      {all.length === 0 ? (
        <div className="empty ster-empty">
          <Power size={32} />
          <strong>{tr('Δεν έχουν οριστεί κλίβανοι')}</strong>
          <span>{tr('Προσθέστε τους στις Βιβλιοθήκες (Κλίβανοι).')}</span>
        </div>
      ) : (
        <div className="sterilizer-wall">
          {all.map(name => {
            const load = running.find(item => item.equipment === name);
            if (load) return <RunningCard key={name} name={name} load={load} now={now} />;
            const last = sterilizerLoads.find(item => item.equipment === name);
            return <FreeCard key={name} name={name} last={last} />;
          })}
        </div>
      )}
    </div>
  );
}
