// parseId: the numeric id of a route parameter (/variables/:id), or null when it is not a positive integer that
// fits the API (an id above 2147483647 does not exist, D-62), so the page shows "doesn't exist" without a request.
export function parseId(value: string | undefined): number | null {
  return value !== undefined && /^[1-9]\d{0,9}$/.test(value) && Number(value) <= 2147483647
    ? Number(value)
    : null;
}
