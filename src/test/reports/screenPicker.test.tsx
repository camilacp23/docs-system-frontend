// The screen selector of the generate dialog (D-139): it searches on the server while the user types (after the pause of the
// other search boxes, with an AbortController, an old answer never replaces a newer one), reads 20 at a time with "Load
// more", keeps what was chosen as chips whatever the search, refuses a 501st screen, and Escape closes only the list.
import { act, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { ApiContext } from '../../api/useApi';
import { ScreenPicker } from '../../modules/reports/ScreenPicker';
import type { PickedScreen } from '../../modules/reports/reportForm';
import { makeScreenDetail, makeScreensApi } from '../helpers/fakeScreensApi';
import { makeApplication, makeApplicationsClient } from '../helpers/renderApp';
import { controlSearchTimers, endSearchPause } from '../helpers/searchPause';
import { setupUser } from '../helpers/setupUser';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function names(count: number) {
  return Array.from({ length: count }, (_, index) =>
    makeScreenDetail(100 + index, `Screen ${String(index + 1).padStart(2, '0')}`),
  );
}

function setup(screens = names(45), initial: PickedScreen[] = []) {
  const apps = makeApplicationsClient([makeApplication(1, { name: 'SAR' })]);
  const api = makeScreensApi(apps, { screenDetails: screens });
  const onChange = vi.fn<(next: PickedScreen[]) => void>();
  function Harness() {
    const [value, setValue] = useState<PickedScreen[]>(initial);
    return (
      <ApiContext value={api.client}>
        <ScreenPicker
          applicationId={1}
          value={value}
          onChange={(next) => {
            onChange(next);
            setValue(next);
          }}
        />
      </ApiContext>
    );
  }
  render(<Harness />);
  return { api, onChange };
}

const listCalls = (api: ReturnType<typeof makeScreensApi>) =>
  api.callsTo('GET /screens').map((call) => call.options.query);

describe('screen selector', () => {
  it('reads nothing until it is opened, then 20 screens of the application sorted by name', async () => {
    const user = setupUser();
    const { api } = setup();
    expect(listCalls(api)).toHaveLength(0);
    expect(screen.getByRole('button', { name: /All screens/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /All screens/ }));

    expect(await screen.findByRole('checkbox', { name: 'Screen 01' })).toBeInTheDocument();
    expect(listCalls(api)).toEqual([{ applicationId: 1, page: 1, pageSize: 20, sort: 'name' }]);
    expect(screen.getAllByRole('checkbox')).toHaveLength(20);
  });

  it('loads 20 more with "Load more" and stops offering it at the end', async () => {
    const user = setupUser();
    const { api } = setup();
    await user.click(screen.getByRole('button', { name: /All screens/ }));
    await screen.findByRole('checkbox', { name: 'Screen 01' });

    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByRole('checkbox', { name: 'Screen 21' })).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(40);
    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByRole('checkbox', { name: 'Screen 45' })).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    expect(listCalls(api).map((query) => query?.page)).toEqual([1, 2, 3]);
  });

  it('searches on the server with q after the pause, and keeps the chosen screens as chips whatever the search', async () => {
    controlSearchTimers();
    const user = setupUser();
    const { api, onChange } = setup([
      makeScreenDetail(1, 'Inicio'),
      makeScreenDetail(2, 'Detalle'),
      makeScreenDetail(3, 'Detalle de pedido'),
    ]);
    await user.click(screen.getByRole('button', { name: /All screens/ }));
    await user.click(await screen.findByRole('checkbox', { name: 'Inicio' }));

    await user.click(screen.getByRole('textbox', { name: 'Search screens' }));
    await user.paste('detalle');
    await endSearchPause();

    expect(await screen.findByRole('checkbox', { name: 'Detalle de pedido' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Inicio' })).not.toBeInTheDocument();
    expect(listCalls(api).at(-1)).toMatchObject({ q: 'detalle', page: 1, pageSize: 20 });
    // Inicio is no longer in the list but is still chosen, and shown.
    const chips = within(screen.getByRole('list', { name: 'Selected screens' }));
    expect(chips.getByText('Inicio')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1 screen selected/ })).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith([{ id: 1, name: 'Inicio' }]);
  });

  it('drops the answer of an old search that arrives after a newer one', async () => {
    controlSearchTimers();
    const user = setupUser();
    const { api } = setup([
      makeScreenDetail(1, 'Alfa uno'),
      makeScreenDetail(2, 'Alfa dos'),
      makeScreenDetail(3, 'Beta uno'),
    ]);
    await user.click(screen.getByRole('button', { name: /All screens/ }));
    await screen.findByRole('checkbox', { name: 'Alfa uno' });
    const held = api.hold((call) => call.options.query?.q === 'alfa');

    await user.click(screen.getByRole('textbox', { name: 'Search screens' }));
    await user.paste('alfa');
    await endSearchPause(); // the request for "alfa" is now waiting
    await user.clear(screen.getByRole('textbox', { name: 'Search screens' }));
    await user.paste('beta');
    await endSearchPause();
    expect(await screen.findByRole('checkbox', { name: 'Beta uno' })).toBeInTheDocument();

    await act(async () => {
      held.release();
      await Promise.resolve();
    });

    expect(screen.getByRole('checkbox', { name: 'Beta uno' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Alfa uno' })).not.toBeInTheDocument();
  });

  it('aborts the request of a search that was replaced', async () => {
    controlSearchTimers();
    const user = setupUser();
    const { api } = setup([makeScreenDetail(1, 'Alfa'), makeScreenDetail(2, 'Beta')]);
    await user.click(screen.getByRole('button', { name: /All screens/ }));
    await screen.findByRole('checkbox', { name: 'Alfa' });
    api.hold((call) => call.options.query?.q === 'alfa');

    await user.click(screen.getByRole('textbox', { name: 'Search screens' }));
    await user.paste('alfa');
    await endSearchPause();
    const options = api.callsTo('GET /screens').at(-1)?.options as unknown as {
      signal: AbortSignal;
    };
    expect(options.signal.aborted).toBe(false);
    await user.clear(screen.getByRole('textbox', { name: 'Search screens' }));
    await user.paste('beta');
    await endSearchPause();

    expect(options.signal.aborted).toBe(true);
  });

  it('says when nothing matches', async () => {
    controlSearchTimers();
    const user = setupUser();
    setup([makeScreenDetail(1, 'Inicio')]);
    await user.click(screen.getByRole('button', { name: /All screens/ }));
    await screen.findByRole('checkbox', { name: 'Inicio' });

    await user.click(screen.getByRole('textbox', { name: 'Search screens' }));
    await user.paste('zzz');
    await endSearchPause();

    expect(await screen.findByText('No screens match.')).toBeInTheDocument();
  });

  it('removes a chosen screen from its chip and clears the selection', async () => {
    const user = setupUser();
    const { onChange } = setup(names(3), [
      { id: 100, name: 'Screen 01' },
      { id: 101, name: 'Screen 02' },
    ]);

    await user.click(screen.getByRole('button', { name: 'Remove Screen 01' }));
    expect(onChange).toHaveBeenLastCalledWith([{ id: 101, name: 'Screen 02' }]);
    await user.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(screen.getByRole('button', { name: /All screens/ })).toBeInTheDocument();
  });

  it('refuses a 501st screen with the message and leaves the selection as it was', async () => {
    const user = setupUser();
    const chosen = Array.from({ length: 500 }, (_, index) => ({
      id: 1000 + index,
      name: `Old ${index}`,
    }));
    const { onChange } = setup([makeScreenDetail(5, 'One more')], chosen);
    await user.click(screen.getByRole('button', { name: /500 screens selected/ }));

    await user.click(await screen.findByRole('checkbox', { name: 'One more' }));

    expect(await screen.findByText('You can select up to 500 screens.')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: 'One more' })).not.toBeChecked();
    // Taking one off makes room again.
    await user.click(screen.getByRole('button', { name: 'Remove Old 0' }));
    await user.click(screen.getByRole('checkbox', { name: 'One more' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.arrayContaining([{ id: 5, name: 'One more' }]),
    );
  });

  it('closes only the list on Escape and gives the focus back to its button', async () => {
    const user = setupUser();
    const outer = vi.fn();
    document.addEventListener('keydown', outer);
    setup(names(3));
    const opener = screen.getByRole('button', { name: /All screens/ });
    await user.click(opener);
    await screen.findByRole('checkbox', { name: 'Screen 01' });
    expect(screen.getByRole('textbox', { name: 'Search screens' })).toHaveFocus();

    await user.keyboard('{Escape}');

    document.removeEventListener('keydown', outer);
    expect(screen.queryByRole('group', { name: 'Choose screens' })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(opener).toHaveAttribute('aria-expanded', 'false');
    // The key did not reach the dialog around the picker (its listener is on the document).
    expect(outer).not.toHaveBeenCalled();
  });

  it('keeps the list at 80 px with its own scroll, and the keyboard reaches and toggles its checkboxes', async () => {
    const user = setupUser();
    const { onChange } = setup();
    await user.click(screen.getByRole('button', { name: /All screens/ }));
    await screen.findByRole('checkbox', { name: 'Screen 01' });

    const list = screen.getByRole('list', { name: 'Screens to include' });
    expect(list).toHaveClass('max-h-20', 'overflow-y-auto');
    // From the search box Tab goes into the list, and Space chooses.
    screen.getByRole('textbox', { name: 'Search screens' }).focus();
    await user.tab();
    expect(screen.getByRole('checkbox', { name: 'Screen 01' })).toHaveFocus();
    await user.keyboard(' ');
    await user.tab();
    await user.keyboard(' ');

    expect(onChange).toHaveBeenLastCalledWith([
      { id: 100, name: 'Screen 01' },
      { id: 101, name: 'Screen 02' },
    ]);
  });

  it('shows a refused read with its catalog text', async () => {
    const user = setupUser();
    const { api } = setup(names(3));
    api.failNext(
      'GET /screens',
      new ApiError({ status: 500, code: 'INTERNAL_ERROR', requestId: 'r-1' }),
    );

    await user.click(screen.getByRole('button', { name: /All screens/ }));

    expect(
      await screen.findByText(
        'Something went wrong on our side. Try again in a moment. Reference: r-1.',
      ),
    ).toBeInTheDocument();
  });
});
