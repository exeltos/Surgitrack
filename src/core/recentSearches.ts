/**
 * The last searches in Traceability (barcodes and patient codes), newest first. Patient codes are
 * personal data, so the list lives in this tab's session only and goes with the sign-out; it is never
 * written to localStorage, where the next person on a shared workstation would find it.
 */
const KEY = 'surgitrack.trace.recent';
const MAX = 6;

export const readRecentSearches = (): string[] => {
  try {
    // An older version kept this list in localStorage, for good: remove what it left behind.
    localStorage.removeItem(KEY);
    const list = JSON.parse(sessionStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string').slice(0, MAX) : [];
  } catch {
    return [];
  }
};

/** The list with `term` first (without a repeat), also kept for this session. */
export const rememberRecentSearch = (current: string[], term: string): string[] => {
  const next = [term, ...current.filter(x => x.toLowerCase() !== term.toLowerCase())].slice(0, MAX);
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: the list just is not kept.
  }
  return next;
};

export const clearRecentSearches = () => {
  try {
    sessionStorage.removeItem(KEY);
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
};
