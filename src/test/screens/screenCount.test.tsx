// The screen count of the application card (D-98): the total of GET /screens with pageSize 1, App (OnStart)
// included; it follows the application and is read again after a screen is created or deleted.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { makeScreenDetail } from '../helpers/fakeScreensApi';
import { makeApplication } from '../helpers/renderApp';
import { renderScreens, sampleScreens } from '../helpers/renderScreens';
import { setupUser } from '../helpers/setupUser';

/** The sidebar card of the application. */
const card = () => screen.getByText('Application').parentElement?.parentElement as HTMLElement;

describe('application card: screen count', () => {
  it('says how many screens the application has, App (OnStart) included', async () => {
    const { api } = await renderScreens({ path: '/dashboard' });

    expect(await within(card()).findByText('Power Apps · 5 screens')).toBeInTheDocument();
    expect(api.callsTo('GET /screens')[0]?.options.query).toMatchObject({
      applicationId: 1,
      pageSize: 1,
    });
  });

  it('uses the singular for one screen', async () => {
    await renderScreens({
      path: '/dashboard',
      screens: [makeScreenDetail(10, 'App (OnStart)', { isAppContext: true })],
    });

    expect(await within(card()).findByText('Power Apps · 1 screen')).toBeInTheDocument();
  });

  it('leaves the number out when it cannot be read, and the platform stays', async () => {
    await renderScreens({
      path: '/dashboard',
      prepare: (api) => {
        api.failNext('GET /screens', new ApiError({ status: 500, code: 'INTERNAL_ERROR' }));
      },
    });

    expect(await within(card()).findByText('Power Apps')).toBeInTheDocument();
    expect(within(card()).queryByText(/screens?$/)).not.toBeInTheDocument();
  });

  it('shows the archived chip instead of the platform line', async () => {
    await renderScreens({
      path: '/dashboard',
      applications: [makeApplication(1, { name: 'SAR', status: 'ARCHIVED' })],
    });

    expect(await within(card()).findByText('Archived · read-only')).toBeInTheDocument();
    expect(within(card()).queryByText(/Power Apps/)).not.toBeInTheDocument();
  });

  it('follows the selected application', async () => {
    const user = setupUser();
    await renderScreens({
      path: '/dashboard',
      screens: [
        ...sampleScreens(),
        makeScreenDetail(80, 'App (OnStart)', { applicationId: 2, isAppContext: true }),
        makeScreenDetail(81, 'Facturas', { applicationId: 2 }),
      ],
      applications: [makeApplication(1, { name: 'SAR' }), makeApplication(2, { name: 'Billing' })],
    });
    expect(await within(card()).findByText('Power Apps · 5 screens')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Switch application' }));
    await user.click(screen.getByRole('button', { name: 'Billing' }));

    expect(await within(card()).findByText('Power Apps · 2 screens')).toBeInTheDocument();
  });

  it('is read again after a screen is created', async () => {
    const user = setupUser();
    await renderScreens({ path: '/screens?new=1' });
    expect(await within(card()).findByText('Power Apps · 5 screens')).toBeInTheDocument();
    const dialog = within(await screen.findByRole('dialog'));

    await user.click(dialog.getByLabelText(/^Name\b/));
    await user.paste('Ajustes');
    await user.click(dialog.getByRole('button', { name: 'Create screen' }));

    expect(await within(card()).findByText('Power Apps · 6 screens')).toBeInTheDocument();
  });

  it('is read again after a screen is deleted', async () => {
    const user = setupUser();
    await renderScreens({ path: '/screens/13' });
    expect(await within(card()).findByText('Power Apps · 5 screens')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    const dialog = within(await screen.findByRole('dialog'));
    await dialog.findByText(/Busqueda has no components or links/);
    await user.click(dialog.getByRole('button', { name: 'Delete screen' }));

    await waitFor(() => {
      expect(within(card()).getByText('Power Apps · 4 screens')).toBeInTheDocument();
    });
  });
});
