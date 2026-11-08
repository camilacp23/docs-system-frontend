// screenEditHelpers: what the tests of the screen edit page share.
//   screensWith(status)         the sample screens with Detalle (id 12, the one with components and links) in `status`
//   openEdit(options)           renders /screens/<id>/edit (default 12, Detalle) as a Developer and waits for the form
//   choose(user, name, option)  opens the search picker named `name` and chooses the option whose text matches
//   replaceText(user, field, text)  clears the field and pastes the text (use `user.type` when typing itself is tested)
//   lastPut(api)                the body and the If-Match of the last PUT /screens/{id}
import { screen, within } from '@testing-library/react';

import type { Screen, ScreenUpdate } from '../../modules/screens/screenTypes';
import type { makeScreensApi } from './fakeScreensApi';
import { renderScreens, sampleScreens, type RenderScreensOptions } from './renderScreens';
import { setupUser, type User } from './setupUser';

export type ScreensApi = ReturnType<typeof makeScreensApi>;
export type { User };

export function screensWith(status: Screen['documentationStatus']): Screen[] {
  return sampleScreens().map((candidate) =>
    candidate.id === 12 ? { ...candidate, documentationStatus: status } : candidate,
  );
}

export async function openEdit(
  options: Omit<RenderScreensOptions, 'path'> & { id?: number; tab?: string } = {},
) {
  const { tab, id = 12, ...rest } = options;
  const user = setupUser();
  const view = await renderScreens({
    screens: screensWith('IN_PROGRESS'),
    ...rest,
    path: `/screens/${id}/edit${tab ? `?tab=${tab}` : ''}`,
  });
  await screen.findByRole('heading', { name: /^Edit /, level: 1 });
  return { user, ...view };
}

export async function choose(user: User, name: string, option: RegExp | string) {
  await user.click(screen.getByRole('combobox', { name }));
  const list = await screen.findByRole('listbox');
  await user.click(within(list).getByRole('option', { name: option }));
}

/** Puts a text in a field in one step, replacing what it had: how fast it is typed is not what the test checks. */
export async function replaceText(user: User, field: HTMLElement, text: string) {
  await user.clear(field);
  await user.click(field);
  await user.paste(text);
}

export function lastPut(api: ScreensApi): { body: ScreenUpdate; ifMatch: string | undefined } {
  const calls = api.callsTo('PUT /screens/{id}');
  const call = calls[calls.length - 1];
  if (call === undefined) throw new Error('no PUT /screens/{id} was sent');
  return { body: call.options.body as ScreenUpdate, ifMatch: call.options.ifMatch };
}

export const tab = (name: string) => screen.getByRole('tab', { name });
