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
  const {L, changed, decisionFor, setBusy, setNotice, showError} = p;

  /**
   * Approval activates the account the person made at signup (role, department, supervisor) and
   * emails them once; rejection removes it and emails them once.
   */
  const decide = async (r: Request, approve: boolean) => {
    const d = decisionFor(r);
    if (!approve && !window.confirm(L(`Απόρριψη του αιτήματος του ${r.full_name};`, `Reject ${r.full_name}?`))) return;
    const role = accountRole(d.role);
    // A hospital admin belongs to no department (the database enforces it too).
    const departmentId = wholeHospital(d.role) ? null : d.departmentId || null;
    setBusy(true);
    setNotice(null);
    const {data, error} = await supabase.functions.invoke<{
      ok?: boolean;
      user_code?: string;
      emailed?: boolean;
      url?: string;
      error?: string;
    }>('invite-staff', {
      body: approve
        ? {
            approve_request: r.id,
            role,
            supervisor: d.role === SUPERVISOR,
            department_id: departmentId,
            redirect_to: window.location.origin,
          }
        : {reject_request: r.id, note: d.note || null, redirect_to: window.location.origin},
    });
    setBusy(false);
    if (error || !data?.ok) {
      const reason = await functionError(error, data?.error);
      setNotice({
        kind: 'error',
        text: approve
          ? L(`Η έγκριση δεν ολοκληρώθηκε: ${reason}`, `The approval did not go through: ${reason}`)
          : L(`Η απόρριψη δεν ολοκληρώθηκε: ${reason}`, `The rejection did not go through: ${reason}`),
      });
      return;
    }
    const code = data.user_code || r.user_code || '';
    setNotice(
      approve
        ? data.emailed
          ? {
              kind: 'ok',
              text: L(
                `Ο/Η ${r.full_name} εγκρίθηκε (όνομα χρήστη ${code}) και ενημερώθηκε με email. Συνδέεται με τον κωδικό που όρισε.`,
                `${r.full_name} was approved (username ${code}) and told by email. They sign in with the password they set.`,
              ),
            }
          : {
              kind: 'warn',
              text: L(
                `Ο/Η ${r.full_name} εγκρίθηκε, αλλά το email δεν στάλθηκε. Ενημερώστε τον/την ότι μπορεί να συνδεθεί με όνομα χρήστη ${code} (ή το email του/της) και τον κωδικό που όρισε.`,
                `${r.full_name} was approved, but the email was not sent. Tell them they can sign in with username ${code} (or their email) and the password they set.`,
              ),
              link: data.url,
            }
        : {kind: 'ok', text: L(`Το αίτημα του ${r.full_name} απορρίφθηκε.`, `${r.full_name}'s request was rejected.`)},
    );
    window.dispatchEvent(new Event(ACCESS_REQUESTS_CHANGED));
    await changed();
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
