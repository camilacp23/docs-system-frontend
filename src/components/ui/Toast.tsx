// Toast: ToastProvider renders the toast stack (top-right) and exposes useToast() (see toastContext.ts);
// ToastCard is the presentational card (also used statically in /dev/ui).
// ToastProvider props: children. Toasts auto-close (default tone: 5 s), pause while hovered or focused, and may
// carry one action (link or button). The warning tone is persistent and dismissible (S-43a, session ending).
// ToastCard props: tone ('default' success | 'warning'), message, action, onDismiss (adds the close button).
// Look: white card, colored edge and icon bubble by tone; it slides in from the right (off with reduced motion).
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
  description?: ReactNode;
  action?: ToastAction;
  onDismiss?: () => void;
}

export function ToastCard({
  tone = 'default',
  message,
  description,
  action,
  onDismiss,
  className,
  ...rest
}: ToastCardProps) {
  const isWarning = tone === 'warning';
  const actionClass = cx(
    'mt-1 inline-block text-label font-semibold underline-offset-2 hover:underline',
    isWarning ? 'text-warning-ink' : 'text-accent-ink',
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
        'relative flex w-96 max-w-full items-start gap-3 overflow-hidden rounded-card border bg-surface py-3.5 pr-3 pl-5 text-body-lg shadow-toast',
        isWarning ? 'border-warning-border' : 'border-border-subtle',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          'absolute inset-y-0 left-0 w-1',
          isWarning ? 'bg-badge-warning-bg' : 'bg-success',
        )}
      />
      <span
        aria-hidden="true"
        className={cx(
          'flex size-8 shrink-0 items-center justify-center rounded-pill',
          isWarning ? 'bg-warning-bg text-warning-ink' : 'bg-success-bg text-success-ink',
        )}
      >
        {isWarning ? (
          <Clock size={16} strokeWidth={ICON_STROKE_WIDTH} />
        ) : (
          <Check size={16} strokeWidth={ICON_STROKE_WIDTH} />
        )}
      </span>
      <div className="min-w-0 flex-1 py-1">
        <div className="font-semibold text-ink-900">{message}</div>
        {description && <div className="mt-0.5 text-label text-ink-500">{description}</div>}
        {actionNode}
      </div>
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="flex size-7 shrink-0 items-center justify-center rounded-chip text-ink-500 transition-colors duration-150 hover:bg-control-hover hover:text-ink-900"
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
  const { id, message, description, action, tone = 'default' } = toast;
  const isWarning = tone === 'warning';
  const duration =
    toast.duration === undefined ? (isWarning ? null : DEFAULT_TOAST_DURATION_MS) : toast.duration;
  const dismissible = toast.dismissible ?? true;
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
      description={description}
      action={action}
      onDismiss={
        dismissible
          ? () => {
              onDismiss(id);
            }
          : undefined
      }
      className="pointer-events-auto motion-safe:animate-toast-in"
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
        className="pointer-events-none fixed top-6 right-6 z-50 flex max-w-[calc(100vw-3rem)] flex-col items-end gap-3"
      >
        {toasts.map((toast) => (
          <ToastView key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </section>
    </ToastContext.Provider>
  );
}
