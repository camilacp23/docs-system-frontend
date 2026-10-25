// Pagination helpers: the allowed page sizes of the contract and the page numbers to draw.
export const PAGE_SIZES: readonly number[] = [20, 50, 100];

/** The page numbers to draw: first, last, the current one and its neighbors, with null for a gap. */
export function visiblePages(page: number, pageCount: number): Array<number | null> {
  const wanted = new Set([1, pageCount, page - 1, page, page + 1]);
  const pages = [...wanted].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const result: Array<number | null> = [];
  pages.forEach((p, index) => {
    const previous = pages[index - 1];
    if (previous !== undefined && p - previous > 1) result.push(null);
    result.push(p);
  });
  return result;
}
