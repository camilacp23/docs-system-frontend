// setupUser: the simulated user of the tests.
// setupUser() -> userEvent.setup({ delay: null }) whose every action runs inside `act`.
//  - No pause between actions. By default every key and click waits for a timer (`delay: 0`), which on a form with
//    dozens of controls was most of the time of a test (typing 60 characters: 1012 ms with the pause, 404 ms without
//    it). Keys and clicks still happen one at a time and in order; only the wait between them goes.
//  - Inside `act`. A check that follows an action should not depend on WHEN React decides to render what the action
//    caused (the answer of the fake API, the toast, the new status): under load React can leave a render waiting for
//    seconds, and `findBy` gives up after 1 s of wall clock. Inside `act` every queued render and effect runs before
//    the call returns, so when `await user.click(...)` is done the page is already drawn. The wait is for the work to
//    be finished, not for the clock: there is no timeout to tune and none to outrun.
// settle() does the same without an action: it returns when React has nothing left to render (renderApp ends with it).
import { act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

export type User = ReturnType<typeof userEvent.setup>;

export async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

export function setupUser(): User {
  const base = userEvent.setup({ delay: null });
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
