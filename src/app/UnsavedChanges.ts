import {createContext, useCallback, useContext, useEffect} from 'react';
import {useNavigate, type NavigateOptions} from 'react-router-dom';

/** The screens that hold a draft right now (a form being filled, an edit not yet saved). */
export const drafts = new Set<symbol>();

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

export type Leave = (go: () => void) => void;
export const LeaveContext = createContext<Leave>(go => go());

/** Runs `go` at once, or after the user agrees to leave a screen with unsaved changes. */
export const useLeave = () => useContext(LeaveContext);

/** `navigate`, asking first when the current screen holds unsaved changes. */
export function useGuardedNavigate() {
  const leave = useLeave();
  const navigate = useNavigate();
  return useCallback((to: string, options?: NavigateOptions) => leave(() => navigate(to, options)), [leave, navigate]);
}
