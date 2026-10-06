import {supabase} from '../../../lib/supabase';
import {SUPERVISOR, roles, wholeHospital, accountRole, EMAIL_FORMAT} from '../hospitalPeopleMeta';
import type {InviteResult} from '../hospitalPeopleMeta';
import type {usePeopleState} from './usePeopleState';
import type {usePeopleData} from './usePeopleData';
import type {usePeopleView} from './usePeopleView';
import type {usePeopleDecisions} from './usePeopleDecisions';
import type {usePeopleDepartments} from './usePeopleDepartments';
import type {usePeopleMembers} from './usePeopleMembers';

export function usePeopleCsv(
  p: ReturnType<typeof usePeopleState> &
    ReturnType<typeof usePeopleData> &
    ReturnType<typeof usePeopleView> &
    ReturnType<typeof usePeopleDecisions> &
    ReturnType<typeof usePeopleDepartments> &
    ReturnType<typeof usePeopleMembers>,
) {
  const {L, changed, csvRows, departments, organizationId, setBusy, setCsvRows, setNotice} = p;

  // ---- Invitations from a CSV file: Ονοματεπώνυμο; Email; Τμήμα; Ρόλος ----
  const readCsv = async (file: File) => {
    const lines = (await file.text())
      .split(/\r?\n/)
      .map(x => x.trim())
      .filter(Boolean);
    const rows = lines.slice(1).map(line => {
      const [name = '', email = '', department = '', roleRaw = ''] = line
        .split(/[;,]/)
        .map(x => x.trim().replace(/^"|"$/g, ''));
      const raw = roleRaw.trim().toUpperCase();
      const role =
        roles.find(r => r.id === raw || r.el.toUpperCase() === raw || r.en.toUpperCase() === raw)?.id || 'DEPARTMENT';
      const dep = departments.find(
        d =>
          d.active &&
          ((d.code || '').toLowerCase() === department.toLowerCase() ||
            d.name.toLowerCase() === department.toLowerCase()),
      );
      const error =
        name.length < 2 || !EMAIL_FORMAT.test(email)
          ? L('Μη έγκυρο όνομα ή email', 'Invalid name or email')
          : !wholeHospital(role) && !dep
            ? L('Άγνωστο τμήμα', 'Unknown department')
            : undefined;
      return {name, email, role, departmentId: dep?.id || '', department, error};
    });
    setCsvRows(rows);
  };
  const sendCsv = async () => {
    if (!csvRows?.length || csvRows.some(r => r.error)) return;
    setBusy(true);
    setNotice(null);
    const {data: result, error} = await supabase.functions.invoke('invite-staff', {
      body: {
        users: csvRows.map(r => ({
          full_name: r.name,
          email: r.email,
          organization_id: organizationId,
          department_id: wholeHospital(r.role) ? null : r.departmentId || null,
          role: accountRole(r.role),
          supervisor: r.role === SUPERVISOR,
        })),
        // The list is the admin's own: accounts are made at once, no approval.
        direct: true,
        redirect_to: window.location.origin,
      },
    });
    setBusy(false);
    if (error) {
      setNotice({kind: 'error', text: error.message});
      return;
    }
    const results = (result?.results || []) as InviteResult[];
    const failed = results.filter(x => !x.ok).length;
    const unsent = results.filter(x => x.ok && !x.emailed).length;
    const sent = csvRows.length - failed;
    setNotice({
      kind: failed || unsent ? 'warn' : 'ok',
      text:
        (failed
          ? L(`Δημιουργήθηκαν ${sent} λογαριασμοί, ${failed} απέτυχαν.`, `${sent} accounts made, ${failed} failed.`)
          : L(
              `Δημιουργήθηκαν ${sent} λογαριασμοί και στάλθηκαν προσκλήσεις με το όνομα χρήστη.`,
              `${sent} accounts made and invitations with the username sent.`,
            )) +
        (unsent
          ? L(
              ` ${unsent} email δεν στάλθηκαν: ανοίξτε τον χρήστη και πατήστε «Αντιγραφή συνδέσμου».`,
              ` ${unsent} emails were not sent: open the user and press «Copy link».`,
            )
          : ''),
    });
    if (!failed) setCsvRows(null);
    await changed();
  };
  return {readCsv, sendCsv};
}
