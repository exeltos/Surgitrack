import {useEffect} from 'react';

/** The list a record was opened from, in the order the user saw it (search and filters applied). */
type BrowseList = {base: string; ids: string[]};

const KEY = 'surgitrack.browse';

const read = (): BrowseList | null => {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) || 'null') as BrowseList | null;
    return value && Array.isArray(value.ids) ? value : null;
  } catch {
    return null;
  }
};

/** Remembers a registry list as shown, so its records can be browsed one after the other. */
export function useBrowseList(base: '/sets' | '/tools', items: Array<{id: string}>) {
  const ids = items.map(x => x.id).join(',');
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({base, ids: ids ? ids.split(',') : []}));
    } catch {
      // Private mode or full storage: browsing simply stays off.
    }
  }, [base, ids]);
}

/** Where the previous and next records of the remembered list are, when `id` belongs to it. */
export function browsePosition(base: string, id: string) {
  const list = read();
  if (!list || list.base !== base) return null;
  const index = list.ids.indexOf(id);
  if (index < 0 || list.ids.length < 2) return null;
  const at = (i: number) => (list.ids[i] ? `${base}/${list.ids[i]}` : undefined);
  return {position: index + 1, total: list.ids.length, previous: at(index - 1), next: at(index + 1)};
}
