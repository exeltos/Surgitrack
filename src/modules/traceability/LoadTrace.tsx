import {useState} from 'react';
import {Flame, Search, TriangleAlert} from 'lucide-react';
import {askConfirm} from '../../components/ui/confirmService';
import {useUndoneMovements} from '../../components/assets/useUndoneMovements';
import {statusLabel} from '../../components/ui/statusLabel';
import {tr, trData} from '../../i18n';
import {useSurgi} from '../../store/SurgiStore';
import type {BiologicalIndicatorResult, ProcessLoadRecord, SterilizationIndicatorResult} from '../../types/domain';
import {LOAD_STATUS, firstUseAfter, time, type Tone} from './traceModel';

const indicator = (value: SterilizationIndicatorResult | undefined): {label: string; tone: Tone} | undefined =>
  value === 'PASS' ? {label: 'Εντάξει', tone: 'ok'} : value === 'FAIL' ? {label: 'Αποτυχία', tone: 'bad'} : undefined;
const biological = (value: BiologicalIndicatorResult | undefined): {label: string; tone: Tone} | undefined =>
  value === 'PASS'
    ? {label: 'Εντάξει', tone: 'ok'}
    : value === 'FAIL'
      ? {label: 'Αποτυχία', tone: 'bad'}
      : value === 'PENDING'
        ? {label: 'Αναμένεται', tone: 'wait'}
        : undefined;
const physical = (value: boolean | undefined): {label: string; tone: Tone} | undefined =>
  value === undefined ? undefined : value ? {label: 'Εντάξει', tone: 'ok'} : {label: 'Αποτυχία', tone: 'bad'};

/**
 * One sterilizer load, by sterilizer and cycle number: how its indicators came out, what was in it, where each item
 * is now and which were already used on a patient. A released load can be recalled from here.
 */
