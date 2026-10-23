// selectionStorage: remembers the id of the selected application in localStorage (not sensitive data).
// Every access is wrapped in try/catch: storage can be blocked or throw (private windows, site settings).
export const SELECTED_APPLICATION_KEY = 'docs.selectedApplicationId';

export function readSelectedApplicationId(): number | null {
  try {
    const raw = localStorage.getItem(SELECTED_APPLICATION_KEY);
    if (raw === null) return null;
    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export function writeSelectedApplicationId(id: number): void {
  try {
    localStorage.setItem(SELECTED_APPLICATION_KEY, String(id));
  } catch {
    // Not remembering the selection is acceptable.
  }
}
