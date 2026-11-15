// useMinimapPreference: whether the visitor wants the mini map on the canvas, remembered in this browser only. Off by default.
// Returns [on, toggle]. Storage can be unavailable (private window, blocked data): the mini map then starts off and the choice
// is kept for the session. The map never needs it (the preference is a convenience) and nothing sensitive is stored (rule 1).
import { useCallback, useState } from 'react';

const STORAGE_KEY = 'dependency-map-minimap';

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function useMinimapPreference(): [boolean, () => void] {
  const [on, setOn] = useState(readStored);

  const toggle = useCallback(() => {
    const next = !on;
    setOn(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    } catch {
      // Storage unavailable: the choice lives only in memory.
    }
  }, [on]);

  return [on, toggle];
}
