import type {UIEvent} from 'react';
import AssetTypeIcon from '../../../components/assets/AssetTypeIcon';
import {
  CheckCircle2,
  Flame,
  TriangleAlert,
  ArrowRight,
  X,
  Clock3,
  UserCheck,
  Layers3,
  Printer,
  Barcode,
  Check,
} from 'lucide-react';
import {printBarcodeLabel, printCompositionA4} from '../printUtils';
import {tr, trData} from '../../../i18n';
import type {SterilizationPageState} from '../useSterilizationPage';
import ShelfLifePicker from './ShelfLifePicker';
import {SET_SHORTAGE_CODE} from '../hooks/usePreparationChecks';

// The side column and the list scroll only up and down: a tap (focus) must never shift them sideways.
const keepLeft = (event: UIEvent<HTMLElement>) => {
  if (event.currentTarget.scrollLeft) event.currentTarget.scrollLeft = 0;
};

export default function PreparationModal({s}: {s: SterilizationPageState}) {
  const {
    prepSetIssues,
    prepKeptIssueIds,
    setPrepKeptIssueIds,
    setPrepManageIssueId,
    setAcceptedMissingCodes,
    prepMissingAccepted,
    acceptedMissingCodes,
    allowMissing,
    compositionOptions,
    currentUser,
    issues,
    moveToProcess,
    openMissingManage,
    openPrepManage,
    prepAcceptedDeviation,
    prepAllEligibleSelected,
    prepBlockingIssues,
    prepCheckedIds,
    prepDraft,
    prepEligibleIds,
    prepExpectedCount,
    prepItemIds,
    prepMissingCount,
    prepMissingRequirements,
    prepNote,
    prepProcessChecks,
    prepReadyForProcess,
    prepTools,
    setAllowMissing,
    setPrepDraft,
    setPrepNote,
    setPrepProcessChecks,
    stageEnabled,
    systemSettings,
    toggleAllPrepChecks,
    togglePrepItem,
    undoAcceptedMissing,
  } = s;
  return (
    <>
      {prepDraft && (
        <div className="modal-backdrop" onMouseDown={() => setPrepDraft(null)}>
          <div className="receipt-card-modal prep-modal prep-workspace-modal" onMouseDown={e => e.stopPropagation()}>
            <button
              className="modal-x"
              aria-label={tr('Κλείσιμο')}
              title={tr('Κλείσιμο')}
              onClick={() => setPrepDraft(null)}
            >
              <X size={18} />
            </button>
            <div className="receipt-card-head">
              <AssetTypeIcon
                kind={prepDraft.kind}
                maxUses={prepDraft.kind === 'TOOL' ? prepDraft.asset.maxUses : undefined}
                framed
                className="ster-kind"
                size={19}
              />
              <div>
                <span>{tr('ΣΥΝΘΕΣΗ & ΠΡΟΕΤΟΙΜΑΣΙΑ')}</span>
                <h2>
                  {prepDraft.asset.barcode} · {prepDraft.asset.name}
                </h2>
                <p>{tr('Έλεγχος φυσικών εργαλείων μετά το πλύσιμο και πριν τον κλιβανισμό.')}</p>
              </div>
            </div>
            <div className="prep-workspace-body">
              <aside className="prep-control-panel" onScroll={keepLeft}>
                <div className="prep-meta-line">
                  <span title={tr('Προετοιμάζει')}>
                    <UserCheck size={15} />
                    <strong>{trData(currentUser.name)}</strong>
                    <small>{trData(currentUser.department)}</small>
                  </span>
                  <span title={tr('Ημερομηνία / ώρα')}>
                    <Clock3 size={15} />
                    {new Date().toLocaleString('el-GR', {dateStyle: 'short', timeStyle: 'short'})}
                  </span>
                  <span title={tr('Φυσικά εργαλεία')}>
                    <Layers3 size={15} />
                    {tr('{0} εργαλεία', prepItemIds.length)}
                  </span>
                </div>
                <section className="prep-card-section prep-quality-section">
                  <div className="prep-section-head">
                    <div>
                      <strong>{tr('Έλεγχος & προετοιμασία')}</strong>
                      <span>{tr('Τεκμηρίωση πριν από συσκευασία και κλιβανισμό.')}</span>
                    </div>
                  </div>
                  <div className="prep-check-summary">
                    <div>
                      <span>{tr('Ελεγμένα εργαλεία')}</span>
                      <strong>
                        {prepCheckedIds.size} / {prepItemIds.length}
                      </strong>
                    </div>
                    <div>
                      <span>{tr('Σύνθεση')}</span>
                      <strong>
                        {prepDraft.kind === 'SET' ? `${prepTools.length} / ${prepDraft.asset.expected}` : '1 / 1'}
                      </strong>
                    </div>
                  </div>
                  {prepBlockingIssues.length > 0 && (
                    <div className="prep-block-warning">
                      <TriangleAlert size={16} />
                      <span>
                        {tr('Υπάρχουν') + ' '}
                        {prepBlockingIssues.length} {tr('εκκρεμότητες που απαιτούν ενέργεια πριν την προώθηση.')}
                      </span>
                      <small className="prep-block-hint">
                        {tr('Οι γραμμές με χρώμα στη λίστα δείχνουν τι χρειάζεται ενέργεια· πατήστε «Αντιμετώπιση».')}
                      </small>
                    </div>
                  )}
                  {prepAcceptedDeviation && prepBlockingIssues.length === 0 && (
                    <div className="prep-accepted-warning">
                      <CheckCircle2 size={16} />
                      <span>
                        {tr(
                          'Η έλλειψη έχει γίνει αποδεκτή ως τεκμηριωμένη απόκλιση. Η διαδικασία μπορεί να προχωρήσει όταν ολοκληρωθούν οι υπόλοιποι έλεγχοι.',
                        )}
                      </span>
                    </div>
                  )}
                  <div className="prep-process-checks">
                    <strong>{tr('Έλεγχοι πριν τον κλιβανισμό')}</strong>
                    {!stageEnabled('WASHING') && (
                      <label>
                        <input
                          type="checkbox"
                          checked={prepProcessChecks.cleanDry}
                          onChange={e => setPrepProcessChecks(v => ({...v, cleanDry: e.target.checked}))}
                        />
                        <span>
                          <b>{tr('Καθαρότητα & στέγνωμα')}</b>
                          <small>{tr('Τα εργαλεία είναι οπτικά καθαρά και πλήρως στεγνά.')}</small>
                        </span>
                      </label>
                    )}
                    <label>
                      <input
                        type="checkbox"
                        checked={prepProcessChecks.functionIntegrity}
                        onChange={e => setPrepProcessChecks(v => ({...v, functionIntegrity: e.target.checked}))}
                      />
                      <span>
                        <b>{tr('Ακεραιότητα & λειτουργικότητα')}</b>
                        <small>{tr('Δεν διαπιστώθηκε βλάβη και η λειτουργία είναι αποδεκτή.')}</small>
                      </span>
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={prepProcessChecks.assembly}
                        onChange={e => setPrepProcessChecks(v => ({...v, assembly: e.target.checked}))}
                      />
                      <span>
                        <b>{prepDraft.kind === 'SET' ? tr('Σύνθεση & συναρμολόγηση') : tr('Επιβεβαίωση εργαλείου')}</b>
                        <small>
                          {prepDraft.kind === 'SET'
                            ? tr('Η σύνθεση έχει ελεγχθεί και συναρμολογηθεί σύμφωνα με τη δηλωμένη καρτέλα.')
                            : tr('Το εργαλείο και τα απαιτούμενα μέρη του έχουν ελεγχθεί.')}
                        </small>
                      </span>
                    </label>
                    {!stageEnabled('PACKAGING') && (
                      <>
                        <label>
                          <input
                            type="checkbox"
                            checked={prepProcessChecks.packaging}
                            onChange={e => setPrepProcessChecks(v => ({...v, packaging: e.target.checked}))}
                          />
                          <span>
                            <b>{tr('Συσκευασία / περιέκτης')}</b>
                            <small>{tr('Επιλέχθηκε κατάλληλη και ακέραιη συσκευασία ή περιέκτης.')}</small>
                          </span>
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={prepProcessChecks.labelIndicator}
                            onChange={e => setPrepProcessChecks(v => ({...v, labelIndicator: e.target.checked}))}
                          />
                          <span>
                            <b>{tr('Σήμανση & δείκτης')}</b>
                            <small>{tr('Η σήμανση και ο απαιτούμενος χημικός δείκτης έχουν τοποθετηθεί.')}</small>
                          </span>
                        </label>
                      </>
                    )}
                  </div>
                  {!stageEnabled('PACKAGING') && <ShelfLifePicker value={s.shelfLife} onChange={s.setShelfLife} />}
                  <label className="prep-note-field">
                    {tr('Παρατήρηση προετοιμασίας')}
                    <textarea
                      value={prepNote}
                      onChange={e => setPrepNote(e.target.value)}
                      placeholder={tr('Προαιρετική παρατήρηση για σύνθεση, συσκευασία ή άλλη απόκλιση…')}
                    />
                  </label>
                </section>
                <section className="prep-card-section">
                  <div className="prep-section-head">
                    <div>
                      <strong>{tr('Εκτυπώσεις')}</strong>
                      <span>{tr('Φύλλο σύνθεσης Α4 και barcode.')}</span>
                    </div>
                  </div>
                  <div className="prep-print-actions">
                    {prepDraft.kind === 'SET' && (
                      <button
                        type="button"
                        onClick={() =>
                          printCompositionA4(
                            prepDraft.asset,
                            prepTools,
                            currentUser.name,
                            new Date().toLocaleString('el-GR', {dateStyle: 'short', timeStyle: 'short'}),
                            issues
                              .filter(
                                i =>
                                  i.status === 'OPEN' &&
                                  [prepDraft.asset.barcode, ...prepTools.map(t => t.barcode)].some(b =>
                                    i.asset.startsWith(b),
                                  ),
                              )
                              .map(i => ({barcode: i.asset.split(' · ')[0], type: i.type})),
                            compositionOptions(prepDraft.asset.colorTapes),
                          )
                        }
                      >
                        <Printer size={16} /> {tr('Εκτύπωση')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        printBarcodeLabel(
                          prepDraft.asset,
                          prepDraft.kind,
                          prepDraft.kind === 'SET' ? prepTools.length : undefined,
                          systemSettings.label,
                        )
                      }
                    >
                      <Barcode size={16} /> {tr('Εκτύπωση barcode')}
                    </button>
                  </div>
                </section>
              </aside>
              <section className="prep-tools-panel">
                {prepDraft.kind === 'SET' && (
                  <div className={`prep-composition-status compact ${prepMissingCount > 0 ? 'missing' : 'complete'}`}>
                    {prepMissingCount > 0 ? <TriangleAlert size={16} /> : <CheckCircle2 size={16} />}
                    <div>
                      <strong>
                        {prepMissingCount > 0
                          ? tr(
                              'Σύνθεση {0}/{1} · {2} {3}',
                              prepTools.length,
                              prepExpectedCount,
                              prepMissingCount,
                              prepMissingCount === 1 ? tr('έλλειψη') : tr('ελλείψεις'),
                            )
                          : tr('Σύνθεση πλήρης · {0}/{1}', prepTools.length, prepExpectedCount)}
                      </strong>
                      <span>
                        {prepMissingCount > 0
                          ? tr('Η έλλειψη εμφανίζεται και διαχειρίζεται μέσα στη λίστα εργαλείων.')
                          : tr('Όλες οι αναμενόμενες θέσεις της σύνθεσης είναι καλυμμένες.')}
                      </span>
                    </div>
                    {prepMissingCount > 0 && (
                      <label className="prep-accept-missing" title={tr('Η απόκλιση καταγράφεται στο ιστορικό.')}>
                        <input
                          type="checkbox"
                          checked={prepMissingRequirements.length ? prepMissingAccepted : allowMissing}
                          onChange={e => {
                            // Accepts (or clears) every Missing row at once.
                            if (prepMissingRequirements.length)
                              setAcceptedMissingCodes(
                                e.target.checked ? new Set(prepMissingRequirements.map(req => req.code)) : new Set(),
                              );
                            else setAllowMissing(e.target.checked);
                          }}
                        />
                        <span>
                          <strong>{tr('Αποδοχή καταγεγραμμένης έλλειψης')}</strong>
                          <small>
                            {tr('Το Set θα προχωρήσει με') + ' '}
                            {prepMissingCount} {tr('λιγότερα εργαλεία.')}
                          </small>
                        </span>
                      </label>
                    )}
                  </div>
                )}
                <div className="prep-tools-head prep-tools-toolbar prep-tools-toolbar-refined">
                  <div className="prep-tools-heading-block">
                    <div>
                      <strong>{prepDraft.kind === 'SET' ? tr('Εργαλεία Σετ') : tr('Μεμονωμένο εργαλείο')}</strong>
                      <span>
                        {prepDraft.kind === 'SET'
                          ? tr('{0} φυσικές εγγραφές — έλεγχος και διαχείριση ανά εργαλείο', prepTools.length)
                          : tr('Έλεγχος και επιβεβαίωση πριν τη συσκευασία')}
                      </span>
                      {prepDraft.kind === 'SET' && prepBlockingIssues.length > 0 && (
                        <button
                          type="button"
                          className="prep-open-issues-filter"
                          title={tr('Εκκρεμότητες που απαιτούν ενέργεια')}
                        >
                          <TriangleAlert size={12} />
                          {prepBlockingIssues.length}{' '}
                          {prepBlockingIssues.length === 1 ? tr('εκκρεμότητα') : tr('εκκρεμότητες')}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="prep-tools-toolbar-actions">
                    <div className="prep-bulk-select">
                      <button
                        type="button"
                        className="prep-all-ok"
                        onClick={toggleAllPrepChecks}
                        disabled={prepEligibleIds.length === 0}
                      >
                        {prepAllEligibleSelected ? (
                          <>
                            <X size={14} /> {tr('Αποεπιλογή όλων')}
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={14} /> {tr('Επιλογή όλων')}
                          </>
                        )}
                      </button>
                    </div>
                    <span className="prep-tools-progress">
                      {prepCheckedIds.size}/{prepItemIds.length}
                    </span>
                  </div>
                </div>
                <div className="prep-tools-scroll" onScroll={keepLeft}>
                  {prepDraft.kind === 'SET' ? (
                    <>
                      {prepSetIssues.map(issue => {
                        const kept = prepKeptIssueIds.has(issue.id);
                        return (
                          <div
                            className={`prep-tool-row prep-missing-row prep-set-issue-row ${kept ? 'accepted' : ''}`}
                            key={`set-issue-${issue.id}`}
                          >
                            <div className="prep-missing-placeholder">
                              <TriangleAlert size={15} />
                            </div>
                            <div className="prep-tool-main">
                              <span className="mono">{prepDraft.asset.barcode}</span>
                              <strong>{trData(issue.type)}</strong>
                              <small>{issue.note ? trData(issue.note) : tr('Εκκρεμότητα του Σετ')}</small>
                            </div>
                            <div className="prep-tool-state">
                              {kept ? (
                                <span className="prep-missing-accepted">{tr('Παραμονή ως έχει')}</span>
                              ) : (
                                <span className="prep-missing-chip">{tr('Εκκρεμότητα Σετ')}</span>
                              )}
                            </div>
                            {kept ? (
                              <button
                                className="tool-manage-btn subtle"
                                type="button"
                                onClick={() =>
                                  setPrepKeptIssueIds(current => {
                                    const next = new Set(current);
                                    next.delete(issue.id);
                                    return next;
                                  })
                                }
                              >
                                {tr('Αναίρεση')}
                              </button>
                            ) : (
                              <button
                                className="tool-manage-btn warning prep-attention-action"
                                type="button"
                                onClick={() => setPrepManageIssueId(issue.id)}
                              >
                                <TriangleAlert size={14} /> {tr('Αντιμετώπιση')}
                              </button>
                            )}
                          </div>
                        );
                      })}
                      {prepMissingRequirements.flatMap(req =>
                        Array.from({length: req.missing}, (_, idx) => {
                          const accepted = acceptedMissingCodes.has(req.code);
                          return (
                            <div
                              className={`prep-tool-row prep-missing-row ${accepted ? 'accepted' : ''}`}
                              key={`missing-${req.code}-${idx}`}
                            >
                              <div className="prep-missing-placeholder">
                                <TriangleAlert size={15} />
                              </div>
                              <div className="prep-tool-main">
                                <span className="mono">—</span>
                                <strong>{req.name}</strong>
                                <small>
                                  {req.code === SET_SHORTAGE_CODE
                                    ? tr('Το Σετ έχει {0} από {1} εργαλεία', prepTools.length, req.quantity)
                                    : `${req.code} ${tr('· αναμενόμενο εργαλείο που λείπει από τη φυσική σύνθεση')}`}
                                </small>
                              </div>
                              <div className="prep-tool-state">
                                {accepted ? (
                                  <span className="prep-missing-accepted">{tr('Αποδεκτή απόκλιση')}</span>
                                ) : (
                                  <span className="prep-missing-chip">{tr('Λείπει')}</span>
                                )}
                              </div>
                              {accepted ? (
                                <button
                                  className="tool-manage-btn subtle"
                                  type="button"
                                  onClick={() => undoAcceptedMissing(req.code)}
                                >
                                  {tr('Αναίρεση')}
                                </button>
                              ) : (
                                <button
                                  className="tool-manage-btn warning prep-attention-action"
                                  type="button"
                                  onClick={() => openMissingManage(req.code)}
                                >
                                  <TriangleAlert size={14} /> {tr('Αντιμετώπιση')}
                                </button>
                              )}
                            </div>
                          );
                        }),
                      )}
                      {prepTools.map(t => {
                        const toolIssues = issues.filter(i => i.status === 'OPEN' && i.asset.startsWith(t.barcode));
                        const checked = prepCheckedIds.has(t.id);
                        return (
                          <div
                            className={`prep-tool-row ${checked ? 'checked' : ''} ${toolIssues.length ? 'has-issue' : ''}`}
                            key={t.id}
                          >
                            <label className="prep-tool-check" onClick={e => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={toolIssues.length > 0}
                                onChange={() => togglePrepItem(t.id)}
                              />
                              <span>{checked ? <Check size={14} /> : null}</span>
                            </label>
                            <div className="prep-tool-main">
                              <span className="mono">{t.barcode}</span>
                              <strong>{t.name}</strong>
                              <small>
                                {t.manufacturer} · {t.code}
                                {t.serialNumber ? ` · S/N ${t.serialNumber}` : ''}
                              </small>
                            </div>
                            <div className="prep-tool-state">
                              {toolIssues.length ? (
                                <span className="prep-open-issue-state">
                                  <span className="prep-issue-chip">
                                    <TriangleAlert size={12} />
                                    {tr('Ανοικτή αναφορά')}
                                  </span>
                                  <small>{toolIssues.map(i => i.type).join(' · ')}</small>
                                </span>
                              ) : (
                                <span className="prep-ok-chip">{tr('Έτοιμο για έλεγχο')}</span>
                              )}
                            </div>
                            <button
                              className={`tool-manage-btn prep-attention-action ${toolIssues.length ? 'warning' : 'subtle'}`}
                              type="button"
                              onClick={() => openPrepManage(t.id)}
                            >
                              {toolIssues.length ? (
                                <>
                                  <TriangleAlert size={14} /> {tr('Αντιμετώπιση')}
                                </>
                              ) : (
                                <>
                                  {tr('Λεπτομέρειες') + ' '}
                                  <ArrowRight size={14} />
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <div className={`prep-tool-row single ${prepCheckedIds.has(prepDraft.asset.id) ? 'checked' : ''}`}>
                      <label className="prep-tool-check">
                        <input
                          type="checkbox"
                          checked={prepCheckedIds.has(prepDraft.asset.id)}
                          onChange={() => togglePrepItem(prepDraft.asset.id)}
                        />
                        <span>{prepCheckedIds.has(prepDraft.asset.id) ? <Check size={14} /> : null}</span>
                      </label>
                      <div className="prep-tool-main">
                        <span className="mono">{prepDraft.asset.barcode}</span>
                        <strong>{prepDraft.asset.name}</strong>
                        <small>
                          {prepDraft.asset.manufacturer} · {prepDraft.asset.code}
                        </small>
                      </div>
                      <div className="prep-tool-state">
                        <span className="prep-ok-chip">{tr('Έτοιμο για έλεγχο')}</span>
                      </div>
                      <button
                        className="tool-manage-btn subtle prep-attention-action"
                        type="button"
                        onClick={() => openPrepManage(prepDraft.asset.id)}
                      >
                        {tr('Λεπτομέρειες') + ' '}
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </div>
            <div className="modal-actions prep-actions">
              <button onClick={() => setPrepDraft(null)}>{tr('Ακύρωση')}</button>
              <button
                className="primary"
                disabled={!prepReadyForProcess}
                onClick={() => moveToProcess(prepDraft.kind, prepDraft.asset.id)}
              >
                <Flame size={16} /> {tr('Ολοκλήρωση · Προς κλιβανισμό')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
