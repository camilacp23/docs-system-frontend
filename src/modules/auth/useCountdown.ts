// useCountdown: whole seconds left until a deadline (the "Try again in mm:ss" of S-01c).
// Returns { remaining, start(seconds) }; remaining is 0 when idle. The deadline is kept as a timestamp and the
// value is recomputed on every tick, so a throttled background tab does not drift. formatCountdown(14 * 60) -> "14:00".
import { useCallback, useEffect, useRef, useState } from 'react';

export function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function useCountdown() {
  const [remaining, setRemaining] = useState(0);
  const deadline = useRef(0);
  const running = remaining > 0;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)));
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, [running]);

  const start = useCallback((seconds: number) => {
    deadline.current = Date.now() + seconds * 1000;
    setRemaining(Math.max(0, Math.ceil(seconds)));
  }, []);

  return { remaining, start };
}
