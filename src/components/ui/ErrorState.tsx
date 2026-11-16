// ErrorState: full-page error with a way back (S-41a not found, S-41b no access, S-41c server error).
// Props (discriminated by `variant`):
//   'not-found'    element ("variable"), listLabel ("Variables")  -> "This variable doesn't exist"
//   'no-access'    roleName ("Reader")                            -> "You don't have access to this page"
//   'server-error' requestId (shown as "Reference: <id>")         -> "Something went wrong on our side"
//                  Without a requestId the text is "Try again in a moment." and no reference is mentioned or shown.
// onAction runs when the single primary button is pressed (navigate back / go to Dashboard / retry).
import { CircleAlert, Lock, Search } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from './Button';
import { cx, ICON_STROKE_WIDTH } from './cx';

interface ErrorStateBase {
  onAction?: () => void;
  className?: string;
}

export type ErrorStateProps = ErrorStateBase &
  (
    | { variant: 'not-found'; element: string; listLabel: string }
    | { variant: 'no-access'; roleName: string }
    | { variant: 'server-error'; requestId?: string }
  );

export function ErrorState(props: ErrorStateProps) {
  const { onAction, className } = props;
  const iconProps = { size: 30, strokeWidth: ICON_STROKE_WIDTH, 'aria-hidden': true } as const;

  let icon: ReactNode;
  let title: string;
  let description: string;
  let actionLabel: string;
  switch (props.variant) {
    case 'not-found':
      icon = <Search {...iconProps} />;
      title = `This ${props.element} doesn't exist`;
      description = 'It may have been deleted. Its history stays in the audit log.';
      actionLabel = `Back to ${props.listLabel}`;
      break;
    case 'no-access':
      icon = <Lock {...iconProps} />;
      title = "You don't have access to this page";
      description = `Your role (${props.roleName}) doesn't include it. Ask an administrator if you need it.`;
      actionLabel = 'Go to Dashboard';
      break;
    case 'server-error':
      icon = <CircleAlert {...iconProps} />;
      title = 'Something went wrong on our side';
      // The reference sentence only when there is a reference to share (the text of INTERNAL_ERROR without it otherwise).
      description = props.requestId
        ? 'Try again in a moment. If it keeps happening, share the reference below with the team.'
        : 'Try again in a moment.';
      actionLabel = 'Try again';
      break;
  }

  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center gap-[11.5px] px-5 pb-20 text-center',
        className,
      )}
    >
      <div className="flex size-16 items-center justify-center rounded-pill bg-disabled-bg text-ink-700">
        {icon}
      </div>
      <h1 className="text-heading font-semibold text-ink-900">{title}</h1>
      <p className="max-w-115 text-body-lg text-ink-500">{description}</p>
      <Button variant="primary" onClick={onAction}>
        {actionLabel}
      </Button>
      {props.variant === 'server-error' && props.requestId && (
        <p className="text-small text-ink-500">
          Reference: <span className="font-mono text-label">{props.requestId}</span>
        </p>
      )}
    </div>
  );
}
