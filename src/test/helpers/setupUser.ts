// setupUser: the simulated user of the tests, without the pause user-event puts between actions by default.
// setupUser() -> userEvent.setup({ delay: null }).
// By default every key and click waits for a timer (`delay: 0`), which on a form with dozens of controls was most of the
// time of a test (typing 60 characters: 1012 ms with the pause, 404 ms without it). Keys and clicks still happen one
// at a time and in order; only the wait between them goes. Only the time limits of the runner are left as they are.
import userEvent from '@testing-library/user-event';

export type User = ReturnType<typeof userEvent.setup>;

export function setupUser(): User {
  return userEvent.setup({ delay: null });
}
