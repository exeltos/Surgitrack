import {useState} from 'react';
import {RefreshCcw, ShieldCheck, CheckCircle2, WashingMachine, Lock, X} from 'lucide-react';
import AppButton from '../../../components/ui/AppButton';
import type {StudioPageState} from '../useStudioPage';
import {useSurgi} from '../../../store/SurgiStore';
import {workflowStageState, type WorkflowStageConfig} from '../../../core/workflow';
import type {AssetState} from '../../../types/domain';
import {formatDateTime} from '../../../core/displayDate';

export default function WorkflowTab({s}: {s: StudioPageState}) {
  const {L, currentUser, handleResetSterilizationWorkflow, lang, libs, tab} = s;
  const receiptPolicy = libs.sterilizationWorkflow.receiptPolicy || {
    countSetsAtReceipt: false,
    allowCrossDepartmentHandover: true,
  };
  const setReceiptPolicy = (patch: Partial<typeof receiptPolicy>) =>
    libs.updateSterilizationWorkflow({receiptPolicy: {...receiptPolicy, ...patch}});
  const {sets, tools, advanceStageItems} = useSurgi();
  // The page by category: the stages, the rules around them, or their history.
  const [group, setGroup] = useState<'STAGES' | 'POLICIES' | 'HISTORY'>('STAGES');
  const groups = [
    {id: 'STAGES' as const, label: L('Στάδια', 'Stages')},
    {id: 'POLICIES' as const, label: L('Κανόνες', 'Rules')},
    {id: 'HISTORY' as const, label: L('Ιστορικό & επαναφορά', 'History & reset')},
  ];
  /**
   * Turning a stage off: what is in it moves on to the next stage the hospital runs (after a confirmation),
   * so its tab empties; turning one on just takes effect for what comes next.
   */
  const coreStages = libs.sterilizationWorkflow.stages.filter(stage => stage.locked);
  const toggleStage = (stage: WorkflowStageConfig, enabled: boolean) => {
    const fromState = workflowStageState[stage.id] as AssetState;
    const count = enabled
      ? 0
      : sets.filter(a => a.state === fromState).length +
        tools.filter(t => t.mode === 'STANDALONE' && t.state === fromState).length;
    const stages = libs.sterilizationWorkflow.stages;
    const next = stages.slice(stages.findIndex(x => x.id === stage.id) + 1).find(x => x.enabled);
    if (!count || !next) {
      libs.setWorkflowStageEnabled(stage.id, enabled, currentUser.name);
      return;
    }
    s.setConfirm({
      title: L('Απενεργοποίηση σταδίου;', 'Turn the stage off?'),
      message: L(
        `Στο στάδιο «${stage.labelEl}» υπάρχουν ${count} αντικείμενα. Θα προχωρήσουν στο «${next.labelEl}» και η καρτέλα θα φύγει. Η μετακίνηση καταγράφεται στο ιστορικό.`,
        `${count} items are at “${stage.labelEn}”. They move on to “${next.labelEn}” and the tab goes away. The move is recorded in the history.`,
      ),
      action: () => {
        libs.setWorkflowStageEnabled(stage.id, false, currentUser.name);
        advanceStageItems(fromState, workflowStageState[next.id] as AssetState, stage.labelEl);
      },
    });
  };
  return (
    <>
      {tab === 'WORKFLOW' && (
        <div className="studio-workflow-page" data-group={group}>
          <div className="settings-categories" role="group" aria-label={L('Κατηγορίες ροής', 'Flow categories')}>
            {groups.map(g => (
              <button
                key={g.id}
                type="button"
                className={`settings-category ${group === g.id ? 'active' : ''}`}
                aria-pressed={group === g.id}
                onClick={() => setGroup(g.id)}
              >
                {g.label}
              </button>
            ))}
          </div>
          <div className="studio-workflow-side">
            {group === 'STAGES' && (
              <section className="studio-workflow-policy">
                <ShieldCheck size={19} />
                <div>
                  <strong>{L('Ασφαλής βασικός κορμός', 'Protected core workflow')}</strong>
                  {/* Named from the stages actually locked, so the note always matches the list. */}
                  <span>
                    {L(
                      `Τα βασικά στάδια (${coreStages.map(s => s.labelEl).join(', ')}) είναι πάντα ενεργά· τα υπόλοιπα τα ανοίγει ή τα κλείνει κάθε νοσοκομείο.`,
                      `The core stages (${coreStages.map(s => s.labelEn).join(', ')}) are always on; each hospital turns the others on or off.`,
                    )}
                  </span>
                </div>
              </section>
            )}
            {group === 'POLICIES' && (
              <>
                <section
                  className="studio-release-policy"
                  title={L(
                    'Αρκεί ένας επιτυχής δείκτης (χημικός ή βιολογικός)· ανεπιτυχής δείκτης στέλνει όλο το φορτίο σε επανεπεξεργασία.',
                    'One passed indicator (chemical or biological) is enough; a failed one sends the whole load back.',
                  )}
                >
                  <header>
                    <ShieldCheck size={18} />
                    <div>
                      <strong>{L('Πολιτική παραλαβής & παράδοσης', 'Receipt & delivery policy')}</strong>
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
                    <label>
                      <input
                        type="checkbox"
                        checked={receiptPolicy.allowCrossDepartmentDelivery ?? false}
                        onChange={e => setReceiptPolicy({allowCrossDepartmentDelivery: e.target.checked})}
                      />
                      <span>
                        <b>{L('Ελεγχόμενη παράδοση σε άλλο τμήμα', 'Controlled cross-department delivery')}</b>
                        <small>
                          {L(
                            'Παράδοση σε χρήστη άλλου τμήματος μόνο με προειδοποίηση και υποχρεωτική αιτιολόγηση.',
                            'Delivery to a user of another department only with warning and mandatory justification.',
                          )}
                        </small>
                      </span>
                    </label>
                    <ExemptDepartments
                      L={L}
                      departments={libs.departments}
                      receipt={receiptPolicy.receiptExemptDepartments || []}
                      delivery={receiptPolicy.deliveryExemptDepartments || []}
                      receiptOn={receiptPolicy.allowCrossDepartmentHandover ?? true}
                      deliveryOn={receiptPolicy.allowCrossDepartmentDelivery ?? false}
                      onChange={(receiptExemptDepartments, deliveryExemptDepartments) =>
                        setReceiptPolicy({receiptExemptDepartments, deliveryExemptDepartments})
                      }
                    />
                  </div>
                </section>
                <section className="studio-release-policy">
                  <header>
                    <WashingMachine size={18} />
                    <div>
                      <strong>{L('Πολιτική καθαρισμού', 'Washing policy')}</strong>
                      <span>
                        {L(
                          'Ο καθαρισμός γίνεται με φόρτωση πλυντηρίου: καταγράφονται πλυντήριο, κύκλος και πρόγραμμα για κάθε αντικείμενο.',
                          'Washing goes through a washer load: the washer, cycle and program are recorded for every item.',
                        )}
                      </span>
                    </div>
                  </header>
                  <div className="studio-release-policy-grid">
                    <label>
                      <input
                        type="checkbox"
                        checked={libs.sterilizationWorkflow.washingPolicy?.allowWithoutWasher ?? false}
                        onChange={e =>
                          libs.updateSterilizationWorkflow({washingPolicy: {allowWithoutWasher: e.target.checked}})
                        }
                      />
                      <span>
                        <b>{L('Επιτρέπεται καθαρισμός χωρίς πλυντήριο', 'Washing without a washer allowed')}</b>
                        <small>
                          {L(
                            'Για χειροκίνητο καθαρισμό: κάθε αντικείμενο προχωρά με τους ελέγχους του σταδίου, χωρίς πλυντήριο και κύκλο.',
                            'For manual cleaning: an item moves on with the stage checks, without a washer or cycle.',
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
                          (libs.sterilizationWorkflow.releasePolicy?.biologicalIndicator || 'OPTIONAL') ===
                          'NOT_REQUIRED'
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
              </>
            )}
          </div>
          {group === 'STAGES' && (
            <div className="studio-workflow-main">
              <div className="studio-workflow-list">
                {libs.sterilizationWorkflow.stages.map((stage, index) => (
                  <section key={stage.id} className={`studio-workflow-stage ${stage.enabled ? 'enabled' : 'disabled'}`}>
                    <div className="workflow-stage-index">{String(index + 1).padStart(2, '0')}</div>
                    <div className="workflow-stage-main">
                      <div>
                        <strong>{L(stage.labelEl, stage.labelEn)}</strong>
                        {stage.locked && (
                          <span
                            className="workflow-core-chip"
                            title={L('Βασικό στάδιο: δεν απενεργοποιείται', 'Core stage: cannot be turned off')}
                          >
                            <Lock size={11} aria-hidden="true" />
                            {L('Βασικό', 'Core')}
                          </span>
                        )}
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
                    {/* A core stage cannot be turned off: it says so instead of showing a switch that does nothing. */}
                    {stage.locked ? (
                      <span className="workflow-stage-always">
                        <Lock size={13} aria-hidden="true" />
                        {L('Πάντα ενεργό', 'Always on')}
                      </span>
                    ) : (
                      <label className="workflow-stage-toggle">
                        <input
                          type="checkbox"
                          checked={stage.enabled}
                          onChange={e => toggleStage(stage, e.target.checked)}
                        />
                        <span></span>
                        <b>{stage.enabled ? L('Ενεργό', 'Active') : L('Παράκαμψη', 'Skipped')}</b>
                      </label>
                    )}
                  </section>
                ))}
              </div>
            </div>
          )}
          {group === 'HISTORY' && (
            <section className="studio-history">
              <div className="studio-fact studio-fact-edit">
                <div>
                  <strong>{L('Όνομα της ροής', 'Name of the flow')}</strong>
                  <small>
                    {L(
                      'Το όνομα που φαίνεται στο ιστορικό. Τρέχουσα έκδοση: v',
                      'The name shown in the history. Current version: v',
                    )}
                    {libs.sterilizationWorkflow.version}
                  </small>
                </div>
                <input
                  aria-label={L('Όνομα της ροής', 'Name of the flow')}
                  // Older hospitals keep the first default name («… CSSD»); it reads without the acronym.
                  defaultValue={libs.sterilizationWorkflow.profileName.replace(/\s*CSSD$/, '')}
                  onBlur={e => {
                    const name = e.target.value.trim();
                    if (name && name !== libs.sterilizationWorkflow.profileName)
                      libs.updateSterilizationWorkflow(
                        {profileName: name},
                        currentUser.name,
                        'Μετονομασία προφίλ ροής',
                      );
                  }}
                />
              </div>
              <div className="studio-fact studio-fact-edit">
                <div>
                  <strong>{L('Επαναφορά αρχικής ροής', 'Restore the original flow')}</strong>
                  <small>
                    {L(
                      'Επαναφέρει όλα τα στάδια και τους κανόνες στην αρχική ροή. Οι αλλαγές καταγράφονται στο ιστορικό.',
                      'Restores all stages and rules to the original flow. The change is recorded in the history.',
                    )}
                  </small>
                </div>
                <AppButton onClick={handleResetSterilizationWorkflow}>
                  <RefreshCcw size={16} />
                  {L('Επαναφορά προτύπου', 'Reset template')}
                </AppButton>
              </div>
              <h3 className="studio-history-title">
                {L('Ιστορικό αλλαγών της ροής', 'History of changes to the flow')} · {libs.workflowVersions.length}
              </h3>
              <p className="studio-history-help">
                {L(
                  'Κάθε αλλαγή στα στάδια ή στους κανόνες γίνεται νέα έκδοση: τι άλλαξε, ποιος το έκανε και πότε.',
                  'Every change to the stages or rules becomes a new version: what changed, who did it and when.',
                )}
              </p>
              <ul className="studio-history-list">
                {libs.workflowVersions.slice(0, 20).map(version => (
                  <li key={version.id}>
                    <span>
                      <b>v{version.version}</b>{' '}
                      {version.changeReason || L('Αλλαγή παραμετροποίησης', 'Configuration change')}
                    </span>
                    <small>
                      {version.changedBy} ·{' '}
                      {version.effectiveFrom ? formatDateTime(version.effectiveFrom) : L('Αρχική', 'Initial')}
                    </small>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </>
  );
}

/**
 * The departments exempt from the department check, as a short list: only the exempt ones, each with the stage it is
 * exempt at (receipt, delivery). A department is added from the list of the rest; unticking both stages removes it.
 */
function ExemptDepartments({
  L,
  departments,
  receipt,
  delivery,
  receiptOn,
  deliveryOn,
  onChange,
}: {
  L: (el: string, en: string) => string;
  departments: Array<{id: string; el: string; en: string}>;
  receipt: string[];
  delivery: string[];
  /** Whether that stage's controlled handover is on: its column is greyed out otherwise, as its exemptions do not apply. */
  receiptOn: boolean;
  deliveryOn: boolean;
  onChange: (receipt: string[], delivery: string[]) => void;
}) {
  // Only the exemptions of the stages that are controlled count, so only those show.
  const exempt = departments.filter(
    d => (receiptOn && receipt.includes(d.el)) || (deliveryOn && delivery.includes(d.el)),
  );
  const rest = departments.filter(d => !exempt.includes(d));
  const toggle = (list: string[], dept: string, on: boolean) =>
    on ? [...list.filter(x => x !== dept), dept] : list.filter(x => x !== dept);
  if (!receiptOn && !deliveryOn) return null;
  return (
    <div className="studio-exempt">
      <div className="studio-exempt-head">
        <b>{L('Τμήματα χωρίς έλεγχο', 'Departments without the check')}</b>
        <small>
          {L(
            'Τα Σετ τους παραλαμβάνονται και παραδίδονται χωρίς υπογραφή· στην παραλαβή φαίνεται ποιος τα έστειλε ηλεκτρονικά.',
            'Their Sets are received and delivered without a signature; the receipt shows who sent them electronically.',
          )}
        </small>
      </div>
      {exempt.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>{L('Τμήμα', 'Department')}</th>
              <th className={receiptOn ? '' : 'off'}>{L('Παραλαβή', 'Receipt')}</th>
              <th className={deliveryOn ? '' : 'off'}>{L('Παράδοση', 'Delivery')}</th>
              <th aria-label={L('Αφαίρεση', 'Remove')} />
            </tr>
          </thead>
          <tbody>
            {exempt.map(d => (
              <tr key={d.id}>
                <td>{L(d.el, d.en)}</td>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`${L(d.el, d.en)} · ${L('Παραλαβή', 'Receipt')}`}
                    disabled={!receiptOn}
                    checked={receiptOn && receipt.includes(d.el)}
                    onChange={e => onChange(toggle(receipt, d.el, e.target.checked), delivery)}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`${L(d.el, d.en)} · ${L('Παράδοση', 'Delivery')}`}
                    disabled={!deliveryOn}
                    checked={deliveryOn && delivery.includes(d.el)}
                    onChange={e => onChange(receipt, toggle(delivery, d.el, e.target.checked))}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    aria-label={`${L('Αφαίρεση', 'Remove')} ${L(d.el, d.en)}`}
                    onClick={() => onChange(toggle(receipt, d.el, false), toggle(delivery, d.el, false))}
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rest.length > 0 && (
        <select
          aria-label={L('Προσθήκη τμήματος', 'Add a department')}
          value=""
          onChange={e => {
            const dept = e.target.value;
            if (dept) onChange(toggle(receipt, dept, receiptOn), toggle(delivery, dept, deliveryOn));
          }}
        >
          <option value="">{L('+ Προσθήκη τμήματος', '+ Add a department')}</option>
          {rest.map(d => (
            <option key={d.id} value={d.el}>
              {L(d.el, d.en)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
