// Modal: dialog over a dimmed overlay (S-43b, S-17).
// Props: open, onClose, placement ('center' of the window, default | 'top-right' for confirmations that must not
// hide the page), title, description (one line under the title, as in S-37b; it describes the dialog for assistive technology), icon (decorative icon in a colored circle before the title; tone 'danger' tints it
// red for destructive confirmations), size ('sm' 400 px | 'md' | 'lg' | 'xl' 960 px, default 'sm'), footer (usually Buttons,
// right-aligned), dismissible (default true: Esc, click on the overlay and the close button call onClose;
// false for blocking dialogs such as "Your session ended"), initialFocusRef (element to focus on open; defaults
// to the first focusable element). Behavior: focus is trapped inside, Esc closes, focus returns to the element
// that opened it, role="dialog" with aria-modal and aria-labelledby, page scroll is locked while open.
import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';

import { cx, ICON_STROKE_WIDTH } from './cx';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  placement?: 'center' | 'top-right';
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  tone?: 'default' | 'danger';
  size?: ModalSize;
  footer?: ReactNode;
  dismissible?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: 'max-w-100',
  md: 'max-w-140',
  lg: 'max-w-180',
  xl: 'max-w-240',
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  placement = 'center',
  title,
  description,
  icon,
  tone = 'default',
  size = 'sm',
  footer,
  dismissible = true,
  initialFocusRef,
  children,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  const initialFocusRefRef = useRef(initialFocusRef);

  // Latest props for the open/close effect below, which must depend on `open` alone (re-running it would move focus).
  useEffect(() => {
    onCloseRef.current = onClose;
    dismissibleRef.current = dismissible;
    initialFocusRefRef.current = initialFocusRef;
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    const panel = panelRef.current;
    if (!panel) {
      return;
    }
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusable = () => Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    (initialFocusRefRef.current?.current ?? focusable()[0] ?? panel).focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissibleRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }
      const items = focusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panel || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) {
          return;
        }
        // Pressing the overlay must not move focus out of the dialog.
        event.preventDefault();
        if (dismissible) {
          onClose();
        }
      }}
      className={cx(
        'fixed inset-0 z-40 flex items-start overflow-y-auto bg-overlay p-4 sm:p-6',
        placement === 'top-right' ? 'justify-end' : 'justify-center',
      )}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cx(
          'w-full overflow-hidden rounded-modal bg-surface shadow-modal outline-none',
          placement === 'top-right'
            ? 'motion-safe:animate-toast-in'
            : 'my-auto motion-safe:animate-rise',
          SIZE_CLASS[size],
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-modal-border px-6 py-4.5">
          <div className="flex min-w-0 items-center gap-3">
            {icon && (
              <span
                aria-hidden="true"
                className={cx(
                  'flex size-9 shrink-0 items-center justify-center rounded-pill',
                  tone === 'danger' ? 'bg-danger-bg text-danger' : 'bg-accent-soft text-accent-ink',
                )}
              >
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <h2 id={titleId} className="text-section font-semibold text-ink-900">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="text-small text-ink-500">
                  {description}
                </p>
              )}
            </div>
          </div>
          {dismissible && (
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="-my-1 -mr-2 flex size-7.5 shrink-0 items-center justify-center rounded-chip text-primary"
            >
              <X aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />
            </button>
          )}
        </div>
        <div className="px-6 py-5 text-body-lg text-ink-900">{children}</div>
        {footer && (
          <div className="flex items-start justify-end gap-2 border-t border-modal-border bg-modal-footer-bg px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
