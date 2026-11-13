// setupUser: the simulated user of the tests, without the pause user-event puts between actions by default.
// setupUser() -> userEvent.setup({ delay: null }).
// By default every key and click waits for a timer (`delay: 0`), which on a form with dozens of controls was most of the
// time of a test (typing 60 characters: 1012 ms with the pause, 404 ms without it). Keys and clicks still happen one
// at a time and in order; only the wait between them goes. Only the time limits of the runner are left as they are.
import { act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

export type User = ReturnType<typeof userEvent.setup>;

export function setupUser(): User {
  return userEvent.setup({ delay: null });
}

/**
 * Runs the work React has queued, whatever its priority, and returns when nothing is left to render.
 * A test that checks what an action produced should not depend on WHEN React decides to render it: under load
 * React can leave a low-priority render waiting for seconds, and `findBy` gives up after 1 s of wall clock. Inside
 * `act` every queued render and effect runs before the call returns, so the check that follows is synchronous.
 */
export async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

/**
 * Like setupUser, but every action (click, type, keyboard, selectOptions...) runs inside `act`, so when the call returns
 * the updates it caused (the answer of the fake API, the toast, the new status) are already rendered. The wait is for
 * the work to be done, not for the clock: there is no timeout to tune and none to outrun.
 */
export function setupSettledUser(): User {
  const base = setupUser();
  const settled: Record<string, unknown> = {};
  for (const [name, member] of Object.entries(base)) {
    settled[name] =
      typeof member === 'function' && name !== 'setup'
        ? (...args: unknown[]) =>
            act(async () => {
              await (member as (...a: unknown[]) => Promise<unknown>).apply(base, args);
            })
        : member;
  }
  return settled as User;
}
