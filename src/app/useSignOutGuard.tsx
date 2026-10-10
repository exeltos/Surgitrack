import {useState, type ReactNode} from 'react';
import {useConfirm} from '../components/ui/useConfirm';
import Spinner from '../components/ui/Spinner';
import {flushPendingWrites, unsavedChanges} from '../data/cloud/useAppRecordSync';
import {tr} from '../i18n';

/** How long signing out waits for unsaved changes to reach the server. */
const FLUSH_WAIT_MS = 8000;

/**
 * Signing out never drops unsaved changes silently: after the usual question, what is still waiting is
 * saved first (a few seconds at most), and if some of it still cannot be saved the user is asked again,
 * with staying as the default. Render the returned node once.
 */
export function useSignOutGuard(): [ReactNode, (signOut: () => void, options?: {direct?: boolean}) => void] {
  const [confirm, ask] = useConfirm();
  const [saving, setSaving] = useState(false);
  const afterSaving = async (signOut: () => void) => {
    if (unsavedChanges()) {
      setSaving(true);
      const left = await flushPendingWrites(FLUSH_WAIT_MS);
      setSaving(false);
      if (left)
        return ask({
          title: tr('Υπάρχουν αλλαγές που δεν αποθηκεύτηκαν'),
          message: tr(
            '{0} αλλαγές δεν έχουν αποθηκευτεί ακόμη στον διακομιστή (π.χ. λόγω σύνδεσης). Αν αποσυνδεθείτε τώρα, θα χαθούν.',
            left,
          ),
          cancelLabel: tr('Παραμονή'),
          confirmLabel: tr('Αποσύνδεση χωρίς αποθήκευση'),
          danger: true,
          onConfirm: signOut,
        });
    }
    signOut();
  };
  // `direct`: the user already chose to leave (e.g. «Σύνδεση με άλλο χρήστη» on the screen lock), so only
  // unsaved changes are asked about.
  const guard = (signOut: () => void, options?: {direct?: boolean}) =>
    options?.direct
      ? void afterSaving(signOut)
      : ask({
          title: tr('Αποσύνδεση'),
          message: tr('Θέλετε να αποσυνδεθείτε από το SurgiTrack;'),
          confirmLabel: tr('Αποσύνδεση'),
          onConfirm: () => void afterSaving(signOut),
        });
  const node = (
    <>
      {confirm}
      {saving && (
        <div className="modal-backdrop confirm-dialog-backdrop">
          <div className="confirm-dialog" role="dialog" aria-modal="true">
            <Spinner label={tr('Αποθήκευση αλλαγών πριν την αποσύνδεση…')} />
          </div>
        </div>
      )}
    </>
  );
  return [node, guard];
}
