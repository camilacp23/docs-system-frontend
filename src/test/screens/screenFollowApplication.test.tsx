// D-78 on the screen pages, through the real routes: opening a screen of another application selects that
// application, keeps the page and says "Switched to <application>."; only a switch made by the user from the shell
// sends the page back to the list.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { makeScreenDetail } from '../helpers/fakeScreensApi';
import { makeApplication } from '../helpers/renderApp';
import { renderScreens, sampleScreens } from '../helpers/renderScreens';

const APPLICATIONS = [makeApplication(1, { name: 'SAR' }), makeApplication(2, { name: 'Billing' })];
const billingScreen = makeScreenDetail(70, 'Facturas', { applicationId: 2 });

const card = () => within(screen.getByRole('navigation', { name: 'Breadcrumb' }));

const render = (path: string) =>
  renderScreens({ path, screens: [...sampleScreens(), billingScreen], applications: APPLICATIONS });

describe('D-78 on the screen detail, through the routes', () => {
  it('selects the application, keeps the page and shows one toast when the page is opened', async () => {
    const { router } = await render('/screens/70');

    expect(await screen.findByText('Switched to Billing.')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Facturas', level: 1 })).toBeInTheDocument();
    await waitFor(() => {
      expect(card().getByText('Billing')).toBeInTheDocument();
    });
    expect(router.state.location.pathname).toBe('/screens/70');
    expect(screen.getAllByText('Switched to Billing.')).toHaveLength(1);
    expect(localStorage.getItem('docs.selectedApplicationId')).toBe('2');
  });

  it('does not switch for a screen of the selected application', async () => {
    await render('/screens/12');

    expect(await screen.findByRole('heading', { name: 'Detalle', level: 1 })).toBeInTheDocument();
    expect(screen.queryByText(/Switched to/)).not.toBeInTheDocument();
  });

  it('switches again, and stays, when the user moves to a screen of another application inside the app', async () => {
    const { router } = await render('/screens/12');
    await screen.findByRole('heading', { name: 'Detalle', level: 1 });

    await router.navigate('/screens/70');

    expect(await screen.findByText('Switched to Billing.')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Facturas', level: 1 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/screens/70');
  });

  it('goes back to the list only when the user switches application from the shell', async () => {
    const user = userEvent.setup();
    const { router } = await render('/screens/70');
    await screen.findByText('Switched to Billing.');
    await screen.findByRole('heading', { name: 'Facturas', level: 1 });
    // The automatic switch did not send the page anywhere.
    expect(router.state.location.pathname).toBe('/screens/70');

    await user.click(await screen.findByRole('button', { name: 'Switch application' }));
    await user.click(screen.getByRole('button', { name: 'SAR' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/screens');
    });
  });

  it('goes back to the list when the user switches from the shell on a screen of the selected application', async () => {
    const user = userEvent.setup();
    const { router } = await render('/screens/12');
    await screen.findByRole('heading', { name: 'Detalle', level: 1 });

    await user.click(await screen.findByRole('button', { name: 'Switch application' }));
    await user.click(screen.getByRole('button', { name: 'Billing' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/screens');
    });
  });
});
