// useDelayedLoading: loading-state timing of SDD Table 58 / frame S-39a.
// useDelayedLoading(isLoading, { showAfter = 300, slowAfter = 10000 }) returns
//   showSkeleton: true once loading has lasted `showAfter` ms (fast responses never flash a skeleton);
//   isSlow: true once loading has lasted `slowAfter` ms; render SLOW_LOADING_MESSAGE then.
import { useEffect, useState } from 'react';

export const SKELETON_DELAY_MS = 300;
export const SLOW_LOADING_DELAY_MS = 10_000;
export const SLOW_LOADING_MESSAGE = 'This is taking longer than usual.';

export interface DelayedLoadingOptions {
  showAfter?: number;
  slowAfter?: number;
}

export interface DelayedLoadingState {
  showSkeleton: boolean;
  isSlow: boolean;
}

export function useDelayedLoading(
  isLoading: boolean,
  { showAfter = SKELETON_DELAY_MS, slowAfter = SLOW_LOADING_DELAY_MS }: DelayedLoadingOptions = {},
): DelayedLoadingState {
  // 0 = waiting, 1 = skeleton visible, 2 = slow notice visible. Reset by the effect cleanup.
  const [stage, setStage] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    if (!isLoading) {
      return;
    }
    const skeletonTimer = setTimeout(() => {
      setStage(1);
    }, showAfter);
    const slowTimer = setTimeout(() => {
      setStage(2);
    }, slowAfter);
    return () => {
      clearTimeout(skeletonTimer);
      clearTimeout(slowTimer);
      setStage(0);
    };
  }, [isLoading, showAfter, slowAfter]);

  return { showSkeleton: isLoading && stage >= 1, isSlow: isLoading && stage >= 2 };
}
