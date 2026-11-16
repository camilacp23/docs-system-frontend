// RouteFallback: what a lazily loaded page shows while its code arrives (SDD Table 58, S-39a). No props.
// Nothing for the first 300 ms (a page that arrives at once never flashes a skeleton), then a skeleton with the shape of
// a page (title, one line and a card with rows) and, after 10 s, "This is taking longer than usual.".
import { Skeleton } from '../../components/ui';
import { SLOW_LOADING_MESSAGE, useDelayedLoading } from '../../components/ui/useDelayedLoading';

export function RouteFallback() {
  const { showSkeleton, isSlow } = useDelayedLoading(true);
  if (!showSkeleton) return null;
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="flex flex-col gap-4 rounded-card border border-border-subtle bg-surface p-5 shadow-card">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-5 w-2/3" />
      </div>
      {isSlow && <p className="text-small text-ink-500">{SLOW_LOADING_MESSAGE}</p>}
    </div>
  );
}
