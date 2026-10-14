/** The departments of the waiting items, by name, with their counts. */
export const departmentsOf = (items: Array<{department?: string}>) => {
  const counts = new Map<string, number>();
  for (const item of items) if (item.department) counts.set(item.department, (counts.get(item.department) || 0) + 1);
  return [...counts].map(([name, count]) => ({name, count})).sort((a, b) => a.name.localeCompare(b.name, 'el'));
};
