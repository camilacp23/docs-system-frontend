// Banner: inline message with a tone (info | success | warning | danger).
// Props: tone, lead (bold first word, e.g. "Warning."), children (message), actions (optional buttons on the
// right), icon (overrides the tone icon, e.g. Clock for rate limits), onDismiss (adds a Dismiss button).
// danger and warning use role="alert"; info and success use role="status".
import { Check, CircleAlert, X } from 'lucide-react';
import type { ReactNode } from 'react';

import { cx, ICON_STROKE_WIDTH } from './cx';

export type BannerTone = 'info' | 'success' | 'warning' | 'danger';

export interface BannerProps {
  tone: BannerTone;
  lead?: string;
  children: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

const TONE_CLASS: Record<BannerTone, string> = {
  info: 'border-info-border bg-info-bg text-info-ink',
  success: 'border-success-border bg-success-bg text-success-ink',
  warning: 'border-warning-border bg-warning-bg text-warning-ink',
  danger: 'border-danger-border bg-danger-bg text-danger',
};

function ToneIcon({ tone }: { tone: BannerTone }) {
  const props = { size: 18, strokeWidth: ICON_STROKE_WIDTH, 'aria-hidden': true } as const;
  return tone === 'success' ? <Check {...props} /> : <CircleAlert {...props} />;
}

export function Banner({ tone, lead, children, actions, icon, onDismiss, className }: BannerProps) {
  return (
    <div
      role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}
      className={cx(
        'flex items-start gap-2.5 rounded-control border px-3.5 py-2.5 text-body-lg',
        TONE_CLASS[tone],
        className,
      )}
    >
      <span className="flex h-4.75 shrink-0 items-start pt-px">
        {icon ?? <ToneIcon tone={tone} />}
      </span>
      <p className="min-w-0 flex-1">
        {lead && <span className="font-semibold">{lead} </span>}
        {children}
      </p>
      {actions && <div className="flex shrink-0 items-center gap-2 self-center">{actions}</div>}
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
