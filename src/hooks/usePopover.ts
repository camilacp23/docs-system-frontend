// usePopover: open / close state of a small disclosure panel (application selector, user menu, action menu).
// usePopover(panelRef?) -> { open, setOpen, containerRef, triggerRef }
// It closes on Escape (returning focus to the trigger), on a click outside and when focus leaves the container.
// A panel that is drawn outside the container (a portal, see ActionMenu) passes its `panelRef`: it counts as inside.
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export function usePopover(panelRef?: RefObject<HTMLElement | null>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const inside = (target: EventTarget | null) =>
      containerRef.current?.contains(target as Node) === true ||
      panelRef?.current?.contains(target as Node) === true;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    const onPointerDown = (event: MouseEvent) => {
      if (!inside(event.target)) setOpen(false);
    };
    const onFocusIn = (event: FocusEvent) => {
      if (!inside(event.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [open, panelRef]);

  return { open, setOpen, containerRef, triggerRef };
}
