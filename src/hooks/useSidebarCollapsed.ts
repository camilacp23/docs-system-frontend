// useSidebarCollapsed: whether the sidebar is collapsed to icons, remembered in this browser only.
// Returns [collapsed, toggle, setCollapsed]. Storage can be unavailable (private window, blocked data): the sidebar
// then simply starts expanded and the choice is kept for the session. Nothing sensitive is stored (rule 1).
import { useCallback, useState } from 'react';

const STORAGE_KEY = 'sidebar-collapsed';

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function useSidebarCollapsed(): [boolean, () => void, (value: boolean) => void] {
  const [collapsed, setState] = useState(readStored);

  const setCollapsed = useCallback((value: boolean) => {
    setState(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
    } catch {
      // Storage unavailable: the choice lives only in memory.
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsed(!collapsed);
  }, [collapsed, setCollapsed]);

  return [collapsed, toggle, setCollapsed];
}
