import {useState} from 'react';
import {Search, TriangleAlert} from 'lucide-react';
import InfoList from './InfoList';
import {foldCycleNumber, normalizeCycleNumber, shortCycleNumber} from '../../core/cycleNumber';
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

const digitsOf = (value: string) => value.replace(/\D/g, '');

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
  const [cycle, setCycle] = useState(load ? shortCycleNumber(load.cycleNumber) : '');
  const [missing, setMissing] = useState('');
  const recent = [...loads].sort((a, b) => time(b.completedAt || b.createdAt) - time(a.completedAt || a.createdAt));

  // A cycle number comes back every day (A1, A2…): one load opens; more, and the day is chosen from them.
  const [matches, setMatches] = useState<ProcessLoadRecord[]>([]);
  const find = () => {
    const number = normalizeCycleNumber(cycle.replace(/^\s*#/, ''));
    if (!number) return;
    const hits = loads
      // The number only (the sterilizer gives the letter); a full number (Α4, a device's 2026-0932) also matches.
      .filter(
        l =>
          l.equipment === sterilizer &&
          (shortCycleNumber(l.cycleNumber) === number ||
            foldCycleNumber(l.cycleNumber) === foldCycleNumber(number) ||
            // A device's number with letters (P-2026-0214), typed with its digits only.
            digitsOf(l.cycleNumber) === digitsOf(number)),
      )
      .sort((a, b) => time(b.completedAt || b.createdAt) - time(a.completedAt || a.createdAt));
    setMissing(hits.length ? '' : tr('Δεν βρέθηκε κύκλος {0} στο {1}.', number, sterilizer));
    setMatches(hits.length > 1 ? hits : []);
    if (hits.length === 1) onOpen(hits[0].id);
  };

  return (
    // The search and the loads on the left, the one open on the right, as for the Sets and instruments.
    <div className="trace-split">
      <aside className="trace-split-list trace-load-list" aria-label={tr('Φορτία')}>
        {/* The same bar as above every other list: the sterilizer, the cycle's number, «Αναζήτηση». */}
        <form
          className="asset-filter-bar trace-load-search"
          onSubmit={e => {
            e.preventDefault();
            find();
          }}
        >
          <select
            className="trace-load-sterilizer"
            value={sterilizer}
            onChange={e => setSterilizer(e.target.value)}
            aria-label={tr('Κλίβανος')}
          >
            {sterilizers.map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <div className="asset-filter-search">
            <Search size={17} />
            <input
              value={cycle}
              inputMode="numeric"
              placeholder={tr('Αριθμός κύκλου')}
              aria-label={tr('Κύκλος')}
              // The number only: the sterilizer chosen gives the letter.
              onChange={e => setCycle(e.target.value.replace(/[^\d\-/]/g, ''))}
            />
          </div>
          <button className="asset-filter-toggle" type="submit">
            {tr('Αναζήτηση')}
          </button>
        </form>
        {missing && <p className="trace-hint">{missing}</p>}
        {matches.length > 1 ? (
          <section className="trace-recent-list trace-loads" aria-label={tr('Φορτία με αυτόν τον κύκλο')}>
            <h3 className="trace-section-title">
              {tr(
                'Ο κύκλος {0} του {1} υπάρχει σε {2} ημέρες: διαλέξτε ποιον.',
                shortCycleNumber(matches[0].cycleNumber),
                sterilizer,
                matches.length,
              )}
            </h3>
            <ul>
              {matches.map(l => (
                <li key={l.id}>
                  <button
                    type="button"
                    className={l.id === loadId ? 'selected' : undefined}
                    aria-current={l.id === loadId ? 'true' : undefined}
                    onClick={() => onOpen(l.id)}
                  >
                    <b>
                      {l.equipment} · #{shortCycleNumber(l.cycleNumber)}
                    </b>
                    <i className={`trace-tone ${LOAD_STATUS[l.status].tone}`}>{tr(LOAD_STATUS[l.status].label)}</i>
                    <span>
                      {l.completedAt || l.createdAt} ·{' '}
                      {l.items.length === 1 ? tr('1 αντικείμενο') : tr('{0} αντικείμενα', l.items.length)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          recent.length > 0 && (
            <section className="trace-recent-list trace-loads" aria-label={tr('Πρόσφατα φορτία')}>
              <h3 className="trace-section-title">{tr('Πρόσφατα φορτία')}</h3>
              <ul>
                {recent.slice(0, 30).map(l => (
                  <li key={l.id}>
                    <button
                      type="button"
                      className={l.id === loadId ? 'selected' : undefined}
                      aria-current={l.id === loadId ? 'true' : undefined}
                      onClick={() => onOpen(l.id)}
                    >
                      <b>
                        {l.equipment} · #{shortCycleNumber(l.cycleNumber)}
                      </b>
                      <i className={`trace-tone ${LOAD_STATUS[l.status].tone}`}>{tr(LOAD_STATUS[l.status].label)}</i>
                      <span>
                        {l.completedAt || l.createdAt} ·{' '}
                        {l.items.length === 1 ? tr('1 αντικείμενο') : tr('{0} αντικείμενα', l.items.length)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )
        )}
      </aside>
      <section className="trace-split-card" aria-label={tr('Φορτίο')}>
        {load ? (
          <LoadView
            // The card's own state is the load's: a new one starts afresh; the list and its search stay.
            key={load.id}
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
          <p className="trace-split-empty">{tr('Διαλέξτε ένα φορτίο από τη λίστα, ή γράψτε τον αριθμό του κύκλου.')}</p>
        )}
      </section>
    </div>
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
      <div className="trace-item-head">
        <div>
          <small>{tr('ΦΟΡΤΙΟ')}</small>
          <h2>
            {load.equipment} · {tr('κύκλος {0}', `#${shortCycleNumber(load.cycleNumber)}`)}
          </h2>
        </div>
        {canRecall && (
          <button type="button" className="trace-recall" onClick={() => void recall()}>
            <TriangleAlert size={15} aria-hidden="true" /> {tr('Ανάκληση φορτίου')}
          </button>
        )}
      </div>
      <InfoList
        label={tr('Φορτίο')}
        rows={[
          {label: tr('Κατάσταση'), value: <i className={`trace-tone ${status.tone}`}>{tr(status.label)}</i>},
          ...(load.status === 'RECALLED'
            ? [
                {
                  label: tr('Ανάκληση'),
                  value: `${tr('Ανακλήθηκε στις {0}', load.recalledAt || '')}${load.recallReason ? ` · ${load.recallReason}` : ''}`,
                },
              ]
            : []),
          {
            label: tr('Κύκλος'),
            value: [
              load.completedAt
                ? `${load.createdAt} – ${load.completedAt.split(' ')[1] || load.completedAt}`
                : load.createdAt,
              load.program,
              trData(load.createdByName),
            ]
              .filter(Boolean)
              .join(' · '),
          },
          ...indicators.map(i => ({
            label: tr(i.label),
            value: <i className={`trace-tone ${i.value!.tone}`}>{tr(i.value!.label)}</i>,
          })),
          {
            label: tr('Τι ήταν στο φορτίο'),
            value: load.items.length === 1 ? tr('1 αντικείμενο') : tr('{0} αντικείμενα', load.items.length),
          },
        ]}
      />
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
