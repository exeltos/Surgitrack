import {useState} from 'react';
import {BellRing} from 'lucide-react';
import AppButton from '../../../components/ui/AppButton';
import {supabase} from '../../../lib/supabase';
import type {PeopleState} from './usePeople';

const BATCH = 25;
type Resent = {sent?: Array<{user_code: string; emailed: boolean}>};

/**
 * The platform owner's reminder: everyone of the hospital who is active, has not yet signed in and set a password of
 * their own, and has an email of their own, is sent the instructions again (their username and what to do, no link).
 * Those with no email of their own (the account's address is a placeholder) cannot be reached this way.
 */
export default function PasswordReminder({s}: {s: PeopleState}) {
  const {L, members, organizationId, setNotice, changed} = s;
  const [asking, setAsking] = useState(false);
  const [running, setRunning] = useState(false);
  const waiting = members.filter(m => m.active && m.password_change_required && m.user_code);
  const reachable = waiting.filter(m => m.email && !m.email.toLowerCase().endsWith('.invalid'));
  if (!organizationId || waiting.length === 0) return null;

  const send = async () => {
    setRunning(true);
    setAsking(false);
    let sent = 0;
    let failed = 0;
    for (let from = 0; from < reachable.length; from += BATCH) {
      const batch = reachable.slice(from, from + BATCH);
      const {data, error} = await supabase.functions.invoke<Resent>('import-staff', {
        body: {organization_id: organizationId, resend: batch.map(m => m.user_code), reminder: true},
      });
      for (const m of batch) {
        if (!error && data?.sent?.find(x => x.user_code === m.user_code)?.emailed) sent += 1;
        else failed += 1;
      }
    }
    setRunning(false);
    setNotice({
      kind: failed ? 'warn' : 'ok',
      text: failed
        ? L(
            `Στάλθηκε υπενθύμιση σε ${sent} άτομα, σε ${failed} δεν στάλθηκε. Περιμένετε λίγο και δοκιμάστε ξανά.`,
            `Reminder sent to ${sent}, not sent to ${failed}. Wait a little and try again.`,
          )
        : L(`Στάλθηκε υπενθύμιση σε ${sent} άτομα.`, `Reminder sent to ${sent}.`),
    });
    await changed();
  };

  const noEmail = waiting.length - reachable.length;
  return (
    <div className="people-reminder">
      <BellRing size={16} />
      <span>
        {L(
          `${waiting.length} άτομα δεν έχουν ακόμη ορίσει δικό τους κωδικό`,
          `${waiting.length} people have not set a password of their own yet`,
        )}
        {noEmail > 0 && L(` (${noEmail} χωρίς προσωπικό email)`, ` (${noEmail} with no personal email)`)}.
      </span>
      {asking ? (
        <span className="people-reminder-ask">
          {L(`Να σταλεί υπενθύμιση σε ${reachable.length};`, `Send a reminder to ${reachable.length}?`)}
          <AppButton size="sm" variant="primary" disabled={running} onClick={() => void send()}>
            {L('Αποστολή', 'Send')}
          </AppButton>
          <AppButton size="sm" onClick={() => setAsking(false)}>
            {L('Άκυρο', 'Cancel')}
          </AppButton>
        </span>
      ) : (
        <AppButton size="sm" disabled={running || reachable.length === 0} onClick={() => setAsking(true)}>
          {running ? L('Αποστολή…', 'Sending…') : L('Αποστολή υπενθύμισης', 'Send reminder')}
        </AppButton>
      )}
    </div>
  );
}
