import {createPortal} from 'react-dom';
import {useCallback, useEffect, useMemo, useRef, type ReactNode} from 'react';
import {useNavigate} from 'react-router-dom';
import {useConfirm} from '../components/ui/useConfirm';
import {tr} from '../i18n';
import {drafts, LeaveContext, type Leave} from './UnsavedChanges';

/**
 * Leaving a screen with unsaved changes asks first, with staying as the default: in-app links and
 * navigation through {@link useLeave} get a dialog, closing or reloading the tab the browser's own prompt.
 */
export function UnsavedChangesProvider({children}: {children: ReactNode}) {
  const [confirm, ask] = useConfirm();
  const navigate = useNavigate();
  const askRef = useRef(ask);
  askRef.current = ask;

  const leave = useCallback<Leave>(go => {
    if (!drafts.size) return go();
    askRef.current({
      title: tr('Υπάρχουν αλλαγές που δεν αποθηκεύτηκαν'),
      message: tr('Αν φύγετε από αυτή τη σελίδα, οι αλλαγές θα χαθούν.'),
      cancelLabel: tr('Παραμονή'),
      confirmLabel: tr('Έξοδος χωρίς αποθήκευση'),
      danger: true,
      onConfirm: () => {
        drafts.clear();
        go();
      },
    });
  }, []);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!drafts.size) return;
      event.preventDefault();
      event.returnValue = '';
    };
    // Links are caught before React Router sees them, so the current screen stays until the user decides.
    const click = (event: MouseEvent) => {
      if (!drafts.size || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.('a[href^="#/"]');
      if (!link || link.getAttribute('target')) return;
      const to = link.getAttribute('href')!.slice(1);
      event.preventDefault();
      event.stopPropagation();
      leave(() => navigate(to));
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', click, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', click, true);
    };
  }, [leave, navigate]);

  const value = useMemo(() => leave, [leave]);
  return (
    <LeaveContext.Provider value={value}>
      {children}
      {/* Above the screen lock too: «Σύνδεση με άλλο χρήστη» there leaves through this question. */}
      {createPortal(<div className="sign-out-guard">{confirm}</div>, document.body)}
    </LeaveContext.Provider>
  );
}
