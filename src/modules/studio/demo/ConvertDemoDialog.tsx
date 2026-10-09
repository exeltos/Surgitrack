import {useState} from 'react';
import {X} from 'lucide-react';
import AppButton from '../../../components/ui/AppButton';
import {tr} from '../../../i18n';
import type {DemoAccount} from '../../../core/demoAccounts';
import {organizationCode} from '../../../core/organizationCode';
import {trialEndAfter, trialEndDate, trialEndOn} from '../../../core/trial';
import type {DemoConversion} from '../../../data/cloud/demoAccounts';

/**
 * The prospect became a customer: their Demo turns into their hospital, under its real name and a
 * new code, in standard use or on a trial, and with a clean start or the Demo's records.
 */
export default function ConvertDemoDialog({
  demo,
  onClose,
  onConvert,
}: {
  demo: DemoAccount;
  onClose: () => void;
  onConvert: (conversion: DemoConversion) => void;
}) {
  const [name, setName] = useState(demo.hospitalName);
  const [code, setCode] = useState(() => organizationCode(demo.hospitalName));
  const [plan, setPlan] = useState<'STANDARD' | 'TRIAL'>('STANDARD');
  const [endDate, setEndDate] = useState(trialEndDate(trialEndAfter(30)));
  const [keepData, setKeepData] = useState(false);
  const future = !!endDate && Date.parse(trialEndOn(endDate)) > Date.now();
  const ready = name.trim().length >= 2 && /^[A-Za-z0-9-]{2,20}$/.test(code.trim()) && (plan === 'STANDARD' || future);
  return (
    <div className="studio-drawer-backdrop" onMouseDown={e => e.currentTarget === e.target && onClose()}>
      <aside className="studio-drawer" aria-label={tr('Μετατροπή σε πελάτη')}>
        <header>
          <div>
            <span className="eyebrow">{tr('DEMO ΑΞΙΟΛΟΓΗΣΗΣ')}</span>
            <h2>{tr('Μετατροπή σε πελάτη')}</h2>
          </div>
          <button onClick={onClose} aria-label={tr('Κλείσιμο')}>
            <X />
          </button>
        </header>
        <div className="studio-drawer-form">
          <small>
            {tr(
              'Το Demo γίνεται το νοσοκομείο του πελάτη. Οι χρήστες και τα τμήματά του μένουν· οι συνάδελφοι συνεχίζουν με τους ίδιους λογαριασμούς.',
            )}
          </small>
          <label>
            {tr('Όνομα νοσοκομείου')}
            <input autoFocus value={name} onChange={e => setName(e.target.value)} />
          </label>
          <label>
            {tr('Κωδικός νοσοκομείου')}
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} />
          </label>
          <fieldset className="studio-convert-choice">
            <legend>{tr('Χρήση')}</legend>
            <label>
              <input type="radio" checked={plan === 'STANDARD'} onChange={() => setPlan('STANDARD')} />
              {tr('Κανονική χρήση')}
            </label>
            <label>
              <input type="radio" checked={plan === 'TRIAL'} onChange={() => setPlan('TRIAL')} />
              {tr('Δοκιμαστική περίοδος')}
            </label>
            {plan === 'TRIAL' && (
              <label>
                {tr('Λήγει στις')}
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                {!!endDate && !future && (
                  <small className="studio-field-error">{tr('Η λήξη πρέπει να είναι μελλοντική.')}</small>
                )}
              </label>
            )}
          </fieldset>
          <fieldset className="studio-convert-choice">
            <legend>{tr('Δεδομένα')}</legend>
            <label>
              <input type="radio" checked={!keepData} onChange={() => setKeepData(false)} />
              <span>
                <b>{tr('Καθαρό ξεκίνημα')}</b>
                <small>{tr('Διαγράφονται τα δοκιμαστικά δεδομένα· μένουν οι χρήστες και τα τμήματα.')}</small>
              </span>
            </label>
            <label>
              <input type="radio" checked={keepData} onChange={() => setKeepData(true)} />
              <span>
                <b>{tr('Διατήρηση δεδομένων')}</b>
                <small>{tr('Το νοσοκομείο συνεχίζει με ό,τι είχε το Demo.')}</small>
              </span>
            </label>
          </fieldset>
        </div>
        <footer>
          <AppButton onClick={onClose}>{tr('Ακύρωση')}</AppButton>
          <AppButton
            variant="primary"
            disabled={!ready}
            onClick={() =>
              onConvert({
                name: name.trim(),
                code: code.trim().toUpperCase(),
                plan,
                trialEndsAt: plan === 'TRIAL' ? trialEndOn(endDate) : undefined,
                keepData,
              })
            }
          >
            {tr('Μετατροπή')}
          </AppButton>
        </footer>
      </aside>
    </div>
  );
}
