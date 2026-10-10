/** Rows per request: the most the database returns at once. */
export const PAGE_SIZE = 1000;
/** Pages asked for at the same time once the total is known. */
const PARALLEL_PAGES = 4;

export type PageResult<Row> = {data: Row[] | null; error: unknown; count?: number | null};

/**
 * Every row of a query, page by page. The first page also returns the total, so the rest are asked
 * for together (a few at a time) instead of one after the other: a hospital with 14,000 instruments
 * waits for 4 round trips instead of 14. Pages come back in their order.
 */
export async function loadAllPages<Row>(
  fetchPage: (from: number, to: number, withCount: boolean) => PromiseLike<PageResult<Row>>,
  /** Rows arrived so far and the total, after each page (for a progress line). */
  onProgress?: (loaded: number, total: number) => void,
): Promise<Row[]> {
  const first = await fetchPage(0, PAGE_SIZE - 1, true);
  if (first.error) throw first.error;
  const rows = [...(first.data || [])];
  const total = typeof first.count === 'number' ? first.count : undefined;
  let loaded = rows.length;
  onProgress?.(loaded, Math.max(total ?? loaded, loaded));
  if (rows.length < PAGE_SIZE) return rows;
  if (total === undefined) {
    // No total (should not happen): one page after the other, as before.
    for (let from = PAGE_SIZE; ; from += PAGE_SIZE) {
      const page = await fetchPage(from, from + PAGE_SIZE - 1, false);
      if (page.error) throw page.error;
      rows.push(...(page.data || []));
      if ((page.data || []).length < PAGE_SIZE) return rows;
    }
  }
  const starts: number[] = [];
  for (let from = PAGE_SIZE; from < total; from += PAGE_SIZE) starts.push(from);
  const pages: Row[][] = new Array(starts.length);
  let next = 0;
  const worker = async () => {
    while (next < starts.length) {
      const index = next++;
      const from = starts[index];
      const page = await fetchPage(from, from + PAGE_SIZE - 1, false);
      if (page.error) throw page.error;
      pages[index] = page.data || [];
      loaded += pages[index].length;
      onProgress?.(loaded, Math.max(total, loaded));
    }
  };
  await Promise.all(Array.from({length: Math.min(PARALLEL_PAGES, starts.length)}, worker));
  pages.forEach(page => rows.push(...page));
  // Rows added while loading land past the counted total: pick them up the usual way.
  for (let from = PAGE_SIZE * (starts.length + 1); pages[pages.length - 1]?.length === PAGE_SIZE; from += PAGE_SIZE) {
    const page = await fetchPage(from, from + PAGE_SIZE - 1, false);
    if (page.error) throw page.error;
    pages.push(page.data || []);
    rows.push(...(page.data || []));
  }
  return rows;
}
