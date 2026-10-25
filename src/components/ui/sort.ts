// Sort helper of the list columns: the API `sort` value toggles between "key" and "-key".
export function nextSort(sort: string, sortKey: string): string {
  return sort === sortKey ? `-${sortKey}` : sortKey;
}
