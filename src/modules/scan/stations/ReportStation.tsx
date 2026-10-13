import {useState} from 'react';
import {parseDisplayDate} from '../../../core/displayDate';
import {tr, trData} from '../../../i18n';
import {useSurgi} from '../../../store/SurgiStore';
import {useSterilizationPage} from '../../sterilization/useSterilizationPage';
import {ScanScreen} from '../ScanParts';

type Period = 'TODAY' | 'YESTERDAY' | 'WEEK';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whether a record's date («13/10/2026 08:12») falls in the period, counted in whole local days. */
const inPeriod = (period: Period, value: string | undefined, now = new Date()) => {
  const date = parseDisplayDate(value);
  if (!date) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const time = date.getTime();
  if (period === 'TODAY') return time >= today;
  if (period === 'YESTERDAY') return time >= today - DAY_MS && time < today;
  return time >= today - 6 * DAY_MS;
};

/**
 * The day at Sterilization, on the phone, for the hospital admin and the Sterilization supervisor: what was
 * done (receipts, loads, releases, deliveries), what is in each stage now, what needs attention, and who did
 * what. The full reports stay in the app on a computer.
 */
export default function ReportStation({onStations}: {onStations: () => void}) {
  const {receipts, deliveries, processLoads, issues} = useSurgi();
  const s = useSterilizationPage();
  const [period, setPeriod] = useState<Period>('TODAY');
  const when = (value: string | undefined) => inPeriod(period, value);

  const sterilizerLoads = processLoads.filter(load => load.kind === 'STERILIZATION');
  const periodReceipts = receipts.filter(r => when(r.at));
  const periodDeliveries = deliveries.filter(d => when(d.at));
  const loaded = sterilizerLoads.filter(load => when(load.createdAt));
  // A load recalled after its release was still released then (it keeps its release time).
  const released = sterilizerLoads.filter(
    load => (load.status === 'RELEASED' || load.status === 'RECALLED') && when(load.releasedAt),
  );
  const notReleased = sterilizerLoads.filter(
    load => (load.status === 'REPROCESS' || load.status === 'FAILED') && when(load.completedAt || load.releasedAt),
  );
  const biPending = sterilizerLoads.filter(
    load => load.status === 'RELEASED' && load.biologicalIndicatorResult === 'PENDING',
  );
  const openIssues = issues.filter(issue => issue.status === 'OPEN');
  const deviations = periodReceipts.filter(r => r.visibleDeviation);
  const otherDepartment = periodReceipts.filter(r => r.departmentMismatch);

  const stages = [
    {label: tr('Αναμονή παραλαβής'), count: s.incoming.length},
    {label: tr('Καθαρισμός'), count: s.washing.length},
    {label: tr('Σύνθεση'), count: s.preparation.length},
    {label: tr('Συσκευασία'), count: s.packaging.length},
    {label: tr('Για φόρτωση'), count: s.processing.length},
    {label: tr('Στον κλίβανο'), count: s.inSterilizer.length},
    {label: tr('Αναμονή αποδέσμευσης'), count: s.awaitingRelease.length},
    {label: tr('Αποθήκευση'), count: s.storage.length},
    {label: tr('Έτοιμα για παράδοση'), count: s.ready.length},
  ];
  const most = Math.max(1, ...stages.map(stage => stage.count));

  const people = new Map<string, {receipts: number; loads: number; deliveries: number}>();
  const person = (name: string) => {
    const key = name || '—';
    if (!people.has(key)) people.set(key, {receipts: 0, loads: 0, deliveries: 0});
    return people.get(key)!;
  };
  periodReceipts.forEach(r => (person(r.receivedByName).receipts += 1));
  loaded.forEach(load => (person(load.createdByName).loads += 1));
  periodDeliveries.forEach(d => (person(d.deliveredByName).deliveries += 1));
  const byPerson = [...people.entries()].sort(
    ([, a], [, b]) => b.receipts + b.loads + b.deliveries - (a.receipts + a.loads + a.deliveries),
  );

  const attention = [
    {label: tr('Ανοιχτές εκκρεμότητες'), count: openIssues.length},
    {label: tr('Βιολογικός δείκτης σε αναμονή'), count: biPending.length},
    {label: tr('Παραλαβές με απόκλιση'), count: deviations.length},
    {label: tr('Παράδοση από άλλο τμήμα'), count: otherDepartment.length},
    {label: tr('Φορτία σε επανεπεξεργασία'), count: notReleased.length},
  ].filter(item => item.count > 0);

  return (
    <ScanScreen
      title={tr('Αναφορά')}
      subtitle={tr('Η Αποστείρωση με μια ματιά')}
      backLabel={tr('Σταθμοί')}
      onBack={onStations}
    >
      <div className="scan-camera-tools" role="group" aria-label={tr('Περίοδος')}>
        {(
          [
            ['TODAY', tr('Σήμερα')],
            ['YESTERDAY', tr('Χθες')],
            ['WEEK', tr('7 ημέρες')],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" aria-pressed={period === key} onClick={() => setPeriod(key)}>
            {label}
          </button>
        ))}
      </div>
      <dl className="scan-report-kpis">
        <div>
          <dt>{tr('Παραλαβές')}</dt>
          <dd>{periodReceipts.length}</dd>
        </div>
        <div>
          <dt>{tr('Φορτία κλιβάνου')}</dt>
          <dd>{loaded.length}</dd>
        </div>
        <div>
          <dt>{tr('Αποδεσμευμένα φορτία')}</dt>
          <dd>{released.length}</dd>
        </div>
        <div>
          <dt>{tr('Παραδόσεις')}</dt>
          <dd>{periodDeliveries.length}</dd>
        </div>
      </dl>

      <h2 className="scan-section">{tr('Χρειάζεται προσοχή')}</h2>
      {attention.length ? (
        <ul className="scan-refused">
          {attention.map(item => (
            <li key={item.label} className="scan-report-row">
              <span>{item.label}</span>
              <b>{item.count}</b>
            </li>
          ))}
        </ul>
      ) : (
        <p className="scan-empty">{tr('Τίποτα για προσοχή.')}</p>
      )}

      <h2 className="scan-section">{tr('Τώρα στην Αποστείρωση')}</h2>
      <ul className="scan-report-stages">
        {stages.map(stage => (
          <li key={stage.label}>
            <span>{stage.label}</span>
            <i aria-hidden="true">
              <i style={{width: `${(stage.count / most) * 100}%`}} />
            </i>
            <b>{stage.count}</b>
          </li>
        ))}
      </ul>

      <h2 className="scan-section">{tr('Ανά χρήστη')}</h2>
      {byPerson.length ? (
        <ul className="scan-moves">
          {byPerson.map(([name, counts]) => (
            <li key={name}>
              <span>
                <b>{trData(name)}</b>
                <small>
                  {[
                    counts.receipts && tr('{0} παραλαβές', counts.receipts),
                    counts.loads && tr('{0} φορτία', counts.loads),
                    counts.deliveries && tr('{0} παραδόσεις', counts.deliveries),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </small>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="scan-empty">{tr('Καμία κίνηση στην περίοδο.')}</p>
      )}
      <p className="scan-camera-hint">{tr('Οι πλήρεις αναφορές είναι στην εφαρμογή, στον υπολογιστή.')}</p>
    </ScanScreen>
  );
}
