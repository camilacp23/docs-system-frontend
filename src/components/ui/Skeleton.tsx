// Skeleton: placeholder bar with the shape of the content it stands for (S-39a).
// Props: className (set the size, e.g. "h-3 w-full"). Decorative, hidden from assistive technology; pair it with
// useDelayedLoading so it only appears after 300 ms.
import { cx } from './cx';

export interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cx('rounded-skeleton bg-(image:--gradient-skeleton)', className)}
    />
  );
}
