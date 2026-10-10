import {createPortal} from 'react-dom';
import {createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode} from 'react';
import {useNavigate, type NavigateOptions} from 'react-router-dom';
import {useConfirm} from '../components/ui/useConfirm';
import {tr} from '../i18n';

/** The screens that hold a draft right now (a form being filled, an edit not yet saved). */
const drafts = new Set<symbol>();

/** Marks the calling screen as holding unsaved changes while `dirty` is true. */
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const key = Symbol('draft');
    drafts.add(key);
    return () => {
      drafts.delete(key);
    };
  }, [dirty]);
}

type Leave = (go: () => void) => void;
const LeaveContext = createContext<Leave>(go => go());

/** Runs `go` at once, or after the user agrees to leave a screen with unsaved changes. */
export const useLeave = () => useContext(LeaveContext);

/** `navigate`, asking first when the current screen holds unsaved changes. */
export function useGuardedNavigate() {
  const leave = useLeave();
  const navigate = useNavigate();
  return useCallback((to: string, options?: NavigateOptions) => leave(() => navigate(to, options)), [leave, navigate]);
}

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
