// useSearchDraft: the text of a list's search box. useSearchDraft(urlText, commit) -> [text, setText]
// What the user types is shown at once; `commit(text)` (which writes the URL) runs SEARCH_DEBOUNCE_MS after the user
// stops typing. The draft is tagged with the URL value it started from. As soon as the URL differs from that value the
// draft is over and is dropped (during render, the documented way to reset state when an input changes): a change of the
// URL (clear filters, browser back, a link) replaces the text, and a URL that later comes back to the value the draft
// started from shows the URL, not the old draft.
import { useEffect, useState } from 'react';

export const SEARCH_DEBOUNCE_MS = 300;

export function useSearchDraft(
  urlText: string,
  commit: (text: string) => void,
): [string, (text: string) => void] {
  const [draft, setDraft] = useState<{ base: string; text: string } | null>(null);
  if (draft !== null && draft.base !== urlText) setDraft(null);
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
