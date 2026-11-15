// useSearchDraft: the text of a search box follows the URL. A draft typed by the user is shown until the URL changes;
// once the URL has changed, the draft is over, even if the URL later comes back to the value the draft started from
// (Clear filters, the back button, a link): the box then shows the URL's value, never the old draft.
import { act, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SEARCH_DEBOUNCE_MS, useSearchDraft } from '../../hooks/useSearchDraft';
import { setupUser } from '../helpers/setupUser';

afterEach(() => {
  vi.useRealTimers();
});

/** A search box over a "URL" held in state; the buttons change that URL as Clear filters or a link would. */
function Harness({ initial = '', commit }: { initial?: string; commit?: (text: string) => void }) {
  const [url, setUrl] = useState(initial);
  const [text, setText] = useSearchDraft(url, (next) => {
    commit?.(next);
    setUrl(next);
  });
  return (
    <>
      <input aria-label="Search" value={text} onChange={(event) => setText(event.target.value)} />
      <button
        type="button"
        onClick={() => {
          setUrl('');
        }}
      >
        Clear
      </button>
      <button
        type="button"
        onClick={() => {
          setUrl('from a link');
        }}
      >
        Link
      </button>
    </>
  );
}

describe('useSearchDraft', () => {
  it('commits what was typed after the pause and keeps showing it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] });
    const commit = vi.fn();
    render(<Harness commit={commit} />);
    const user = setupUser();

    await user.click(screen.getByRole('textbox', { name: 'Search' }));
    await user.paste('abc');
    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue('abc');
    expect(commit).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });
    expect(commit).toHaveBeenCalledWith('abc');
    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue('abc');
  });

  it('shows the value of the URL, not the old draft, when the URL goes back to the value the draft started from', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] });
    render(<Harness />);
    const user = setupUser();
    const box = screen.getByRole('textbox', { name: 'Search' });

    // The user types "abc" from an empty URL; after the pause the URL is "abc".
    await user.click(box);
    await user.paste('abc');
    await act(async () => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });
    expect(box).toHaveValue('abc');

    // Clear filters: the URL is empty again, the value the draft started from.
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(box).toHaveValue('');
  });

  it('follows the URL when it changes to another value, and again when it comes back to the first one', async () => {
    render(<Harness initial="first" />);
    const user = setupUser();
    const box = screen.getByRole('textbox', { name: 'Search' });
    expect(box).toHaveValue('first');

    await user.click(screen.getByRole('button', { name: 'Link' }));
    expect(box).toHaveValue('from a link');
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(box).toHaveValue('');
  });
});
