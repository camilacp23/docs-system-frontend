// editParts: small pieces shared by the row editors of the screen edit page (components, navigations, links).
//   describedBy(...ids)    the aria-describedby value of the ids that exist
//   useRowFocus()          { containerRef, focusRow(key) } -> after a row is added the focus goes to its first control (the
//                          element marked `data-first` inside `data-row="<key>"`), with the keyboard or the mouse, so the
//                          user can type at once. After a row is removed the editor puts the focus on the "Add" button of
//                          its section.
//   HEAD_CLASS, CELL_CLASS the look of the table headers and cells of the row editors
import { useEffect, useRef } from 'react';

export const HEAD_CLASS =
  'px-2 py-2 text-left text-micro font-bold tracking-wider text-ink-500 uppercase';
export const CELL_CLASS = 'px-2 py-2 align-top';

export const describedBy = (...ids: Array<string | null | undefined>) =>
  ids.filter(Boolean).join(' ') || undefined;

export function useRowFocus() {
  const containerRef = useRef<HTMLDivElement>(null);
  const pending = useRef<string | null>(null);

  // Runs after every render of the editor. The request is kept until the row exists: React can flush the passive
  // effects of an EARLIER render right after the click that asks for the focus and before the render that adds the
  // row (it does so before it processes a new update), and that run must not use the request up. Asked with the
  // keyboard, the "Add" button is usually focused with no render in between, so this is the common case there; the
  // mouse hides it because pressing the button gives React time to flush first.
  useEffect(() => {
    if (pending.current === null) return;
    const target = containerRef.current?.querySelector<HTMLElement>(
      `[data-row="${pending.current}"] [data-first]`,
    );
    if (target === null || target === undefined) return;
    pending.current = null;
    target.focus();
  });

  const focusRow = (key: string) => {
    pending.current = key;
  };
  return { containerRef, focusRow };
}
