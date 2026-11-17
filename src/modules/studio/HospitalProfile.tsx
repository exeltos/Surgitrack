import {useEffect, useState} from 'react';
import AppButton from '../../components/ui/AppButton';
import {tr} from '../../i18n';
import {useLibraries, type Organization} from '../../core/LibraryStore';
import type {HospitalDetails} from '../../core/libraryTypes';
import {trialEndOn} from '../../core/trial';
import {getRealIdentity, productionOrganizationFor} from '../../data/cloud/identity';
import {getCloudOrganizationId} from '../../data/cloud/appRecords';
import {loadHospital, saveHospital} from '../../data/cloud/hospitalProfile';
import {announceHospitalChange} from '../../data/cloud/modulesContext';
import {askConfirm, tellUser} from '../../components/ui/confirmService';
import {useSurgi} from '../../store/SurgiStore';
import {workflowStageState, type WorkflowStageId} from '../../core/workflow';
import type {AssetState} from '../../types/domain';
import {getI18nLang} from '../../i18n';
import OrganizationFields from './OrganizationFields';
import {organizationForm, type OrganizationForm} from './organizationForm';

/**
 * Settings → Hospital: everything about the open hospital in one place, in the same form as Studio → Hospitals.
 * The platform owner sets its name, code, use, modules and sterilization stages here without leaving it; the
 * hospital's admin sees only the hospital's own details (address, phone, email, contact person), which they keep.
 */
