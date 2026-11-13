// searchPause: controls the pause the search boxes wait after the last key (SEARCH_DEBOUNCE_MS, a real timer in
// useSearchDraft) so a test does not have to outwait it with the clock.
// controlSearchTimers() fakes only setTimeout / clearTimeout and lets the fake clock follow the real one (shouldAdvanceTime),
// so everything else that uses timers (user-event, Testing Library) keeps working. Call it at the start of the test and
// restore the real timers in afterEach (vi.useRealTimers()).
// endSearchPause() runs the pause at once inside act: the URL changes, the list is read and rendered before it returns.
// Type the text with a single paste (user.click(box), user.paste(text)): one input event is one pause, whatever
// the load of the machine.
import { act } from '@testing-library/react';
import { vi } from 'vitest';

import { SEARCH_DEBOUNCE_MS } from '../../hooks/useSearchDraft';

export function controlSearchTimers(): void {
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] });
}

export async function endSearchPause(): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    await Promise.resolve();
  });
}
