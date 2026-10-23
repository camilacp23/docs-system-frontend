// useDelayedLoading + Skeleton with fake timers: skeleton only after 300 ms, slow notice after 10 s (S-39a).
import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Skeleton, SLOW_LOADING_MESSAGE, useDelayedLoading } from '../../components/ui';

function Probe({ loading }: { loading: boolean }) {
  const { showSkeleton, isSlow } = useDelayedLoading(loading);
  return (
    <div>
      {showSkeleton && <Skeleton className="h-3 w-full" />}
      {isSlow && <p>{SLOW_LOADING_MESSAGE}</p>}
    </div>
  );
}

describe('useDelayedLoading', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows nothing before 300 ms', () => {
    const { result } = renderHook(() => useDelayedLoading(true));

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toEqual({ showSkeleton: false, isSlow: false });
  });

  it('shows the skeleton at 300 ms and the slow notice at 10 s', () => {
    const { result } = renderHook(() => useDelayedLoading(true));

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toEqual({ showSkeleton: true, isSlow: false });

    act(() => {
      vi.advanceTimersByTime(9699);
    });
    expect(result.current.isSlow).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toEqual({ showSkeleton: true, isSlow: true });
  });

  it('never flashes a skeleton when loading finishes quickly', () => {
    const { result, rerender } = renderHook(({ loading }) => useDelayedLoading(loading), {
      initialProps: { loading: true },
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender({ loading: false });
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(result.current).toEqual({ showSkeleton: false, isSlow: false });
  });

  it('hides everything as soon as loading ends and starts over on the next load', () => {
    const { result, rerender } = renderHook(({ loading }) => useDelayedLoading(loading), {
      initialProps: { loading: true },
    });
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current).toEqual({ showSkeleton: true, isSlow: true });

    rerender({ loading: false });
    expect(result.current).toEqual({ showSkeleton: false, isSlow: false });

    rerender({ loading: true });
    expect(result.current).toEqual({ showSkeleton: false, isSlow: false });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toEqual({ showSkeleton: true, isSlow: false });
  });

  it('accepts custom delays', () => {
    const { result } = renderHook(() => useDelayedLoading(true, { showAfter: 50, slowAfter: 100 }));

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current.showSkeleton).toBe(true);
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current.isSlow).toBe(true);
  });
});

describe('Skeleton with the delayed-loading timing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the decorative bar only after 300 ms and the notice after 10 s', () => {
    const { container } = render(<Probe loading />);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    expect(screen.queryByText(SLOW_LOADING_MESSAGE)).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(9700);
    });
    expect(screen.getByText('This is taking longer than usual.')).toBeInTheDocument();
  });
});