export default function HospitalProfile({actor}: {actor: string}) {
  const libs = useLibraries();
  const demo = libs.dataMode === 'DEMO';
  const real = getRealIdentity();
  // The owner (or local development, signed in as no one); a hospital's admin sees the owner's part read-only.
  const owner = !real || !!real.platform;
  const [org, setOrg] = useState<Organization>();
  const [form, setForm] = useState<OrganizationForm>(() => organizationForm());
  const [details, setDetails] = useState<HospitalDetails>(libs.systemSettings.hospitalDetails || {});
  const [saving, setSaving] = useState(false);
  const {sets, tools, advanceStageItems} = useSurgi();
  const stages = libs.sterilizationWorkflow.stages;
  // The stages as the owner leaves them on screen; applied with the rest on «Save».
  const [stageOn, setStageOn] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(stages.map(st => [st.id, st.enabled])),
  );
  const en = getI18nLang() === 'en';

  useEffect(() => {
    let alive = true;
    const pick = async () => {
      if (demo) {
        const id = getCloudOrganizationId();
        return libs.organizations.find(o => o.id === id) || libs.organizations[0];
      }
      const id = real ? productionOrganizationFor(real) : undefined;
      return id ? await loadHospital(id) : libs.organizations[0];
    };
    void pick().then(found => {
      if (!alive || !found) return;
      setOrg(found);
      setForm(organizationForm(found));
    });
    return () => {
      alive = false;
    };
    // Once per opening: the form then holds what is being edited.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setDetail = (key: keyof HospitalDetails, value: string) => setDetails(d => ({...d, [key]: value}));
  const ready = !!form.name.trim() && !!form.code.trim() && (form.plan === 'STANDARD' || !!form.endDate);

  /**
   * The stages turned on or off: what waits in a stage turned off moves on to the next stage the hospital runs
   * (after one confirmation naming them), so nothing is left in a tab that went away. False when not confirmed.
   */
  const applyStages = async () => {
    const changed = stages.filter(st => !st.locked && (stageOn[st.id] ?? st.enabled) !== st.enabled);
    if (!changed.length) return true;
    const finalOn = (id: string) => stageOn[id] ?? stages.find(st => st.id === id)?.enabled;
    const moves = changed
      .filter(st => !finalOn(st.id))
      .map(st => {
        const from = workflowStageState[st.id] as AssetState;
        const count =
          sets.filter(a => a.state === from).length +
          tools.filter(t => t.mode === 'STANDALONE' && t.state === from).length;
        const next = stages.slice(stages.findIndex(x => x.id === st.id) + 1).find(x => finalOn(x.id));
        return {stage: st, from, count, next};
      })
      .filter(m => m.count && m.next);
    if (moves.length) {
      const answer = await askConfirm({
        title: tr('Απενεργοποίηση σταδίου;'),
        message: moves
          .map(m =>
            tr(
              '«{0}»: {1} αντικείμενα προχωρούν στο «{2}».',
              en ? m.stage.labelEn : m.stage.labelEl,
              m.count,
              en ? m.next!.labelEn : m.next!.labelEl,
            ),
          )
          .join('\n'),
      });
      if (answer === false) return false;
    }
    for (const st of changed) libs.setWorkflowStageEnabled(st.id as WorkflowStageId, !!finalOn(st.id), actor);
    for (const m of moves) advanceStageItems(m.from, workflowStageState[m.next!.id] as AssetState, m.stage.labelEl);
    return true;
  };

  const save = async () => {
    setSaving(true);
    try {
      libs.updateSystemSettings(
        {
          hospitalDetails: Object.fromEntries(
            Object.entries(details).map(([k, v]) => [k, (v || '').trim() || undefined]),
          ) as HospitalDetails,
        },
        actor,
      );
      if (owner && org) {
        const data = {
          name: form.name.trim(),
          code: form.code.trim(),
          plan: form.plan,
          trialEndsAt: form.plan === 'TRIAL' ? trialEndOn(form.endDate) : undefined,
          modules: form.modules,
        };
        if (demo || !real) libs.updateOrganization(org.id, data);
        else {
          const error = await saveHospital(org, data);
          if (error) {
            await tellUser(tr('Δεν αποθηκεύτηκε'), error);
            return;
          }
        }
        setOrg({...org, ...data});
        announceHospitalChange({modules: data.modules, plan: data.plan, trialEndsAt: data.trialEndsAt});
        if (!(await applyStages())) return;
      }
      await tellUser(tr('Αποθηκεύτηκε'), tr('Τα στοιχεία του νοσοκομείου αποθηκεύτηκαν.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="hospital-profile">
      <div className="studio-drawer-form">
        {owner &&
          (org ? (
            <>
              <OrganizationFields value={form} onChange={patch => setForm(f => ({...f, ...patch}))} />
              <fieldset className="studio-plan">
                <legend>{tr('Στάδια αποστείρωσης')}</legend>
                {stages.map(st => {
                  const on = st.locked || (stageOn[st.id] ?? st.enabled);
                  return (
                    <label key={st.id} className={on ? 'active' : ''}>
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={st.locked}
                        onChange={e => setStageOn(v => ({...v, [st.id]: e.target.checked}))}
                      />
                      <span>
                        <b>
                          {en ? st.labelEn : st.labelEl}
                          {st.locked && <em className="hospital-stage-core">{tr('Βασικό · πάντα ενεργό')}</em>}
                        </b>
                        <small>{en ? st.descriptionEn : st.descriptionEl}</small>
                      </span>
                    </label>
                  );
                })}
              </fieldset>
            </>
          ) : (
            <small className="studio-field-hint">{tr('Φόρτωση…')}</small>
          ))}
        <fieldset className="hospital-details">
          <legend>{tr('Στοιχεία επικοινωνίας')}</legend>
          <label>
            {tr('Διεύθυνση')}
            <input value={details.address || ''} onChange={e => setDetail('address', e.target.value)} />
          </label>
          <label>
            {tr('Τηλέφωνο')}
            <input type="tel" value={details.phone || ''} onChange={e => setDetail('phone', e.target.value)} />
          </label>
          <label>
            Email
            <input type="email" value={details.email || ''} onChange={e => setDetail('email', e.target.value)} />
          </label>
          <label>
            {tr('Υπεύθυνος επικοινωνίας')}
            <input value={details.contactName || ''} onChange={e => setDetail('contactName', e.target.value)} />
          </label>
        </fieldset>
      </div>
      <footer>
        <AppButton variant="primary" disabled={saving || (owner && !!org && !ready)} onClick={() => void save()}>
          {tr('Αποθήκευση')}
        </AppButton>
      </footer>
    </section>
  );
}
