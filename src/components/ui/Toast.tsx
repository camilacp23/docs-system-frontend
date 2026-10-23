// Toast: ToastProvider renders the toast stack (bottom-right) and exposes useToast() (see toastContext.ts);
// ToastCard is the presentational card (also used statically in /dev/ui).
// ToastProvider props: children. Toasts auto-close (default tone: 5 s), pause while hovered or focused, and may
// carry one action (link or button). The warning tone is persistent and dismissible (S-43a, session ending).
// ToastCard props: tone ('default' dark | 'warning'), message, action, onDismiss (adds the close button).
// Usage: const { show } = useToast(); show({ message: 'Variable saved.' });
import { Check, Clock, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';

import { cx, ICON_STROKE_WIDTH } from './cx';
import { DEFAULT_TOAST_DURATION_MS, ToastContext } from './toastContext';
import type { ToastAction, ToastApi, ToastOptions, ToastTone } from './toastContext';

export interface ToastCardProps extends Omit<ComponentProps<'div'>, 'role'> {
  tone?: ToastTone;
  message: ReactNode;
  action?: ToastAction;
  onDismiss?: () => void;
}

export function ToastCard({
  tone = 'default',
  message,
  action,
  onDismiss,
  className,
  ...rest
}: ToastCardProps) {
  const isWarning = tone === 'warning';
  const actionClass = cx(
    'font-semibold underline-offset-2 hover:underline',
    isWarning ? 'text-warning-ink' : 'text-toast-link',
  );

  let actionNode: ReactNode = null;
  if (action) {
    actionNode = action.href ? (
      <a
        href={action.href}
        onClick={action.onClick}
        {...(action.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className={actionClass}
      >
        {action.label}
      </a>
    ) : (
      <button type="button" onClick={action.onClick} className={actionClass}>
        {action.label}
      </button>
    );
  }

  return (
    <div
      {...rest}
      role={isWarning ? 'alert' : 'status'}
      className={cx(
        'flex items-center gap-3 rounded-card px-4 py-3 text-body-lg shadow-toast',
        isWarning
          ? 'border border-warning-border bg-warning-bg text-warning-ink'
          : 'bg-toast-bg text-toast-ink',
        className,
      )}
    >
      {isWarning ? (
        <Clock aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} className="shrink-0" />
      ) : (
        <Check aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} className="shrink-0" />
      )}
      <div className="min-w-0 flex-1">{message}</div>
      {actionNode}
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="flex size-5 shrink-0 items-center justify-center rounded-chip"
        >
          <X aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />
        </button>
      )}
    </div>
  );
}

interface ToastItem extends ToastOptions {
  id: number;
}

function ToastView({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const { id, message, action, tone = 'default' } = toast;
  const isWarning = tone === 'warning';
  const duration =
    toast.duration === undefined ? (isWarning ? null : DEFAULT_TOAST_DURATION_MS) : toast.duration;
  const dismissible = toast.dismissible ?? isWarning;
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (duration === null || paused) {
      return;
    }
    const timer = setTimeout(() => {
      onDismiss(id);
    }, duration);
    return () => {
      clearTimeout(timer);
    };
  }, [duration, paused, id, onDismiss]);

  return (
    <ToastCard
      tone={tone}
      message={message}
      action={action}
      onDismiss={
        dismissible
          ? () => {
              onDismiss(id);
            }
          : undefined
      }
      className="pointer-events-auto"
      onMouseEnter={() => {
        setPaused(true);
      }}
      onMouseLeave={() => {
        setPaused(false);
      }}
      onFocus={() => {
        setPaused(true);
      }}
      onBlur={() => {
        setPaused(false);
      }}
    />
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const show = useCallback((options: ToastOptions) => {
    const id = nextId.current++;
    setToasts((current) => [...current, { ...options, id }]);
    return id;
  }, []);

  const api = useMemo<ToastApi>(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <section
        aria-label="Notifications"
        className="pointer-events-none fixed right-6 bottom-6 z-50 flex max-w-[calc(100vw-3rem)] flex-col items-end gap-3"
      >
        {toasts.map((toast) => (
          <ToastView key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </section>
    </ToastContext.Provider>
  );
}
