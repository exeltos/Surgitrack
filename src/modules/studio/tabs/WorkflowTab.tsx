import {RefreshCcw, ShieldCheck, CheckCircle2} from 'lucide-react';
import AppButton from '../../../components/ui/AppButton';
import type {StudioPageState} from '../useStudioPage';

export default function WorkflowTab({s}: {s: StudioPageState}) {
  const {L, currentUser, handleResetSterilizationWorkflow, lang, libs, tab} = s;
  return (
    <>
      {tab === 'WORKFLOW' && (
        <div className="studio-workflow-page">
          <section className="studio-workflow-hero">
            <div>
              <span className="eyebrow">{L('ΡΟΗ ΕΡΓΑΣΙΑΣ CSSD', 'CSSD WORKFLOW')}</span>
              <h2>{L('Ροή επανεπεξεργασίας', 'Reprocessing workflow')}</h2>
              <p>
                {L(
                  'Το κάθε νοσοκομείο επιλέγει ποια στάδια θα αποτελούν υποχρεωτικό σημείο ελέγχου. Τα απενεργοποιημένα στάδια παρακάμπτονται αυτόματα χωρίς να χάνεται η ιχνηλασιμότητα.',
                  'Each hospital chooses which stages are explicit control gates. Disabled stages are skipped automatically without losing traceability.',
                )}
              </p>
            </div>
            <div className="studio-workflow-profile">
              <small>{L('Προφίλ μονάδας', 'Facility profile')}</small>
              <input
                defaultValue={libs.sterilizationWorkflow.profileName}
                onBlur={e => {
                  const name = e.target.value.trim();
                  if (name && name !== libs.sterilizationWorkflow.profileName)
                    libs.updateSterilizationWorkflow({profileName: name}, currentUser.name, 'Μετονομασία προφίλ ροής');
                }}
              />
              <span>v{libs.sterilizationWorkflow.version}</span>
            </div>
          </section>
          <div className="studio-workflow-side">
            <section className="studio-workflow-policy">
              <ShieldCheck size={19} />
              <div>
                <strong>{L('Ασφαλής βασικός κορμός', 'Protected core workflow')}</strong>
                <span>
                  {L(
                    'Παραλαβή, Αποστείρωση και Παράδοση αποτελούν βασικά σημεία chain of custody και παραμένουν ενεργά. Τα ενδιάμεσα quality gates προσαρμόζονται ανά νοσοκομείο.',
                    'Receipt, Sterilization and Delivery are protected chain-of-custody milestones. Intermediate quality gates can be configured per hospital.',
                  )}
                </span>
              </div>
            </section>
            <section className="studio-release-policy">
              <header>
                <ShieldCheck size={18} />
                <div>
                  <strong>{L('Πολιτική παραλαβής', 'Receipt policy')}</strong>
                  <span>
                    {L(
                      'Η βασική παραλαβή παραμένει γρήγορη. Η καταμέτρηση Σετ ενεργοποιείται μόνο αν απαιτείται από την πολιτική της μονάδας.',
                      'Keep routine receipt fast. Set counting is enabled only when required by facility policy.',
                    )}
                  </span>
                </div>
              </header>
              <div className="studio-release-policy-grid">
                <label>
                  <input
                    type="checkbox"
                    checked={libs.sterilizationWorkflow.receiptPolicy?.countSetsAtReceipt ?? false}
                    onChange={e =>
                      libs.updateSterilizationWorkflow({
                        receiptPolicy: {
                          ...(libs.sterilizationWorkflow.receiptPolicy || {
                            countSetsAtReceipt: false,
                            allowCrossDepartmentHandover: true,
                          }),
                          countSetsAtReceipt: e.target.checked,
                        },
                      })
                    }
                  />
                  <span>
                    <b>{L('Καταμέτρηση Σετ κατά την παραλαβή', 'Count sets at receipt')}</b>
                    <small>
                      {L(
                        'Εμφανίζει μόνο αναμενόμενα / παραληφθέντα τεμάχια. Δεν αντικαθιστά τον Έλεγχο & Σύνθεση.',
                        'Shows expected / received quantity only. It does not replace Inspection & Assembly.',
                      )}
                    </small>
                  </span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={libs.sterilizationWorkflow.receiptPolicy?.allowCrossDepartmentHandover ?? true}
                    onChange={e =>
                      libs.updateSterilizationWorkflow({
                        receiptPolicy: {
                          ...(libs.sterilizationWorkflow.receiptPolicy || {
                            countSetsAtReceipt: false,
                            allowCrossDepartmentHandover: true,
                          }),
                          allowCrossDepartmentHandover: e.target.checked,
                        },
                      })
                    }
                  />
                  <span>
                    <b>{L('Ελεγχόμενη παραλαβή από άλλο τμήμα', 'Controlled cross-department handover')}</b>
                    <small>
                      {L(
                        'Επιτρέπεται μόνο με προειδοποίηση και υποχρεωτική αιτιολόγηση.',
                        'Allowed only with warning and mandatory justification.',
                      )}
                    </small>
                  </span>
                </label>
              </div>
            </section>
            <section className="studio-release-policy">
              <header>
                <ShieldCheck size={18} />
                <div>
                  <strong>{L('Πολιτική αποδέσμευσης φορτίου', 'Load release policy')}</strong>
                  <span>
                    {L(
                      'Αρκεί ένας επιτυχής δείκτης (χημικός ή βιολογικός)· ανεπιτυχής δείκτης στέλνει όλο το φορτίο σε επανεπεξεργασία. Εδώ ορίζετε αν απαιτείται συγκεκριμένος.',
                      'One passed indicator (chemical or biological) is enough; a failed one sends the whole load back. Here you set whether a specific one is required.',
                    )}
                  </span>
                </div>
              </header>
              <div className="studio-release-policy-grid">
                <label>
                  <input
                    type="checkbox"
                    checked={libs.sterilizationWorkflow.releasePolicy?.requireChemicalIndicator ?? false}
                    onChange={e =>
                      libs.updateSterilizationWorkflow({
                        releasePolicy: {
                          ...(libs.sterilizationWorkflow.releasePolicy || {
                            requireChemicalIndicator: false,
                            biologicalIndicator: 'OPTIONAL',
                            allowReleaseWhileBiPending: false,
                          }),
                          requireChemicalIndicator: e.target.checked,
                        },
                      })
                    }
                  />
                  <span>
                    <b>{L('Υποχρεωτικός χημικός δείκτης', 'Chemical indicator required')}</b>
                    <small>
                      {L(
                        'Χωρίς αυτό αρκεί και μόνο ο βιολογικός. Με αυτό, η αποδέσμευση θέλει πάντα επιτυχή χημικό.',
                        'Without it the biological alone is enough. With it, release always needs a passed chemical one.',
                      )}
                    </small>
                  </span>
                </label>
                <label>
                  <span>
                    <b>{L('Βιολογικός δείκτης (BI)', 'Biological indicator (BI)')}</b>
                    <small>
                      {L(
                        'Ορίζεται σύμφωνα με την πολιτική του νοσοκομείου και τον τύπο κύκλου.',
                        'Defined by facility policy and cycle type.',
                      )}
                    </small>
                  </span>
                  <select
                    value={libs.sterilizationWorkflow.releasePolicy?.biologicalIndicator || 'OPTIONAL'}
                    onChange={e =>
                      libs.updateSterilizationWorkflow({
                        releasePolicy: {
                          ...(libs.sterilizationWorkflow.releasePolicy || {
                            requireChemicalIndicator: false,
                            biologicalIndicator: 'OPTIONAL',
                            allowReleaseWhileBiPending: false,
                          }),
                          biologicalIndicator: e.target.value as 'OPTIONAL' | 'REQUIRED' | 'NOT_REQUIRED',
                        },
                      })
                    }
                  >
                    <option value="OPTIONAL">{L('Κατά περίπτωση', 'As required')}</option>
                    <option value="REQUIRED">{L('Υποχρεωτικός', 'Required')}</option>
                    <option value="NOT_REQUIRED">
                      {L('Δεν χρησιμοποιείται ως release gate', 'Not a release gate')}
                    </option>
                  </select>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={libs.sterilizationWorkflow.releasePolicy?.allowReleaseWhileBiPending ?? false}
                    disabled={
                      (libs.sterilizationWorkflow.releasePolicy?.biologicalIndicator || 'OPTIONAL') === 'NOT_REQUIRED'
                    }
                    onChange={e =>
                      libs.updateSterilizationWorkflow({
                        releasePolicy: {
                          ...(libs.sterilizationWorkflow.releasePolicy || {
                            requireChemicalIndicator: false,
                            biologicalIndicator: 'OPTIONAL',
                            allowReleaseWhileBiPending: false,
                          }),
                          allowReleaseWhileBiPending: e.target.checked,
                        },
                      })
                    }
                  />
                  <span>
                    <b>{L('Επιτρέπεται αποδέσμευση με BI σε αναμονή', 'Allow release while BI is pending')}</b>
                    <small>
                      {L(
                        'Να ενεργοποιείται μόνο αν προβλέπεται από την εγκεκριμένη πολιτική της μονάδας.',
                        'Enable only when permitted by the facility approved policy.',
                      )}
                    </small>
                  </span>
                </label>
              </div>
            </section>
          </div>
          <div className="studio-workflow-main">
            <div className="studio-workflow-list">
              {libs.sterilizationWorkflow.stages.map((stage, index) => (
                <section key={stage.id} className={`studio-workflow-stage ${stage.enabled ? 'enabled' : 'disabled'}`}>
                  <div className="workflow-stage-index">{String(index + 1).padStart(2, '0')}</div>
                  <div className="workflow-stage-main">
                    <div>
                      <strong>{L(stage.labelEl, stage.labelEn)}</strong>
                      {stage.locked && <span className="workflow-core-chip">CORE</span>}
                    </div>
                    <p>{L(stage.descriptionEl, stage.descriptionEn)}</p>
                    <div className="workflow-check-preview">
                      {(lang === 'el' ? stage.checksEl : stage.checksEn).map(check => (
                        <span key={check}>
                          <CheckCircle2 size={14} />
                          {check}
                        </span>
                      ))}
                    </div>
                  </div>
                  <label className={`workflow-stage-toggle ${stage.locked ? 'locked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={stage.enabled}
                      disabled={stage.locked}
                      onChange={e => libs.setWorkflowStageEnabled(stage.id, e.target.checked, currentUser.name)}
                    />
                    <span></span>
                    <b>{stage.enabled ? L('Ενεργό', 'Active') : L('Παράκαμψη', 'Skipped')}</b>
                  </label>
                </section>
              ))}
            </div>
          </div>
          <details className="released-loads">
            <summary>
              {L('Ιστορικό εκδόσεων ροής', 'Workflow version history')} · {libs.workflowVersions.length}
            </summary>
            <div>
              {libs.workflowVersions.slice(0, 8).map(version => (
                <div key={version.id}>
                  <span>
                    <b>v{version.version}</b> · {version.profileName}
                    <small style={{display: 'block'}}>
                      {version.changeReason || L('Αλλαγή παραμετροποίησης', 'Configuration change')}
                    </small>
                  </span>
                  <span>
                    {version.changedBy} ·{' '}
                    {version.effectiveFrom
                      ? new Date(version.effectiveFrom).toLocaleString(lang === 'el' ? 'el-GR' : 'en-GB')
                      : L('Αρχική', 'Initial')}
                  </span>
                </div>
              ))}
            </div>
          </details>
          <footer className="studio-workflow-footer">
            <div>
              <strong>{L('Ενεργή διαδρομή', 'Active route')}</strong>
              <span>
                {libs.sterilizationWorkflow.stages
                  .filter(stage => stage.enabled)
                  .map(stage => L(stage.labelEl, stage.labelEn))
                  .join(' → ')}
              </span>
            </div>
            <AppButton onClick={handleResetSterilizationWorkflow}>
              <RefreshCcw size={16} />
              {L('Επαναφορά προτύπου', 'Reset template')}
            </AppButton>
          </footer>
        </div>
      )}
    </>
  );
}