export default function LoadTrace({
  loadId,
  onOpen,
  onItem,
  onPatient,
}: {
  loadId: string;
  onOpen: (loadId: string) => void;
  onItem: (barcode: string) => void;
  onPatient: (code: string) => void;
}) {
  const {processLoads, sets, tools, movements, can, recallProcessLoad} = useSurgi();
  const loads = processLoads.filter(l => l.kind === 'STERILIZATION');
  // A use undone later (a wrong patient code) did not happen.
  const undone = useUndoneMovements();
  const uses = movements.filter(m => m.patientCode && !m.undoes && !undone.has(m.id));
  const sterilizers = [...new Set(loads.map(l => l.equipment))].sort();
  const load = loads.find(l => l.id === loadId);
  const [sterilizer, setSterilizer] = useState(load?.equipment || sterilizers[0] || '');
  const [cycle, setCycle] = useState(load?.cycleNumber || '');
  const [missing, setMissing] = useState('');
  const recent = [...loads].sort((a, b) => time(b.completedAt || b.createdAt) - time(a.completedAt || a.createdAt));

  const find = () => {
    const number = cycle.trim().replace(/^#/, '');
    if (!number) return;
    const hit = loads.find(l => l.equipment === sterilizer && l.cycleNumber.trim() === number);
    if (hit) {
      setMissing('');
      onOpen(hit.id);
    } else setMissing(tr('Δεν βρέθηκε κύκλος {0} στο {1}.', number, sterilizer));
  };

  return (
    <>
      <form
        className="trace-load-search"
        onSubmit={e => {
          e.preventDefault();
          find();
        }}
      >
        <label>
          {tr('Κλίβανος')}
          <select value={sterilizer} onChange={e => setSterilizer(e.target.value)}>
            {sterilizers.map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          {tr('Κύκλος')}
          <input value={cycle} inputMode="numeric" onChange={e => setCycle(e.target.value)} />
        </label>
        <button className="primary" type="submit">
          <Search size={16} /> {tr('Αναζήτηση')}
        </button>
      </form>
      {missing && <p className="trace-hint">{missing}</p>}
      {load ? (
        <LoadView
          load={load}
          sets={sets}
          tools={tools}
          movements={uses}
          loads={loads}
          canRecall={can('sterilization.workspace') && load.status === 'RELEASED'}
          onRecall={reason => recallProcessLoad(load.id, reason)}
          onItem={onItem}
          onPatient={onPatient}
        />
      ) : (
        recent.length > 0 && (
          <section className="trace-recently" aria-label={tr('Πρόσφατα φορτία')}>
            <h3>{tr('Πρόσφατα φορτία')}</h3>
            <div className="trace-recently-grid">
              {recent.slice(0, 8).map(l => (
                <button key={l.id} type="button" className="trace-recently-card" onClick={() => onOpen(l.id)}>
                  <Flame size={18} aria-hidden="true" />
                  <span>
                    <strong>
                      {l.equipment} · #{l.cycleNumber}
                    </strong>
                    <small>
                      {l.completedAt || l.createdAt} · {tr('{0} αντικείμενα', l.items.length)}
                    </small>
                    <small>
                      <i className={`trace-tone ${LOAD_STATUS[l.status].tone}`}>{tr(LOAD_STATUS[l.status].label)}</i>
                    </small>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )
      )}
    </>
  );
}

function LoadView({
  load,
  sets,
  tools,
  movements,
  loads,
  canRecall,
  onRecall,
  onItem,
  onPatient,
}: {
  load: ProcessLoadRecord;
  sets: ReturnType<typeof useSurgi>['sets'];
  tools: ReturnType<typeof useSurgi>['tools'];
  movements: ReturnType<typeof useSurgi>['movements'];
  loads: ProcessLoadRecord[];
  canRecall: boolean;
  onRecall: (reason: string) => void;
  onItem: (barcode: string) => void;
  onPatient: (code: string) => void;
}) {
  const status = LOAD_STATUS[load.status];
  const indicators = [
    {label: 'Φυσικές παράμετροι', value: physical(load.physicalParametersOk)},
    {label: 'Χημικός δείκτης', value: indicator(load.chemicalIndicatorResult)},
    {label: 'Βιολογικός δείκτης', value: biological(load.biologicalIndicatorResult)},
  ].filter(i => i.value);
  // Each item: where it is now, and the first patient it was used on after this cycle, before its next one.
  const rows = load.items.map(item => {
    const asset =
      item.assetKind === 'SET' ? sets.find(s => s.id === item.assetId) : tools.find(t => t.id === item.assetId);
    const used = firstUseAfter(load, item, loads, movements);
    return {item, asset, used};
  });
  const usedCount = rows.filter(r => r.used).length;
  const recall = async () => {
    const reason = await askConfirm({
      title: tr('Ανάκληση φορτίου'),
      message: tr('Όλα τα Σετ και εργαλεία του φορτίου ανακαλούνται για επανεπεξεργασία.'),
      note: {
        label: tr('Αιτιολογία ανάκλησης φορτίου:'),
        initial: tr('Μη αποδεκτό αποτέλεσμα δείκτη / απόκλιση μετά την αποδέσμευση'),
        required: true,
      },
      confirmLabel: tr('Ανάκληση φορτίου'),
      danger: true,
    });
    if (reason) onRecall(reason);
  };

  return (
    <>
      <section className="trace-summary" aria-label={tr('Φορτίο')}>
        <div className="trace-summary-head">
          <div className="trace-summary-title">
            <small>{tr('ΦΟΡΤΙΟ')}</small>
            <h2>
              {load.equipment} · {tr('κύκλος {0}', `#${load.cycleNumber}`)}
            </h2>
            <span>
              {[
                load.completedAt
                  ? `${load.createdAt} – ${load.completedAt.split(' ')[1] || load.completedAt}`
                  : load.createdAt,
                load.program,
                trData(load.createdByName),
                tr('{0} αντικείμενα', load.items.length),
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </div>
          <div className="trace-now">
            <i className={`trace-tone ${status.tone}`}>{tr(status.label)}</i>
            {canRecall && (
              <button type="button" className="trace-recall" onClick={() => void recall()}>
                <TriangleAlert size={17} aria-hidden="true" /> {tr('Ανάκληση φορτίου')}
              </button>
            )}
          </div>
        </div>
        {load.status === 'RECALLED' && (
          <p className="trace-verdict bad">
            {tr('Ανακλήθηκε στις {0}', load.recalledAt || '')}
            {load.recallReason ? ` · ${load.recallReason}` : ''}
          </p>
        )}
        {indicators.length > 0 && (
          <dl className="trace-facts">
            {indicators.map(i => (
              <div key={i.label}>
                <dt>{tr(i.label)}</dt>
                <dd>
                  <i className={`trace-tone ${i.value!.tone}`}>{tr(i.value!.label)}</i>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>
      <section className="trace-load-items">
        <div className="trace-load-items-head">
          <h3>{tr('Τι ήταν στο φορτίο')}</h3>
          {usedCount > 0 && <span className="trace-used">{tr('Χρησιμοποιήθηκαν ήδη σε ασθενή: {0}', usedCount)}</span>}
        </div>
        <div className="trace-table-wrap" role="region" tabIndex={0} aria-label={tr('Τι ήταν στο φορτίο')}>
          <table className="trace-table">
            <thead>
              <tr>
                <th>{tr('Σετ / Εργαλείο')}</th>
                <th>{tr('Πού είναι τώρα')}</th>
                <th>{tr('Ασθενής')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({item, asset, used}) => (
                <tr key={`${item.assetKind}:${item.assetId}`}>
                  <td>
                    <button type="button" className="trace-link mono" onClick={() => onItem(item.barcode)}>
                      {item.barcode}
                    </button>
                    <small>{item.assetName}</small>
                  </td>
                  <td>
                    <b>{asset ? trData(asset.department) || tr('Απόθεμα') : '—'}</b>
                    {asset && <small>{statusLabel(asset.state)}</small>}
                  </td>
                  <td>
                    {used ? (
                      <>
                        <button
                          type="button"
                          className="trace-link trace-used"
                          onClick={() => onPatient(used.patientCode!)}
                        >
                          {used.patientCode}
                        </button>
                        <small>{used.at}</small>
                      </>
                    ) : (
                      <small>—</small>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
