import AssetTypeIcon from '../../../components/assets/AssetTypeIcon';
import {
  CheckCircle2,
  ClipboardCheck,
  TriangleAlert,
  Stethoscope,
  UserRoundCheck,
  X,
  IdCard,
  Clock3,
  Building2,
  UserCheck,
} from 'lucide-react';
import {tr, trData} from '../../../i18n';
import HandoverSignature from '../HandoverSignature';
import type {SterilizationPageState} from '../useSterilizationPage';
import {formatDateTime} from '../../../core/displayDate';

export default function ReceiptModal({s}: {s: SterilizationPageState}) {
  const {
    checkedCount,
    closeReceipt,
    confirmReceipt,
    currentUser,
    deliverer,
    delivererMatches,
    departmentMismatchReason,
    issues,
    note,
    openIssueReport,
    receiptCheckedToolIds,
    receiptDeviationRecorded,
    receiptDraft,
    receiptExpectedCount,
    receiptIdentityValid,
    receiptNoteOpen,
    receiptPolicy,
    receiptProblemToolIds,
    receiptTools,
    setCheckedCount,
    setDeliverer,
    setDepartmentMismatchReason,
    setNote,
    setReceiptDeviationRecorded,
    setReceiptNoteOpen,
    setVisibleDeviation,
    visibleDeviation,
  } = s;
  return (
    <>
      {receiptDraft && (
        <div className="modal-backdrop" onMouseDown={closeReceipt}>
          <div className="receipt-card-modal" onMouseDown={e => e.stopPropagation()}>
            <button className="modal-x" aria-label={tr('Κλείσιμο')} title={tr('Κλείσιμο')} onClick={closeReceipt}>
              <X size={18} />
            </button>
            <div className="receipt-card-head">
              <AssetTypeIcon
                kind={receiptDraft.kind}
                maxUses={receiptDraft.kind === 'TOOL' ? receiptDraft.asset.maxUses : undefined}
                framed
                className="ster-kind"
                size={19}
              />
              <div>
                <span>{tr('ΚΑΡΤΕΛΑ ΠΑΡΑΛΑΒΗΣ')}</span>
                <h2>
                  {receiptDraft.asset.barcode} · {receiptDraft.asset.name}
                </h2>
                <p>
                  {trData(receiptDraft.asset.department)} {tr('→ Κεντρική Αποστείρωση')}
                </p>
              </div>
            </div>

            <div className="receipt-card-body receipt-two-column">
              <div className="receipt-left-panel">
                <section className="receipt-work-section">
                  <div className="receipt-section-title">
                    <div>
                      <strong>{tr('Στοιχεία παραλαβής')}</strong>
                      <span>{tr('Φυσική παράδοση και στοιχεία παραλαμβάνοντα.')}</span>
                    </div>
                  </div>
                  <div className="receipt-summary-grid compact-summary">
                    <div>
                      <Building2 />
                      <span>{tr('Τμήμα αποστολής')}</span>
                      <strong>{trData(receiptDraft.asset.department)}</strong>
                    </div>
                    <div>
                      <Clock3 />
                      <span>{tr('Ημερομηνία / ώρα')}</span>
                      <strong>{formatDateTime()}</strong>
                    </div>
                    <div>
                      <UserCheck />
                      <span>{tr('Παραλαμβάνει')}</span>
                      <strong>{trData(currentUser.name)}</strong>
                      <small>{trData(currentUser.department)}</small>
                    </div>
                    {receiptDraft.kind === 'SET' ? (
                      <div>
                        <ClipboardCheck />
                        <span>{tr('Δηλωμένη σύνθεση')}</span>
                        <strong
                          className={receiptDraft.asset.actual !== receiptDraft.asset.expected ? 'warn-text' : ''}
                        >
                          {receiptExpectedCount} {tr('τεμάχια')}
                        </strong>
                        <small>
                          {receiptExpectedCount} {tr('φυσικές εγγραφές')}
                        </small>
                      </div>
                    ) : (
                      <div>
                        <Stethoscope />
                        <span>{tr('Τύπος')}</span>
                        <strong>{tr('Μεμονωμένο εργαλείο')}</strong>
                      </div>
                    )}
                  </div>
                </section>

                <section className="receipt-work-section identity-work-section">
                  <div className="receipt-section-title">
                    <div>
                      <strong>{tr('Ταυτοποίηση παραδίδοντα')}</strong>
                      <span>{tr('Επιβεβαίωση με προσωπικό κωδικό.')}</span>
                    </div>
                    <IdCard size={18} />
                  </div>
                  <div className="identity-section">
                    <HandoverSignature
                      autoFocus
                      label={tr('Υπογραφή παραδίδοντα (κωδικός χρήστη + συνθηματικό)')}
                      department={receiptDraft.asset.department}
                      signer={deliverer}
                      onSigned={setDeliverer}
                    />
                    {deliverer &&
                      (!delivererMatches ? (
                        <div className="identity-mismatch-box">
                          <div className="identity-warning">
                            <TriangleAlert size={16} />
                            <span>
                              {tr('Ο χρήστης ανήκει στο') + ' '}
                              <b>{trData(deliverer.department)}</b>
                              {tr(', ενώ η αποστολή προέρχεται από')} <b>{trData(receiptDraft.asset.department)}</b>.
                            </span>
                          </div>
                          {receiptPolicy.allowCrossDepartmentHandover ? (
                            <label>
                              {tr('Αιτιολόγηση εξαίρεσης')}
                              <textarea
                                value={departmentMismatchReason}
                                onChange={e => setDepartmentMismatchReason(e.target.value)}
                                placeholder={tr('Π.χ. εξουσιοδοτημένη μεταφορά από άλλο τμήμα…')}
                              />
                            </label>
                          ) : (
                            <div className="identity-error">
                              {tr('Η πολιτική της μονάδας δεν επιτρέπει παραλαβή από διαφορετικό τμήμα.')}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="identity-result">
                          <CheckCircle2 size={17} />
                          <div>
                            <strong>{deliverer.name}</strong>
                            <span>
                              {deliverer.role} · {trData(deliverer.department)}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                  <div className="handover-warning compact-warning">
                    <TriangleAlert size={16} />
                    <span>{tr('Η παραλαβή ολοκληρώνεται μόνο μετά την ταυτοποίηση.')}</span>
                  </div>
                </section>

                <section className="receipt-work-section receipt-check-section">
                  <div className="receipt-section-title">
                    <div>
                      <strong>{tr('Εμφανής κατάσταση κατά την παραλαβή')}</strong>
                      <span>{tr('Δεν υποκαθιστά τον αναλυτικό Έλεγχο & Σύνθεση.')}</span>
                    </div>
                    <TriangleAlert size={18} />
                  </div>
                  <div className="receipt-visible-deviation">
                    <button
                      type="button"
                      className={!visibleDeviation ? 'active ok' : ''}
                      onClick={() => {
                        setVisibleDeviation(false);
                        setReceiptDeviationRecorded(false);
                      }}
                    >
                      <CheckCircle2 size={16} /> {tr('Χωρίς εμφανή απόκλιση')}
                    </button>
                    <button
                      type="button"
                      className={visibleDeviation ? 'active warn' : ''}
                      onClick={() => setVisibleDeviation(true)}
                    >
                      <TriangleAlert size={16} /> {tr('Υπάρχει εμφανής απόκλιση')}
                    </button>
                  </div>
                  {visibleDeviation && (
                    <div className={`handover-warning compact-warning ${receiptDeviationRecorded ? 'recorded' : ''}`}>
                      <TriangleAlert size={16} />
                      <span>
                        {receiptDeviationRecorded
                          ? tr('Η εμφανής απόκλιση έχει καταγραφεί. Μπορείς να ολοκληρώσεις την παραλαβή.')
                          : tr(
                              'Απαιτείται καταγραφή: χρησιμοποίησε «Αναφορά Σετ» ή «Αναφορά» στο συγκεκριμένο εργαλείο.',
                            )}
                      </span>
                    </div>
                  )}
                  {receiptDraft.kind === 'SET' && receiptPolicy.countSetsAtReceipt && (
                    <div className="receipt-count-only">
                      <div>
                        <span>{tr('Αναμενόμενα')}</span>
                        <strong>{receiptExpectedCount}</strong>
                      </div>
                      <label>
                        {tr('Παραληφθέντα')}
                        <input
                          type="number"
                          min={0}
                          max={receiptExpectedCount}
                          value={checkedCount}
                          onChange={e =>
                            setCheckedCount(Math.max(0, Math.min(receiptExpectedCount, Number(e.target.value))))
                          }
                        />
                      </label>
                      {checkedCount !== receiptExpectedCount && (
                        <div className="identity-warning">
                          <TriangleAlert size={15} />
                          <span>{tr('Η διαφορά ποσότητας θα καταγραφεί αυτόματα ως έλλειψη.')}</span>
                        </div>
                      )}
                    </div>
                  )}
                </section>

                <section className="receipt-work-section receipt-inline-note-section">
                  {!receiptNoteOpen ? (
                    <button type="button" className="receipt-add-note-btn" onClick={() => setReceiptNoteOpen(true)}>
                      <span className="receipt-add-note-plus">+</span>
                      <span>
                        <strong>{tr('Προσθήκη παρατήρησης')}</strong>
                        <small>{tr('Προαιρετική σημείωση για τη φυσική παραλαβή')}</small>
                      </span>
                    </button>
                  ) : (
                    <div className="receipt-inline-note-editor">
                      <div className="receipt-inline-note-head">
                        <div>
                          <strong>{tr('Παρατήρηση παραλαβής')}</strong>
                          <small>{tr('Προαιρετικά')}</small>
                        </div>
                        <button
                          type="button"
                          className="receipt-note-close"
                          onClick={() => {
                            setReceiptNoteOpen(false);
                            setNote('');
                          }}
                          aria-label={tr('Κλείσιμο παρατήρησης')}
                        >
                          <X size={15} />
                        </button>
                      </div>
                      <textarea
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        placeholder={tr('Κατάσταση μεταφοράς ή άλλη παρατήρηση…')}
                      />
                    </div>
                  )}
                </section>
              </div>

              <div className="receipt-right-panel">
                {receiptDraft.kind === 'SET' ? (
                  <section className="receipt-work-section receipt-set-tools">
                    <div className="prep-tools-head prep-tools-toolbar receipt-tools-toolbar">
                      <div className="receipt-tools-title-block">
                        <div>
                          <strong>{tr('Φυσική σύνθεση Σετ')}</strong>{' '}
                          <span>
                            {receiptTools.length} {tr('εργαλεία — αναφορά μόνο αν εντοπιστεί εμφανές πρόβλημα')}
                          </span>
                        </div>
                      </div>
                      <div className="prep-tools-toolbar-actions">
                        <button
                          type="button"
                          className="set-report-btn"
                          onClick={() =>
                            openIssueReport('SET', receiptDraft.asset.id, 'Αποστείρωση · κατά την παραλαβή')
                          }
                        >
                          <TriangleAlert size={14} /> {tr('Αναφορά Σετ')}
                        </button>
                      </div>
                    </div>
                    <div className="receipt-tool-columns">
                      <span>Barcode</span>
                      <span>{tr('Κωδικός')}</span>
                      <span>{tr('Όνομα εργαλείου')}</span>
                      <span>{tr('Εταιρεία')}</span>
                      <span>{tr('Κατάσταση')}</span>
                      <span>{tr('Ενέργεια')}</span>
                    </div>
                    <div className="prep-tools-scroll receipt-tools-scroll">
                      {receiptTools.length === 0 ? (
                        <div className="empty compact-empty">{tr('Δεν υπάρχουν συνδεδεμένα εργαλεία στο demo.')}</div>
                      ) : (
                        receiptTools.map(t => {
                          const toolIssues = issues.filter(i => i.status === 'OPEN' && i.asset.startsWith(t.barcode));
                          const remaining = t.maxUses ? Math.max(0, t.maxUses - t.uses) : null;
                          const checked = receiptCheckedToolIds.has(t.id);
                          const problem = receiptProblemToolIds.has(t.id) || toolIssues.length > 0;
                          return (
                            <div
                              className={`receipt-verification-row ${checked ? 'checked' : ''} ${problem ? 'has-issue' : ''}`}
                              key={t.id}
                            >
                              <span className="mono receipt-tool-barcode">{t.barcode}</span>
                              <span className="receipt-tool-code">{t.code || '—'}</span>
                              <div className="receipt-tool-name">
                                <strong>{t.name}</strong>
                                {t.serialNumber && <small>S/N {t.serialNumber}</small>}
                                {t.maxUses && (
                                  <small>
                                    {tr('Υπόλοιπο') + ' '}
                                    {remaining}/{t.maxUses}
                                  </small>
                                )}
                              </div>
                              <span className="receipt-tool-manufacturer">{t.manufacturer || '—'}</span>
                              <div className="receipt-tool-state">
                                {problem ? (
                                  toolIssues.map(i => (
                                    <span className="prep-issue-chip" key={i.id}>
                                      <TriangleAlert size={12} />
                                      {trData(i.type)}
                                    </span>
                                  ))
                                ) : (
                                  <span className="prep-ok-chip">{tr('Χωρίς απόκλιση')}</span>
                                )}
                              </div>
                              <button
                                className="tool-report-btn"
                                type="button"
                                onClick={() => openIssueReport('TOOL', t.id, 'Αποστείρωση · κατά την παραλαβή')}
                              >
                                <TriangleAlert size={14} /> {tr('Αναφορά')}
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </section>
                ) : (
                  <section className="receipt-work-section receipt-single-tool-panel">
                    <div className="prep-tools-head prep-tools-toolbar receipt-tools-toolbar">
                      <div>
                        <strong>{tr('Μεμονωμένο εργαλείο κατά την παραλαβή')}</strong>
                        <span>
                          {tr(
                            'Τα βασικά στοιχεία εμφανίζονται σε μία καθαρή γραμμή · αναφορά μόνο αν εντοπιστεί εμφανές πρόβλημα',
                          )}
                        </span>
                      </div>
                      <div className="prep-tools-toolbar-actions"></div>
                    </div>
                    <div className="receipt-tool-columns">
                      <span>Barcode</span>
                      <span>{tr('Κωδικός')}</span>
                      <span>{tr('Όνομα εργαλείου')}</span>
                      <span>{tr('Εταιρεία')}</span>
                      <span>{tr('Κατάσταση')}</span>
                      <span>{tr('Ενέργεια')}</span>
                    </div>
                    <div className="prep-tools-scroll receipt-tools-scroll single-receipt-scroll">
                      {(() => {
                        const t = receiptDraft.asset;
                        const toolIssues = issues.filter(i => i.status === 'OPEN' && i.asset.startsWith(t.barcode));
                        const remaining = t.maxUses ? Math.max(0, t.maxUses - t.uses) : null;
                        const checked = receiptCheckedToolIds.has(t.id);
                        const problem = receiptProblemToolIds.has(t.id) || toolIssues.length > 0;
                        return (
                          <div
                            className={`receipt-verification-row ${checked ? 'checked' : ''} ${problem ? 'has-issue' : ''}`}
                          >
                            <span className="mono receipt-tool-barcode">{t.barcode}</span>
                            <span className="receipt-tool-code">{t.code || '—'}</span>
                            <div className="receipt-tool-name">
                              <strong>{t.name}</strong>
                              {t.serialNumber && <small>S/N {t.serialNumber}</small>}
                              {t.maxUses && (
                                <small>
                                  {tr('Υπόλοιπο') + ' '}
                                  {remaining}/{t.maxUses}
                                </small>
                              )}
                            </div>
                            <span className="receipt-tool-manufacturer">{t.manufacturer || '—'}</span>
                            <div className="receipt-tool-state">
                              {problem ? (
                                toolIssues.map(i => (
                                  <span className="prep-issue-chip" key={i.id}>
                                    <TriangleAlert size={12} />
                                    {trData(i.type)}
                                  </span>
                                ))
                              ) : (
                                <span className="prep-ok-chip">{tr('Χωρίς απόκλιση')}</span>
                              )}
                            </div>
                            <button
                              className="tool-report-btn"
                              type="button"
                              onClick={() => openIssueReport('TOOL', t.id, 'Αποστείρωση · κατά την παραλαβή')}
                            >
                              <TriangleAlert size={14} /> {tr('Αναφορά')}
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  </section>
                )}
              </div>
            </div>

            <div className="modal-actions receipt-final-bar receipt-final-actions-only">
              <button onClick={closeReceipt}>{tr('Ακύρωση')}</button>
              <button
                className="primary"
                disabled={!receiptIdentityValid || (visibleDeviation && !receiptDeviationRecorded)}
                onClick={confirmReceipt}
              >
                <UserRoundCheck size={16} /> {tr('Επιβεβαίωση φυσικής παραλαβής')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
