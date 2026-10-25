// D-78 through the real routes: opening the detail or the edit page of an element of another application selects
// that application, keeps the page and says "Switched to <application>."; only a switch made by the user from the
// shell sends the page back to its list. The cases move between detail pages INSIDE the app (the page component is
// reused, only the :id changes): a decision remembered from the previous element must not be applied to the next one.
import { configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { makeCollection } from '../helpers/fakeCollectionsApi';
import { makeVariable } from '../helpers/fakeVariablesApi';
import { makeApplication } from '../helpers/renderApp';
import { renderCollections } from '../helpers/renderCollections';
import { renderVariables, sampleVariables } from '../helpers/renderVariables';

const APPLICATIONS = [makeApplication(1, { name: 'SAR' }), makeApplication(2, { name: 'Billing' })];
const billingVariable = makeVariable(7, 'gFactura', { applicationId: 2 });
const billingCollection = makeCollection(40, 'colFacturas', { applicationId: 2 });

const card = () => within(screen.getByRole('navigation', { name: 'Breadcrumb' }));

describe('D-78 on the variable pages, through the routes', () => {
  const render = (path: string) =>
    renderVariables({
      path,
      variables: [...sampleVariables(), billingVariable],
      applications: APPLICATIONS,
    });

  it('selects the application, keeps the page and shows one toast when the page is opened', async () => {
    const { router } = await render('/variables/7');

    expect(await screen.findByText('Switched to Billing.')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'gFactura', level: 1 })).toBeInTheDocument();
    await waitFor(() => {
      expect(card().getByText('Billing')).toBeInTheDocument();
    });
    expect(router.state.location.pathname).toBe('/variables/7');
    expect(screen.getAllByText('Switched to Billing.')).toHaveLength(1);
    expect(localStorage.getItem('docs.selectedApplicationId')).toBe('2');
  });

  it('does the same on the edit page', async () => {
    const { router } = await render('/variables/7/edit');

    expect(await screen.findByText('Switched to Billing.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/variables/7/edit');
  });

  it('switches again, and stays, when the user moves to a detail of another application inside the app', async () => {
    const { router } = await render('/variables/1');
    await screen.findByRole('heading', { name: 'gUsuario', level: 1 });
    expect(screen.queryByText(/Switched to/)).not.toBeInTheDocument();

    await router.navigate('/variables/7');

    expect(await screen.findByText('Switched to Billing.')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'gFactura', level: 1 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/variables/7');
    await waitFor(() => {
      expect(card().getByText('Billing')).toBeInTheDocument();
    });
  });

  it('switches back, and stays, with the Back button', async () => {
    const { router } = await render('/variables/1');
    await screen.findByRole('heading', { name: 'gUsuario', level: 1 });
    await router.navigate('/variables/7');
    await screen.findByText('Switched to Billing.');
    await screen.findByRole('heading', { name: 'gFactura', level: 1 });

    await router.navigate(-1);

    expect(await screen.findByText('Switched to SAR.')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'gUsuario', level: 1 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/variables/1');
  });

  it('goes back to the list only when the user switches application from the shell', async () => {
    const user = userEvent.setup();
    const { router } = await render('/variables/7');
    await screen.findByText('Switched to Billing.');
    await screen.findByRole('heading', { name: 'gFactura', level: 1 });
    // The automatic switch did not send the page anywhere.
    expect(router.state.location.pathname).toBe('/variables/7');

    await user.click(await screen.findByRole('button', { name: 'Switch application' }));
    await user.click(screen.getByRole('button', { name: 'SAR' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/variables');
    });
  });

  it('goes back to the list when the user switches from the shell after an in-app switch', async () => {
    const user = userEvent.setup();
    const { router } = await render('/variables/1');
    await screen.findByRole('heading', { name: 'gUsuario', level: 1 });
    await router.navigate('/variables/7');
    await screen.findByText('Switched to Billing.');
    await screen.findByRole('heading', { name: 'gFactura', level: 1 });

    await user.click(await screen.findByRole('button', { name: 'Switch application' }));
    await user.click(screen.getByRole('button', { name: 'SAR' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/variables');
    });
  });
});

describe('D-78 on the collection pages, through the routes', () => {
  const render = (path: string) =>
    renderCollections({
      path,
      collections: [makeCollection(11, 'colClientes'), billingCollection],
      applications: APPLICATIONS,
    });

  it('selects the application, keeps the page and shows one toast when the page is opened', async () => {
    const { router } = await render('/collections/40');

    expect(await screen.findByText('Switched to Billing.')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'colFacturas', level: 1 }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(card().getByText('Billing')).toBeInTheDocument();
    });
    expect(router.state.location.pathname).toBe('/collections/40');
    expect(screen.getAllByText('Switched to Billing.')).toHaveLength(1);
  });

  it('does the same on the edit page', async () => {
    const { router } = await render('/collections/40/edit');

    expect(await screen.findByText('Switched to Billing.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/collections/40/edit');
  });

  it('switches again, and stays, when the user moves to a detail of another application inside the app', async () => {
    const { router } = await render('/collections/11');
    await screen.findByRole('heading', { name: 'colClientes', level: 1 });

    await router.navigate('/collections/40');

    expect(await screen.findByText('Switched to Billing.')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'colFacturas', level: 1 }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/collections/40');
  });

  it('goes back to the list only when the user switches application from the shell', async () => {
    const user = userEvent.setup();
    const { router } = await render('/collections/40');
    await screen.findByText('Switched to Billing.');
    await screen.findByRole('heading', { name: 'colFacturas', level: 1 });
    expect(router.state.location.pathname).toBe('/collections/40');

    await user.click(await screen.findByRole('button', { name: 'Switch application' }));
    await user.click(screen.getByRole('button', { name: 'SAR' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/collections');
    });
  });
});

// main.tsx renders the app inside <StrictMode>, which runs every effect twice on mount: the same cases, as in the app.
describe('D-78 under StrictMode (as main.tsx renders the app)', () => {
  beforeAll(() => {
    configure({ reactStrictMode: true });
  });
  afterAll(() => {
    configure({ reactStrictMode: false });
  });

  it('variable: selects the application, stays on the page and shows one toast', async () => {
    const { router } = await renderVariables({
      path: '/variables/7',
      variables: [...sampleVariables(), billingVariable],
      applications: APPLICATIONS,
    });

    expect(await screen.findByText('Switched to Billing.')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'gFactura', level: 1 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/variables/7');
    expect(screen.getAllByText('Switched to Billing.')).toHaveLength(1);
  });

  it('collection: selects the application, stays on the page and shows one toast', async () => {
    const { router } = await renderCollections({
      path: '/collections/40',
      collections: [makeCollection(11, 'colClientes'), billingCollection],
      applications: APPLICATIONS,
    });

    expect(await screen.findByText('Switched to Billing.')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'colFacturas', level: 1 }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/collections/40');
    expect(screen.getAllByText('Switched to Billing.')).toHaveLength(1);
  });
});
