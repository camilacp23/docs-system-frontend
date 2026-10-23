// Toast context and hook. `useToast()` returns { show, dismiss }; the provider lives in Toast.tsx.
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

export type ToastTone = 'default' | 'warning';

export interface ToastAction {
  label: string;
  href?: string;
  /** Opens `href` in a new tab (e.g. a Jira ticket). */
  external?: boolean;
  onClick?: () => void;
}

export interface ToastOptions {
  message: ReactNode;
  /** 'default' is the dark toast; 'warning' is the amber one of S-43a. */
  tone?: ToastTone;
  action?: ToastAction;
  /** Milliseconds before auto-close; `null` keeps it until dismissed. Default: 5000 (default tone), null (warning). */
  duration?: number | null;
  /** Shows the close button. Default: false (default tone), true (warning). */
  dismissible?: boolean;
}

export interface ToastApi {
  show: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
}

export const DEFAULT_TOAST_DURATION_MS = 5000;

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return api;
}
