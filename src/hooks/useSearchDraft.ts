// useSearchDraft: the text of a list's search box. useSearchDraft(urlText, commit) -> [text, setText]
// What the user types is shown at once; `commit(text)` (which writes the URL) runs SEARCH_DEBOUNCE_MS after the user
// stops typing. The draft is tagged with the URL value it started from, so a change of the URL (clear filters,
// browser back) replaces the text without an effect that copies state.
import { useEffect, useState } from 'react';

export const SEARCH_DEBOUNCE_MS = 300;

export function useSearchDraft(
  urlText: string,
  commit: (text: string) => void,
): [string, (text: string) => void] {
  const [draft, setDraft] = useState<{ base: string; text: string } | null>(null);
  const text = draft !== null && draft.base === urlText ? draft.text : urlText;

  useEffect(() => {
    if (draft === null || draft.base !== urlText) return;
    const wanted = draft.text.trim();
    if (wanted === urlText) return;
    const timer = setTimeout(() => {
      commit(wanted);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [draft, urlText, commit]);

  return [
    text,
    (next) => {
      setDraft({ base: urlText, text: next });
    },
  ];
}
