import {supabase} from '../../../lib/supabase';
import {SUPERVISOR, wholeHospital, accountRole, functionError} from '../hospitalPeopleMeta';
import type {Member, Draft, InviteResult} from '../hospitalPeopleMeta';
import type {usePeopleState} from './usePeopleState';
import type {usePeopleData} from './usePeopleData';
import type {usePeopleView} from './usePeopleView';
import type {usePeopleDecisions} from './usePeopleDecisions';
import type {usePeopleDepartments} from './usePeopleDepartments';
import {askConfirm} from '../../../components/ui/confirmService';

export function usePeopleMembers(
  p: ReturnType<typeof usePeopleState> &
    ReturnType<typeof usePeopleData> &
    ReturnType<typeof usePeopleView> &
    ReturnType<typeof usePeopleDecisions> &
    ReturnType<typeof usePeopleDepartments>,
) {
  const {L, changed, demo, departmentLabel, libs, members, organizationId, platform, setBusy, setDrawer, setNotice} = p;

  /**
   * Invites one person: a personal link to the signup form (valid 7 days), emailed or, with
   * `send` false, only returned to pass on by hand. They fill in their details and set their
   * password; the request then waits here for approval. `again` sends a waiting invitation once
   * more (an older account made at once gets its accept link again).
   */
  const invite = async (draft: Draft, again = false, send = true) => {
    const role = accountRole(draft.role);
    const supervisor = draft.role === SUPERVISOR;
    if (demo) {
      libs.addUser({
        name: draft.name,
        email: draft.email,
        role,
        supervisor,
        department: departmentLabel(draft.role, draft.departmentId),
        active: true,
        organizationId: organizationId || '',
        demoEnabled: role === 'ADMIN' || draft.demoEnabled,
      });
      setDrawer(null);
      setNotice({kind: 'ok', text: L(`Ο/Η ${draft.name} προστέθηκε.`, `${draft.name} was added.`)});
      return;
    }
    // An older account made at once (not accepted yet) is sent its accept link again.
    const direct = again && members.some(m => m.email.toLowerCase() === draft.email.toLowerCase());
    setBusy(true);
    setNotice(null);
    const {data: result, error} = await supabase.functions.invoke<{results?: InviteResult[]}>('invite-staff', {
      body: {
        users: [
          {
            full_name: draft.name,
            email: draft.email,
            organization_id: organizationId,
            department_id: wholeHospital(role) ? null : draft.departmentId || null,
            role,
            supervisor,
            direct,
          },
        ],
        again,
        send_email: send,
        redirect_to: window.location.origin,
      },
    });
    const r = result?.results?.[0];
    const sent = !error && !!r?.ok;
    if (sent && r?.mode === 'account' && (supervisor || (platform && draft.demoEnabled))) {
      // The invitation knows only the role; the supervisor flag and Demo access follow on the account.
      const {data: profile} = await supabase
        .from('profiles')
        .select('id')
        .eq('organization_id', organizationId)
        .ilike('email', draft.email.trim().replace(/[\\%_]/g, '\\$&'))
        .maybeSingle();
      if (profile)
        await supabase.functions.invoke('update-staff', {
          body: {
            user_id: (profile as {id: string}).id,
            name: draft.name,
            email: draft.email,
            supervisor,
            ...(platform ? {demo_enabled: draft.demoEnabled} : {}),
          },
        });
    }
    setBusy(false);
    if (!sent || !r) {
      const reason = await functionError(error, r?.error);
      setNotice({
        kind: 'error',
        text: /already registered|exists/i.test(reason)
          ? L(
              `Το ${draft.email} έχει ήδη λογαριασμό που έχει ενεργοποιηθεί. Δεν χρειάζεται πρόσκληση.`,
              `${draft.email} already has an activated account. No invitation is needed.`,
            )
          : /demo user limit/i.test(reason)
            ? L(
                'Το Demo έχει φτάσει το όριο συναδέλφων. Για περισσότερους, επικοινωνήστε μαζί μας.',
                'The Demo has reached its colleague limit. For more, contact us.',
              )
            : /waiting for approval/i.test(reason)
              ? L(
                  `Το ${draft.email} έχει ήδη στείλει τα στοιχεία του και περιμένει έγκριση εδώ.`,
                  `${draft.email} has already sent their details and waits for approval here.`,
                )
              : L(`Η πρόσκληση δεν στάλθηκε: ${reason}`, `The invitation was not sent: ${reason}`),
      });
      return;
    }
    setDrawer(null);
    if (r.mode === 'signup' && !send) {
      // Copied for the admin to pass on (Viber, SMS, …); shown as well in case the copy is blocked.
      void navigator.clipboard?.writeText(r.url || '').catch(() => undefined);
      setNotice({
        kind: 'ok',
        text: L(
          `Ο σύνδεσμος εγγραφής για το ${draft.email} αντιγράφηκε (ισχύει 7 ημέρες). Στείλτε τον όπως θέλετε· μόλις κάνει εγγραφή, το αίτημα εμφανίζεται εδώ για έγκριση.`,
          `The signup link for ${draft.email} was copied (valid 7 days). Send it any way you like; once they sign up, the request shows here for approval.`,
        ),
        link: r.url,
      });
    } else if (!r.emailed) {
      setNotice({
        kind: 'warn',
        text:
          r.mode === 'signup'
            ? L(
                `Η πρόσκληση για το ${draft.email} ετοιμάστηκε, αλλά το email δεν στάλθηκε. Στείλτε του αυτόν τον σύνδεσμο εγγραφής:`,
                `The invitation for ${draft.email} is ready, but the email was not sent. Send them this signup link:`,
              )
            : L(
                `Ο λογαριασμός ${r.user_code || ''} ετοιμάστηκε, αλλά το email δεν στάλθηκε. Στείλτε του αυτόν τον σύνδεσμο για να ορίσει κωδικό:`,
                `Account ${r.user_code || ''} is ready, but the email was not sent. Send them this link to set a password:`,
              ),
        link: r.url,
      });
    } else
      setNotice({
        kind: 'ok',
        text:
          r.mode === 'signup'
            ? L(
                `Στάλθηκε πρόσκληση στο ${draft.email}. Μόλις κάνει εγγραφή, το αίτημα εμφανίζεται εδώ για έγκριση.`,
                `An invitation was sent to ${draft.email}. Once they sign up, the request shows here for approval.`,
              )
            : L(
                `Η πρόσκληση στάλθηκε ξανά στο ${draft.email}. Ζητήστε να ελέγξει και τα ανεπιθύμητα (spam).`,
                `The invitation was sent again to ${draft.email}. Ask them to check their spam folder too.`,
              ),
      });
    await changed();
  };

  /** Saves an existing user: name, sign-in email, role, department, access (and Demo, for the owner). */
  const save = async (member: Member, draft: Draft) => {
    const role = accountRole(draft.role);
    const supervisor = draft.role === SUPERVISOR;
    if (demo) {
      libs.updateUser(member.id, {
        name: draft.name,
        email: draft.email,
        role,
        supervisor,
        active: draft.active,
        department: departmentLabel(draft.role, draft.departmentId),
        demoEnabled: role === 'ADMIN' || draft.demoEnabled,
      });
      setDrawer(null);
      setNotice({
        kind: 'ok',
        text: L(`Τα στοιχεία του ${draft.name} αποθηκεύτηκαν.`, `${draft.name}'s details were saved.`),
      });
      return;
    }
    setBusy(true);
    setNotice(null);
    const {data, error} = await supabase.functions.invoke<{ok?: boolean}>('update-staff', {
      body: {
        user_id: member.id,
        name: draft.name,
        email: draft.email,
        role,
        supervisor,
        department_id: wholeHospital(role) ? null : draft.departmentId || null,
        active: draft.active,
        ...(platform ? {demo_enabled: draft.demoEnabled} : {}),
      },
    });
    setBusy(false);
    if (error || !data?.ok) {
      const status = (error as {context?: {status?: number}} | null)?.context?.status;
      setNotice({
        kind: 'error',
        text:
          status === 409
            ? L('Το email χρησιμοποιείται ήδη από άλλον λογαριασμό.', 'That email is already used by another account.')
            : status === 400
              ? L('Ελέγξτε το ονοματεπώνυμο και το email.', 'Check the name and the email.')
              : L('Οι αλλαγές δεν αποθηκεύτηκαν.', 'The changes were not saved.'),
      });
      return;
    }
    setDrawer(null);
    setNotice({
      kind: 'ok',
      text: L(`Τα στοιχεία του ${draft.name} αποθηκεύτηκαν.`, `${draft.name}'s details were saved.`),
    });
    await changed();
  };

  /** Emails a user a link to set a new password (the same email as «Ξέχασα τον κωδικό»). */
  const passwordReset = async (m: Member) => {
    // Demo users have no real accounts: the button shows what would happen.
    if (demo) {
      setDrawer(null);
      setNotice({
        kind: 'ok',
        text: L(
          `Demo: σε κανονική χρήση θα στελνόταν τώρα email με σύνδεσμο αλλαγής κωδικού στο ${m.email}.`,
          `Demo: in real use an email with a password reset link would now go to ${m.email}.`,
        ),
      });
      return;
    }
    setBusy(true);
    setNotice(null);
    const {error} = await supabase.auth.resetPasswordForEmail(m.email, {redirectTo: window.location.origin});
    setBusy(false);
    if (error) {
      setNotice({
        kind: 'error',
        text: /rate|seconds|too many/i.test(error.message)
          ? L(
              'Στάλθηκε σύνδεσμος πριν από λίγο. Δοκιμάστε ξανά σε ένα λεπτό.',
              'A link was sent a moment ago. Try again in a minute.',
            )
          : L(`Ο σύνδεσμος δεν στάλθηκε: ${error.message}`, `The link was not sent: ${error.message}`),
      });
      return;
    }
    setDrawer(null);
    setNotice({
      kind: 'ok',
      text: L(
        `Στάλθηκε σύνδεσμος αλλαγής κωδικού στο ${m.email}. Ζητήστε να ελέγξει και τα ανεπιθύμητα (spam).`,
        `A password reset link was sent to ${m.email}. Ask them to check their spam folder too.`,
      ),
    });
  };

  /** A one-time invitation or set-new-password link, made without sending any email. */
  const makeLink = async (m: Member) => {
    // Demo: a sample link of the same shape, which opens nothing.
    if (demo) return `${window.location.origin}/?st_token=demo-${m.id}&st_link=recovery`;
    setNotice(null);
    const {data, error} = await supabase.functions.invoke<{ok?: boolean; url?: string}>('staff-link', {
      body: {user_id: m.id, origin: window.location.origin},
    });
    if (error || !data?.url) {
      setNotice({
        kind: 'error',
        text: L('Ο σύνδεσμος δεν δημιουργήθηκε. Δοκιμάστε ξανά.', 'The link was not made. Try again.'),
      });
      return undefined;
    }
    return data.url;
  };

  /** Deletes the account for good; the history the user left stays. */
  const remove = async (m: Member) => {
    const sure = await askConfirm({
      title: L(`Οριστική διαγραφή: ${m.name}`, `Delete ${m.name} for good`),
      message: L(
        'Δεν θα μπορεί πλέον να συνδεθεί. Το ιστορικό του παραμένει.',
        'They will no longer be able to sign in. Their history stays.',
      ),
      confirmLabel: L('Οριστική διαγραφή', 'Delete for good'),
      danger: true,
    });
    if (sure === false) return;
    if (demo) {
      libs.removeUser(m.id);
      setDrawer(null);
      setNotice({kind: 'ok', text: L(`Ο λογαριασμός ${m.name} διαγράφηκε.`, `${m.name}'s account was deleted.`)});
      return;
    }
    setBusy(true);
    setNotice(null);
    const {data, error} = await supabase.functions.invoke<{ok?: boolean}>('delete-staff', {body: {user_id: m.id}});
    setBusy(false);
    if (error || !data?.ok) {
      setNotice({
        kind: 'error',
        text: L(`Η διαγραφή του ${m.name} δεν ολοκληρώθηκε.`, `${m.name} could not be deleted.`),
      });
      return;
    }
    setDrawer(null);
    setNotice({kind: 'ok', text: L(`Ο λογαριασμός ${m.name} διαγράφηκε.`, `${m.name}'s account was deleted.`)});
    await changed();
  };
  return {invite, makeLink, passwordReset, remove, save};
}
