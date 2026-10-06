import {supabase} from '../../../lib/supabase';
import {ACCESS_REQUESTS_CHANGED} from '../../../data/cloud/accessRequests';
import {SUPERVISOR, wholeHospital, accountRole, functionError} from '../hospitalPeopleMeta';
import type {Request} from '../hospitalPeopleMeta';
import type {usePeopleState} from './usePeopleState';
import type {usePeopleData} from './usePeopleData';
import type {usePeopleView} from './usePeopleView';

export function usePeopleDecisions(
  p: ReturnType<typeof usePeopleState> & ReturnType<typeof usePeopleData> & ReturnType<typeof usePeopleView>,
) {
  const {L, changed, decisionFor, fail, setBusy, setNotice, showError} = p;

  const decide = async (r: Request, approve: boolean) => {
    const d = decisionFor(r);
    if (!approve && !window.confirm(L(`Απόρριψη του αιτήματος του ${r.full_name};`, `Reject ${r.full_name}?`))) return;
    const role = accountRole(d.role);
    // A hospital admin belongs to no department (the database enforces it too).
    const departmentId = wholeHospital(d.role) ? null : d.departmentId || null;
    setBusy(true);
    setNotice(null);
    if (approve && !r.user_id) {
      // The account is made now: the email carries the username and the link to set the password.
      const {data, error} = await supabase.functions.invoke<{
        ok?: boolean;
        user_id?: string;
        user_code?: string;
        emailed?: boolean;
        url?: string;
        error?: string;
      }>('invite-staff', {
        body: {
          approve_request: r.id,
          role,
          supervisor: d.role === SUPERVISOR,
          department_id: departmentId,
          redirect_to: window.location.origin,
        },
      });
      if (error || !data?.ok) {
        const reason = await functionError(error, data?.error);
        setBusy(false);
        setNotice({
          kind: 'error',
          text: /already|registered|exists/i.test(reason)
            ? L(`Το ${r.email} έχει ήδη λογαριασμό.`, `${r.email} already has an account.`)
            : L(`Η έγκριση δεν ολοκληρώθηκε: ${reason}`, `The approval did not go through: ${reason}`),
        });
        return;
      }
      if (d.role === SUPERVISOR && data.user_id)
        await supabase.functions.invoke('update-staff', {
          body: {user_id: data.user_id, name: r.full_name, email: r.email, supervisor: true},
        });
      setNotice(
        data.emailed
          ? {
              kind: 'ok',
              text: L(
                `Ο/Η ${r.full_name} εγκρίθηκε με όνομα χρήστη ${data.user_code}. Στάλθηκε email με το όνομα χρήστη και σύνδεσμο για να ορίσει κωδικό.`,
                `${r.full_name} was approved as ${data.user_code}. An email with the username and a link to set a password was sent.`,
              ),
            }
          : {
              kind: 'warn',
              text: L(
                `Ο/Η ${r.full_name} εγκρίθηκε με όνομα χρήστη ${data.user_code}, αλλά το email δεν στάλθηκε. Στείλτε του/της τον σύνδεσμο για να ορίσει κωδικό:`,
                `${r.full_name} was approved as ${data.user_code}, but the email was not sent. Send them the link to set a password:`,
              ),
              link: data.url,
            },
      );
      window.dispatchEvent(new Event(ACCESS_REQUESTS_CHANGED));
      setBusy(false);
      await changed();
      return;
    }
    // A rejection, or an older signup whose account already exists.
    const {error} = await supabase.rpc('hospital_decide_access_request', {
      p_request: r.id,
      p_approve: approve,
      p_role: approve ? role : null,
      p_department: approve ? departmentId : null,
      p_note: d.note || null,
    });
    if (!fail(error)) {
      const {data} = await supabase.functions.invoke<{emailed?: boolean}>('access-requests', {
        body: {action: 'notify-decision', request_id: r.id},
      });
      const emailed = !!data?.emailed;
      // Without email the admin must pass the username on in person.
      let code = '';
      if (approve && !emailed) {
        const {data: profile} = await supabase.from('profiles').select('user_code').eq('email', r.email).maybeSingle();
        code = (profile as {user_code?: string} | null)?.user_code || '';
      }
      setNotice({
        kind: approve && !emailed ? 'warn' : 'ok',
        text: approve
          ? emailed
            ? L(
                `Ο/Η ${r.full_name} εγκρίθηκε. Στάλθηκε email με το όνομα χρήστη.`,
                `${r.full_name} was approved. An email with the username was sent.`,
              )
            : L(
                `Ο/Η ${r.full_name} εγκρίθηκε, αλλά δεν στάλθηκε email. Ενημερώστε τον/την ότι μπορεί να συνδεθεί με όνομα χρήστη ${code || '—'} (ή το email του/της) και τον κωδικό που όρισε.`,
                `${r.full_name} was approved, but no email was sent. Tell them they can sign in with username ${code || '—'} (or their email) and the password they chose.`,
              )
          : L(`Το αίτημα του ${r.full_name} απορρίφθηκε.`, `${r.full_name}'s request was rejected.`),
      });
      window.dispatchEvent(new Event(ACCESS_REQUESTS_CHANGED));
      await changed();
    }
    setBusy(false);
  };

  /** Withdraws a signup invitation that was not filled in yet. */
  const cancelInvitation = async (r: Request) => {
    if (!window.confirm(L(`Ακύρωση της πρόσκλησης προς ${r.email};`, `Cancel the invitation to ${r.email}?`))) return;
    setBusy(true);
    const {data, error} = await supabase.functions.invoke<{ok?: boolean}>('access-requests', {
      body: {action: 'cancel-invite', request_id: r.id},
    });
    setBusy(false);
    if (error || !data?.ok) {
      showError(L('Η πρόσκληση δεν ακυρώθηκε.', 'The invitation was not cancelled.'));
      return;
    }
    setNotice({
      kind: 'ok',
      text: L(`Η πρόσκληση προς ${r.email} ακυρώθηκε.`, `The invitation to ${r.email} was cancelled.`),
    });
    await changed();
  };
  return {cancelInvitation, decide};
}
