// BlockStates: what a card of the dashboard shows while its read is loading or when it failed (SDD Table 58): a skeleton
// with the shape of the content that appears only after 300 ms, and the error of the block with "Try again", which
// reads again only that block. A failing card never breaks the rest of the page.
// BlockLoading props: children (the skeleton), loading (the read is in flight). BlockError props: lead (the sentence
// of the card, "Couldn't load …"), error (the ApiError, whose catalog text follows the lead), onRetry.
import type { ReactNode } from 'react';

import type { ApiError } from '../../api/ApiError';
import { getErrorMessage } from '../../api/messages';
import { Banner, Button, SLOW_LOADING_MESSAGE, useDelayedLoading } from '../../components/ui';

interface BlockLoadingProps {
  loading: boolean;
  /** Keeps the height of the card while nothing is drawn yet, so the page does not jump. */
  className?: string;
  children: ReactNode;
}

export function BlockLoading({ loading, className, children }: BlockLoadingProps) {
  const { showSkeleton, isSlow } = useDelayedLoading(loading);
  return (
    <div className={className} aria-busy={loading || undefined}>
      {showSkeleton && (
        <div role="status" aria-label="Loading" className="flex flex-col gap-2.5">
          {children}
          {isSlow && <p className="text-small text-ink-500">{SLOW_LOADING_MESSAGE}</p>}
        </div>
      )}
    </div>
  );
}

interface BlockErrorProps {
  lead: string;
  error: ApiError | null;
  onRetry: () => void;
}

export function BlockError({ lead, error, onRetry }: BlockErrorProps) {
  return (
    <Banner
      tone="danger"
      lead={lead}
      actions={
        <Button size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    >
      {error ? (getErrorMessage(error, { element: 'application' }) ?? '') : ''}
    </Banner>
  );
}
