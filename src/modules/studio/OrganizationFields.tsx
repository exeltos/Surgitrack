import type {ReactNode} from 'react';
import {tr, getI18nLang} from '../../i18n';
import {TRIAL_LENGTHS, trialEndAfter, trialEndDate} from '../../core/trial';
import {HOSPITAL_MODULES, type HospitalModule} from '../../core/hospitalModules';
import type {OrganizationForm} from './organizationForm';

/**
 * A hospital's name, code, use (standard or trial) and modules: the same fields when the platform owner creates or
 * edits a hospital in Studio and in the hospital's own Settings. Read-only for the hospital's admin, who sees what
 * the hospital has but cannot change it.
 */
export default function OrganizationFields({
  value,
  onChange,
  isNew = false,
  readOnly = false,
  autoFocus = false,
  split = false,
  children,
}: {
  value: OrganizationForm;
  onChange: (patch: Partial<OrganizationForm>) => void;
  isNew?: boolean;
  readOnly?: boolean;
  autoFocus?: boolean;
  /** Spread over a page: the hospital, its use and `children` on the left, its modules on the right. */
  split?: boolean;
  children?: ReactNode;
}) {
  const {name, code, plan, endDate, modules} = value;
  const en = getI18nLang() === 'en';
  const toggleModule = (id: HospitalModule) =>
    onChange({modules: modules.includes(id) ? modules.filter(m => m !== id) : [...modules, id]});
  const main = (
    <>
      <label>
        {tr('Ονομασία')}
        <input
          autoFocus={autoFocus}
          value={name}
          disabled={readOnly}
          onChange={e => onChange({name: e.target.value})}
        />
      </label>
      {!isNew ? (
        <label>
          {tr('Κωδικός')}
          <input value={code} disabled={readOnly} onChange={e => onChange({code: e.target.value.toUpperCase()})} />
        </label>
      ) : (
        <small className="studio-field-hint">{tr('Ο κωδικός του νοσοκομείου δημιουργείται αυτόματα.')}</small>
      )}
      <fieldset className="studio-plan" disabled={readOnly}>
        <legend>{tr('Χρήση')}</legend>
        <label className={plan === 'STANDARD' ? 'active' : ''}>
          <input type="radio" name="plan" checked={plan === 'STANDARD'} onChange={() => onChange({plan: 'STANDARD'})} />
          <span>
            <b>{tr('Κανονική χρήση')}</b>
            <small>{tr('Χωρίς λήξη.')}</small>
          </span>
        </label>
        <label className={plan === 'TRIAL' ? 'active' : ''}>
          <input type="radio" name="plan" checked={plan === 'TRIAL'} onChange={() => onChange({plan: 'TRIAL'})} />
          <span>
            <b>{tr('Δοκιμαστική περίοδος')}</b>
            <small>{tr('Άδειο νοσοκομείο με πραγματικά δεδομένα. Κλειδώνει στη λήξη μέχρι να το ανανεώσετε.')}</small>
          </span>
        </label>
      </fieldset>
      {plan === 'TRIAL' && (
        <div className="studio-trial-length">
          <span>{tr('Διάρκεια')}</span>
          {!readOnly && (
            <div>
              {TRIAL_LENGTHS.map(days => (
                <button
                  key={days}
                  type="button"
                  className={endDate === trialEndDate(trialEndAfter(days)) ? 'active' : ''}
                  onClick={() => onChange({endDate: trialEndDate(trialEndAfter(days))})}
                >
                  {tr('{0} ημέρες', days)}
                </button>
              ))}
            </div>
          )}
          <label>
            {tr('Λήγει στις')}
            <input
              type="date"
              value={endDate}
              disabled={readOnly}
              onChange={e => onChange({endDate: e.target.value})}
            />
          </label>
        </div>
      )}
    </>
  );
  const modulesField = (
    <fieldset className="studio-plan org-modules" disabled={readOnly}>
      <legend>{tr('Ενότητες')}</legend>
      {HOSPITAL_MODULES.map(m => (
        <label key={m.id} className={modules.includes(m.id) ? 'active' : ''}>
          <input type="checkbox" checked={modules.includes(m.id)} onChange={() => toggleModule(m.id)} />
          <span>
            <b>{en ? m.en : m.el}</b>
            <small>{en ? m.descriptionEn : m.descriptionEl}</small>
          </span>
        </label>
      ))}
    </fieldset>
  );
  return split ? (
    <div className="org-split">
      <div className="org-main">
        {main}
        {children}
      </div>
      {modulesField}
    </div>
  ) : (
    <>
      {main}
      {modulesField}
      {children}
    </>
  );
}
