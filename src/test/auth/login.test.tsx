// Sign in (S-01a, S-01b, S-01c): client validation, 401 banner, 429 with a countdown from Retry-After (or
// details.minutes), loading state, success and redirect to the remembered page.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '../../components/ui';
import { SessionManager } from '../../session/SessionManager';
import { SessionProvider } from '../../session/SessionProvider';
import { appRoutes } from '../../app/router/router';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { FakeBackend, FakeLocks, TEST_USER } from '../helpers/fakeBackend';
import { PASSWORD, renderApp } from '../helpers/renderApp';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function openLogin(options: { path?: string } = {}) {
  const view = await renderApp({ signedIn: false, path: options.path ?? '/login' });
  await screen.findByRole('heading', { name: 'Sign in' });
  return view;
}

function fill(email: string, password: string) {
  fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: password } });
}

describe('login page', () => {
  it('renders the sign-in card with the exact copy', async () => {
    await openLogin();
    expect(screen.getByText('Use your department account.')).toBeInTheDocument();
    expect(
      screen.getByText("Technical documentation of the department's applications"),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Enterprise Architecture Department · Sessions last up to 12 hours.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Forgot your password? Ask an administrator to reset it.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('validates on the client with the S-01c texts and does not call the API', async () => {
    const user = userEvent.setup();
    const { backend } = await openLogin();
    await user.type(screen.getByLabelText(/^Email/), 'camila.castillo@');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    const email = screen.getByLabelText(/^Email/);
    const password = screen.getByLabelText(/^Password/);
    expect(screen.getByText('Enter a valid email, e.g. name@domain.com.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAccessibleDescription('Enter a valid email, e.g. name@domain.com.');
    expect(password).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveFocus();
    expect(backend.count('/auth/login')).toBe(0);
  });

  it('validates an edited field when it loses focus, but not an untouched one', async () => {
    await openLogin();
    const email = screen.getByLabelText(/^Email/);
    const password = screen.getByLabelText(/^Password/);
    fireEvent.blur(email);
    fireEvent.blur(password);
    expect(screen.queryByText('Enter your password.')).not.toBeInTheDocument();
    fireEvent.change(email, { target: { value: 'camila.castillo@' } });
    fireEvent.blur(email);
    expect(screen.getByText('Enter a valid email, e.g. name@domain.com.')).toBeInTheDocument();
    fireEvent.change(password, { target: { value: 'x' } });
    fireEvent.change(password, { target: { value: '' } });
    fireEvent.blur(password);
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
  });

  it('shows the S-01b banner on 401 (same text whatever the cause)', async () => {
    const user = userEvent.setup();
    await openLogin();
    await user.type(screen.getByLabelText(/^Email/), TEST_USER.email);
    await user.type(screen.getByLabelText(/^Password/), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The email or password is incorrect.',
    );
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('shows the loading state while the request is in flight', async () => {
    const user = userEvent.setup();
    const { backend } = await openLogin();
    backend.latencyMs = 50;
    await user.type(screen.getByLabelText(/^Email/), TEST_USER.email);
    await user.type(screen.getByLabelText(/^Password/), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('button', { name: 'Sign in' })).toHaveAttribute('aria-busy', 'true');
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Sign in' })).not.toHaveAttribute('aria-busy');
  });

  it('signs in and returns to the remembered page', async () => {
    const user = userEvent.setup();
    const { router } = await openLogin({ path: '/variables/4?x=1' });
    // The guard sent the anonymous user to /login with the destination in the router state.
    expect(router.state.location.pathname).toBe('/login');
    await user.type(screen.getByLabelText(/^Email/), TEST_USER.email);
    await user.type(screen.getByLabelText(/^Password/), PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/variables/4');
    });
    expect(router.state.location.search).toBe('?x=1');
  });

  it('goes to /dashboard when there is no remembered page', async () => {
    const user = userEvent.setup();
    const { router } = await openLogin();
    await user.type(screen.getByLabelText(/^Email/), TEST_USER.email);
    await user.type(screen.getByLabelText(/^Password/), PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/dashboard');
    });
  });

  it('toggles the password visibility', async () => {
    const user = userEvent.setup();
    await openLogin();
    const password = screen.getByLabelText(/^Password/);
    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show' }));
    expect(password).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide' }));
    expect(password).toHaveAttribute('type', 'password');
  });
});

describe('rate limit (429)', () => {
  async function renderRateLimited(headers: Record<string, string>) {
    vi.useFakeTimers();
    const backend = new FakeBackend();
    backend.loginFailure = { status: 429, code: 'RATE_LIMITED', details: { minutes: 14 }, headers };
    backend.install();
    const manager = new SessionManager({ lock: new FakeLocks(), createChannel: () => null });
    const router = createMemoryRouter(appRoutes, { initialEntries: ['/login'] });
    render(
      <SessionProvider manager={manager}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </SessionProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    fill(TEST_USER.email, PASSWORD);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    return backend;
  }

  it('counts down from Retry-After and enables the button again at zero', async () => {
    const backend = await renderRateLimited({ 'Retry-After': '90' });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Too many attempts. Try again in 14 minutes.',
    );
    const button = screen.getByRole('button', { name: 'Try again in 01:30' });
    expect(button).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByRole('button', { name: 'Try again in 01:29' })).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(89_000);
    });
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    expect(backend.count('/auth/login')).toBe(1);
  });

  it('uses details.minutes x 60 when Retry-After is missing', async () => {
    await renderRateLimited({});
    expect(screen.getByRole('button', { name: 'Try again in 14:00' })).toBeDisabled();
  });

  it('does not send another request while counting down', async () => {
    const backend = await renderRateLimited({ 'Retry-After': '60' });
    fireEvent.submit(
      screen.getByRole('button', { name: /Try again in/ }).closest('form') as HTMLFormElement,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(backend.count('/auth/login')).toBe(1);
  });
});
