import {loadLabel} from '../../../core/loadLabel';
import {useSurgi} from '../../../store/SurgiStore';
import {useLibraries} from '../../../core/LibraryStore';
import {useState} from 'react';
import {Link} from 'react-router-dom';
import StatusBadge from '../../../components/ui/StatusBadge';
import AssetTypeIcon from '../../../components/assets/AssetTypeIcon';
import {
  CheckCircle2,
  ScanBarcode,
  PackageCheck,
  Flame,
  TriangleAlert,
  ArrowRight,
  Box,
  UserRoundCheck,
  ShieldCheck,
  Layers3,
  Printer,
} from 'lucide-react';
import {tr, trData} from '../../../i18n';
import type {SterilizationPageState} from '../useSterilizationPage';
import SterilizerLoads from './SterilizerLoads';
import {askConfirm} from '../../../components/ui/confirmService';

export default function WorkPanel({s}: {s: SterilizationPageState}) {
  const {counts} = useSurgi();
  const washWithoutWasher = !!useLibraries().sterilizationWorkflow.washingPolicy?.allowWithoutWasher;
  const {
    awaitingLoads,
    incoming,
    issues,
    openCheckpoint,
    openDelivery,
    openDeliveryBatch,
    openLoad,
    openLoadRelease,
    openPreparation,
    openReceipt,
    openReceiptBatch,
    openRelease,
    processing,
    queue,
    queueStageLabel,
    queueTitle,
    ready,
    recallCases,
    recallLoad,
    releasedLoads,
    rows,
    washing,
  } = s;
  // The instruments of «Φόρτωση κλιβάνου» are all picked by default; unticking leaves one out of the load.
  const [left, setLeft] = useState<Set<string>>(new Set());
  const keyOf = (x: {kind: string; id: string}) => `${x.kind}:${x.id}`;
  const pickedKeys = rows.map(keyOf).filter(key => !left.has(key));
  const toggleLeft = (key: string) =>
    setLeft(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  // Assets that sit in a load waiting for release; a record without a load keeps its own release button.
  const inLoad = new Set(awaitingLoads.flatMap(load => load.items.map(item => `${item.assetKind}:${item.assetId}`)));
  return (
    <div className={`ster-work-panel ${queue === 'INCOMING' ? 'receipt-queue-panel' : ''}`}>
      <div className="ster-panel-head">
        <div>
          <strong>{queueTitle}</strong>
          <span>
            {rows.length} {rows.length === 1 ? tr('εγγραφή') : tr('εγγραφές')}
          </span>
        </div>
        <div className="ster-panel-head-actions">
          {queue === 'INCOMING' && (
            <>
              <span className="ster-hint">
                {tr('Γρήγορη φυσική παραλαβή · δήλωση εμφανής απόκλισης · προαιρετική καταμέτρηση βάσει πολιτικής.')}
              </span>
              {incoming.length > 0 && (
                <button className="primary compact" onClick={openReceiptBatch}>
                  <ScanBarcode size={15} /> {tr('Μαζική παραλαβή')}
                </button>
              )}
            </>
          )}
          {queue === 'WASHING' && (
            <>
              <span className="ster-hint">{tr('Τεκμηριωμένος έλεγχος καθαρισμού / απολύμανσης.')}</span>
              {washing.length > 0 && (
                <button className="primary compact" onClick={() => openLoad('WASHING')}>
                  <Layers3 size={15} /> {tr('Φόρτωση πλυντηρίου')}
                </button>
              )}
            </>
          )}
          {queue === 'PREP' && (
            <span className="ster-hint">{tr('Έλεγχος λειτουργικότητας, σύνθεση και διαχείριση αποκλίσεων.')}</span>
          )}
          {queue === 'PACKAGING' && (
            <span className="ster-hint">
              {tr('Έλεγχος αποστειρωμένης συσκευασίας, σήμανσης και δείκτη πριν τον κύκλο.')}
            </span>
          )}
          {queue === 'PROCESS' && processing.length > 0 && (
            <>
              <button
                className="ster-pick-all"
                onClick={() => setLeft(pickedKeys.length === rows.length ? new Set(rows.map(keyOf)) : new Set())}
              >
                {pickedKeys.length === rows.length ? tr('Αποεπιλογή όλων') : tr('Επιλογή όλων')}
              </button>
              <button
                className="primary compact"
                disabled={!pickedKeys.length}
                onClick={() => openLoad('STERILIZATION', pickedKeys)}
              >
                <Flame size={15} /> {tr('Φόρτωση κλιβάνου')} · {pickedKeys.length}
              </button>
            </>
          )}
          {queue === 'IN_STERILIZER' && (
            <span className="ster-hint">
              {tr('Τα αντικείμενα είναι κλειδωμένα μέχρι το τέλος του κύκλου· μετά περνούν στην Αποδέσμευση.')}
            </span>
          )}
          {queue === 'STORAGE' && (
            <span className="ster-hint">{tr('Προαιρετικός έλεγχος ασφαλούς αποθήκευσης πριν την παράδοση.')}</span>
          )}
          {queue === 'READY' && ready.length > 0 && (
            <button className="primary compact" onClick={openDeliveryBatch}>
              <ScanBarcode size={15} /> {tr('Μαζική παράδοση')}
            </button>
          )}
          {queue === 'RELEASE' && (
            <>
              <span className="ster-hint">
                {tr('Αποδέσμευση ανά φορτίο με ενιαία τεκμηρίωση CI/BI και φυσικών παραμέτρων.')}
              </span>
              {awaitingLoads.length > 0 && (
                <button className="primary compact" onClick={() => openLoadRelease(awaitingLoads[0].id)}>
                  <ShieldCheck size={15} /> {tr('Αποδέσμευση φορτίου')}
                  {awaitingLoads.length > 1 ? ` · ${awaitingLoads.length}` : ''}
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {queue === 'RELEASE' && recallCases.some(item => item.status === 'OPEN') && (
        <details className="released-loads" open>
          <summary>
            {tr('Ενεργές ανακλήσεις ·') + ' '}
            {recallCases.filter(item => item.status === 'OPEN').length}
          </summary>
          <div>
            {recallCases
              .filter(item => item.status === 'OPEN')
              .map(recall => (
                <div key={recall.id}>
                  <span>
                    <b>{recall.id}</b> {tr('· φορτίο') + ' '}
                    {recall.loadId} · {recall.items.filter(item => item.status !== 'CLOSED').length} {tr('εκκρεμή')}
                    <small style={{display: 'block'}}>{recall.reason}</small>
                  </span>
                  <span>
                    {recall.items.filter(item => item.status === 'OUTSTANDING').length} {tr('προς επιστροφή')}
                  </span>
                </div>
              ))}
          </div>
        </details>
      )}
      {queue === 'RELEASE' && releasedLoads.length > 0 && (
        <details
          className="released-loads"
          open={releasedLoads.some(load => load.biologicalIndicatorResult === 'PENDING') || undefined}
        >
          <summary>
            {tr('Πρόσφατα αποδεσμευμένα φορτία · δυνατότητα ανάκλησης')}
            {releasedLoads.some(load => load.biologicalIndicatorResult === 'PENDING') &&
              ` · ${tr('{0} με βιολογικό σε αναμονή', releasedLoads.filter(load => load.biologicalIndicatorResult === 'PENDING').length)}`}
          </summary>
          <div>
            {releasedLoads.map(load => (
              <div key={load.id}>
                <span>
                  <b>{loadLabel(load)}</b> · {load.items.length} {tr('αντικείμενα')}
                </span>
                <span className="released-load-actions">
                  {load.biologicalIndicatorResult === 'PENDING' && (
                    <>
                      <span className="released-load-bi">{tr('Βιολογικός σε αναμονή')}</span>
                      <button className="bi-pass" onClick={() => s.recordBiologicalResult(load.id, 'PASS')}>
                        <CheckCircle2 size={14} /> {tr('BI επιτυχής')}
                      </button>
                      <button
                        className="bi-fail"
                        onClick={() =>
                          void askConfirm({
                            title: tr('BI ανεπιτυχής'),
                            message: tr(
                              'Ανεπιτυχής βιολογικός δείκτης: όλο το φορτίο {0} θα ανακληθεί. Συνέχεια;',
                              load.cycleNumber,
                            ),
                            confirmLabel: tr('Ανάκληση φορτίου'),
                            danger: true,
                          }).then(sure => sure !== false && s.recordBiologicalResult(load.id, 'FAIL'))
                        }
                      >
                        <TriangleAlert size={14} /> {tr('BI ανεπιτυχής')}
                      </button>
                    </>
                  )}
                  <button onClick={() => s.printLoadForm(load.id)}>
                    <Printer size={14} /> {tr('Έντυπο')}
                  </button>
                  <button onClick={() => recallLoad(load.id)}>
                    <TriangleAlert size={14} /> {tr('Ανάκληση')}
                  </button>
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
      {queue === 'IN_STERILIZER' ? (
        <SterilizerLoads
          loads={s.runningLoads}
          canFinish={s.can('sterilization.cycle')}
          onFinish={(id, result, note) => {
            // A finished cycle goes straight on to Release, where the load is shown ready to release.
            if (s.finishProcessLoad(id, result, note) && result === 'PASSED') s.setQueue('RELEASE');
          }}
          onPrint={s.printLoadForm}
        />
      ) : rows.length === 0 ? (
        <div className="empty ster-empty">
          <PackageCheck size={32} />
          <strong>{tr('Δεν υπάρχουν εγγραφές σε αυτό το στάδιο')}</strong>
          <span>{tr('Η ουρά θα ενημερωθεί όταν πραγματοποιηθεί νέα κίνηση.')}</span>
        </div>
      ) : (
        <>
          <div className="ster-list-head">
            <span>{tr('Αντικείμενο')}</span>
            <span>{tr('Τμήμα')}</span>
            <span>{tr('Ειδικότητα')}</span>
            <span>{queue === 'INCOMING' ? tr('Σύνθεση / κατάσταση') : tr('Κατάσταση')}</span>
            <span>{tr('Στάδιο')}</span>
            <span>{tr('Ενέργειες')}</span>
          </div>
          <div className="ster-list-scroll">
            {rows.map(x => {
              const assetIssues = issues.filter(i => i.status === 'OPEN' && i.asset.startsWith(x.barcode));
              const detail = x.kind === 'SET' ? `/sets/${x.id}` : `/tools/${x.id}`;
              return (
                <div className="ster-work-row" key={`${x.kind}-${x.id}`}>
                  <div className={`ster-asset-cell${queue === 'PROCESS' ? ' with-pick' : ''}`}>
                    {queue === 'PROCESS' && (
                      <input
                        type="checkbox"
                        className="ster-row-pick"
                        checked={!left.has(keyOf(x))}
                        onChange={() => toggleLeft(keyOf(x))}
                        aria-label={tr('Στη φόρτωση: {0}', x.barcode)}
                      />
                    )}
                    <AssetTypeIcon
                      kind={x.kind}
                      maxUses={x.kind === 'TOOL' ? x.maxUses : undefined}
                      framed
                      className="ster-kind"
                      size={18}
                    />
                    <div className="ster-asset">
                      <div>
                        <Link to={detail} className="mono ster-code">
                          {x.barcode}
                        </Link>
                        <span className="ster-type">{x.kind === 'SET' ? tr('ΣΕΤ') : tr('ΕΡΓΑΛΕΙΟ')}</span>
                      </div>
                      <Link to={detail} className="ster-asset-name">
                        {x.name}
                      </Link>
                    </div>
                  </div>
                  <div className="ster-cell-text ster-cell-department">
                    <strong>{trData(x.department) || tr('Χωρίς τμήμα')}</strong>
                    <span className="ster-tablet-specialty">{trData(x.specialty) || '—'}</span>
                  </div>
                  <div className="ster-cell-text ster-cell-specialty">
                    <span>{trData(x.specialty) || '—'}</span>
                  </div>
                  <div className="ster-meta">
                    {queue === 'INCOMING' ? (
                      x.kind === 'SET' ? (
                        <>
                          <small>{tr('Σύνθεση')}</small>
                          <strong className={x.actual !== x.expected ? 'warn-text' : ''}>
                            {x.actual} / {x.expected}
                          </strong>
                        </>
                      ) : (
                        <span className="ster-object-state">{tr('Μεμονωμένο εργαλείο')}</span>
                      )
                    ) : (
                      <StatusBadge value={x.state} />
                    )}{' '}
                    {assetIssues.length > 0 && (
                      <span className="issue-inline">
                        <TriangleAlert size={14} />
                        {assetIssues.length} {tr('ανοικτή')}
                      </span>
                    )}
                    {queue === 'INCOMING' &&
                      (() => {
                        // The operating theatre's count at sending: a shortage shows here before the receipt.
                        const last = counts.find(c => c.setId === x.id);
                        return last?.missing?.length ? (
                          <span className="ster-count-shortage" title={tr('Λείπουν: {0}', last.missing.join(', '))}>
                            {tr('Καταμέτρηση: λείπουν {0}', last.missing.length)}
                          </span>
                        ) : null;
                      })()}
                    <small className="ster-tablet-stage">{queueStageLabel}</small>
                  </div>
                  <div className="ster-status">
                    <small>{queueStageLabel}</small>
                  </div>
                  <div className="ster-row-action">
                    {queue === 'INCOMING' ? (
                      <button className="primary compact" onClick={() => openReceipt(x.kind, x)}>
                        <CheckCircle2 size={15} /> {tr('Παραλαβή')}
                      </button>
                    ) : queue === 'WASHING' ? (
                      <>
                        {/* A washer load with this item in it; washing without a washer only where Studio allows. */}
                        <button className="primary compact" onClick={() => openLoad('WASHING', [`${x.kind}:${x.id}`])}>
                          <Layers3 size={15} /> {tr('Φόρτωση πλυντηρίου')}
                        </button>
                        {washWithoutWasher && (
                          <button className="ster-row-alt" onClick={() => openCheckpoint(x.kind, x, 'WASHING')}>
                            {tr('Χωρίς πλυντήριο')}
                          </button>
                        )}
                      </>
                    ) : queue === 'PREP' ? (
                      <button
                        className="primary compact ster-primary-action"
                        onClick={() => openPreparation(x.kind, x)}
                      >
                        <Layers3 size={15} /> {tr('Έλεγχος & Σύνθεση') + ' '}
                        <ArrowRight size={14} />
                      </button>
                    ) : queue === 'PACKAGING' ? (
                      <button className="primary compact" onClick={() => openCheckpoint(x.kind, x, 'PACKAGING')}>
                        <Box size={15} /> {tr('Έλεγχος συσκευασίας')}
                      </button>
                    ) : queue === 'PROCESS' ? (
                      <span className="ster-row-note">
                        {pickedKeys.includes(keyOf(x)) ? tr('Μπαίνει στο φορτίο') : tr('Εκτός φορτίου')}
                      </span>
                    ) : queue === 'RELEASE' ? (
                      inLoad.has(keyOf(x)) ? (
                        (() => {
                          const load = awaitingLoads.find(l =>
                            l.items.some(i => `${i.assetKind}:${i.assetId}` === keyOf(x)),
                          );
                          // One release per load, from the header button: the row only says which load it is in.
                          return (
                            <span className="ster-row-note" title={load?.id}>
                              {load ? `${trData(load.equipment)} · ${tr('Κύκλος')} ${load.cycleNumber}` : ''}
                            </span>
                          );
                        })()
                      ) : (
                        <button className="primary compact" onClick={() => openRelease(x.kind, x)}>
                          <ShieldCheck size={15} /> {tr('Έλεγχος αποδέσμευσης')}
                        </button>
                      )
                    ) : queue === 'STORAGE' ? (
                      <button className="primary compact" onClick={() => openCheckpoint(x.kind, x, 'STORAGE')}>
                        <PackageCheck size={15} /> {tr('Έλεγχος αποθήκευσης')}
                      </button>
                    ) : (
                      <button className="primary compact" onClick={() => openDelivery(x.kind, x)}>
                        <UserRoundCheck size={15} /> {tr('Παράδοση στο τμήμα')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
