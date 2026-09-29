/**
 * KPIs that filter the list on their own page: clicking one sets exactly its filters (clearing the
 * others and the search) and it shows as active while those are the filters in effect.
 */
export const kpiFilters =
  (filters: Record<string, [string, (value: string) => void]>) =>
  (preset: Record<string, string> = {}) => ({
    onClick: () => Object.entries(filters).forEach(([key, [, set]]) => set(preset[key] ?? '')),
    active: Object.entries(filters).every(([key, [value]]) => value === (preset[key] ?? '')),
  });
