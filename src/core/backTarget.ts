/**
 * Where «Πίσω» returns to, said by name: each step of the app's history (by its index in the browser's history)
 * remembers its address for this tab, so a page knows what came before it.
 */
const KEY = 'surgitrack.history.paths';

const read = (): Record<string, string> => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || '{}') || {};
  } catch {
    return {};
  }
};

const historyIndex = () => (window.history.state as {idx?: number} | null)?.idx ?? 0;

/** Remember the address shown now, at its step in the history. */
export const rememberPath = (path: string) => {
  try {
    const paths = read();
    paths[historyIndex()] = path;
    sessionStorage.setItem(KEY, JSON.stringify(paths));
  } catch {
    // Storage blocked: «Πίσω» just says less.
  }
};

/** The address of the step before this one, when there is one in the app. */
export const previousPath = (): string | undefined => {
  const index = historyIndex();
  return index > 0 ? read()[index - 1] : undefined;
};

/** «Πίσω …» for an address: the page it opens, by name; «Πίσω» alone when it has none. */
export const backLabelFor = (path: string | undefined): string => {
  const pathname = (path || '').split('?')[0].replace(/\/+$/, '') || '/';
  const exact: Record<string, string> = {
    '/overview': 'Πίσω στην Επισκόπηση',
    '/sterilization': 'Πίσω στην Αποστείρωση',
    '/sterilizers': 'Πίσω στους Κλιβάνους',
    '/issues': 'Πίσω στις Εκκρεμότητες',
    '/expiry': 'Πίσω στις Λήξεις',
    '/sets': 'Πίσω στα Σετ',
    '/tools': 'Πίσω στα εργαλεία',
    '/standalone-tools': 'Πίσω στα Μεμονωμένα',
    '/stock': 'Πίσω στο Απόθεμα',
    '/traceability': 'Πίσω στην Ιχνηλάτηση',
    '/indicators': 'Πίσω στους Δείκτες',
    '/reports': 'Πίσω στις Αναφορές',
    '/movements': 'Πίσω στο Ιστορικό',
    '/bin': 'Πίσω στον Κάδο',
    '/department/home': 'Πίσω στην Αρχική',
    '/department': 'Πίσω στα Σετ',
    '/department/tools': 'Πίσω στα εργαλεία',
  };
  if (exact[pathname]) return exact[pathname];
  if (/^\/sets\/[^/]+$/.test(pathname)) return 'Πίσω στο Σετ';
  if (/^\/tools\/[^/]+$/.test(pathname)) return 'Πίσω στο εργαλείο';
  if (/^\/sterilizers\/[^/]+$/.test(pathname)) return 'Πίσω στη συσκευή';
  return 'Πίσω';
};
