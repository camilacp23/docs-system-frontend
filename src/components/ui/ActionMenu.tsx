// ActionMenu: the "…" button of a row or page header and its menu of actions.
// Props: label (accessible name of the button, e.g. "Actions for gUsuario"), items ({ key, label, onSelect,
// danger?, disabled?, reason? }). A disabled item stays focusable with aria-disabled, shows `reason` as its title
// and does nothing, so the reason is reachable by keyboard. Arrow keys move, Home / End jump, Escape closes and
// returns focus to the button, as does choosing an item.
// The menu is drawn in a portal on <body> with fixed coordinates taken from the button, so no ancestor with
// `overflow` (the scrolling table of a list, the shell) can clip it. It opens below the button, aligned to its right
// edge; when there is no room below it opens above, and it never leaves the window horizontally. Scrolling or
// resizing closes it (its coordinates would be stale).
import { Ellipsis } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

import { usePopover } from '../../hooks/usePopover';

import { menuPosition } from './menuPosition';
import { cx, ICON_STROKE_WIDTH } from './cx';

export interface ActionMenuItem {
  key: string;
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  reason?: string;
}

export interface ActionMenuProps {
  label: string;
  items: readonly ActionMenuItem[];
}

export function ActionMenu({ label, items }: ActionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { open, setOpen, containerRef, triggerRef } = usePopover(menuRef);
  const menuId = useId();

  // Once the menu is in the document: measure it, put it next to the button (straight on the element, so it is
  // placed before the first paint and needs no state) and give the focus to its first item. `preventScroll`: a
  // scroll would close the menu. The menu starts hidden because a hidden element cannot take the focus.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    const button = triggerRef.current?.getBoundingClientRect();
    if (!open || menu === null || button === undefined) return;
    const { top, left } = menuPosition(
      button,
      { width: menu.offsetWidth, height: menu.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
    );
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
    menu.style.visibility = 'visible';
    menu.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
  }, [open, triggerRef]);

  useEffect(() => {
    if (!open) return;
    const close = () => {
      setOpen(false);
    };
    window.addEventListener('resize', close);
    document.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('resize', close);
      document.removeEventListener('scroll', close, true);
    };
  }, [open, setOpen]);

  const itemElements = () =>
    Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const elements = itemElements();
    const index = elements.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;
    if (event.key === 'ArrowDown') next = (index + 1) % elements.length;
    else if (event.key === 'ArrowUp') next = (index - 1 + elements.length) % elements.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = elements.length - 1;
    else if (event.key === 'Tab') setOpen(false);
    if (next !== null) {
      event.preventDefault();
      elements[next]?.focus({ preventScroll: true });
    }
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          setOpen((current) => !current);
        }}
        className="flex size-7.5 items-center justify-center rounded-chip border border-border-control bg-surface text-ink-700 hover:bg-control-hover"
      >
        <Ellipsis aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={label}
            tabIndex={-1}
            onKeyDown={onMenuKeyDown}
            style={{ top: 0, left: 0, visibility: 'hidden' }}
            className="fixed z-40 min-w-40 rounded-card border border-border-subtle bg-surface p-1 shadow-modal"
          >
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                aria-disabled={item.disabled || undefined}
                title={item.disabled ? item.reason : undefined}
                onClick={() => {
                  if (item.disabled) return;
                  setOpen(false);
                  triggerRef.current?.focus();
                  item.onSelect();
                }}
                className={cx(
                  'flex w-full rounded-chip px-3 py-2 text-left text-body font-medium',
                  item.disabled
                    ? 'cursor-not-allowed text-ink-500 opacity-45'
                    : 'hover:bg-control-hover',
                  item.danger && !item.disabled ? 'text-danger' : 'text-ink-900',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
