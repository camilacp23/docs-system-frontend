// Session notices with fake clocks: S-43a (warning toast with the local end time, dismissible) and S-43b
// ("Your session ended" dialog over the same page; "Sign in" returns to that page after signing in again).
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_USER } from '../helpers/fakeBackend';
import { PASSWORD, renderApp } from '../helpers/renderApp';

const MINUTE = 60_000;

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 23, 8, 0, 0)); // local time: 08:00
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function signedInWithSession(minutes: number, path = '/variables') {
  const view = await renderApp({ sessionExpiresIn: minutes * 60, path });
  await advance(10);
  return view;
}

describe('S-43a session ending', () => {
  it('shows a dismissible warning toast with the local end time 10 minutes before the end', async () => {
    await signedInWithSession(30); // ends 08:30
    expect(screen.queryByText(/Your session ends at/)).not.toBeInTheDocument();

    await advance(19 * MINUTE); // 08:19 -> not yet
    expect(screen.queryByText(/Your session ends at/)).not.toBeInTheDocument();

    await advance(2 * MINUTE); // 08:21 -> inside the last 10 minutes
    const toast = screen.getByRole('alert');
    expect(toast).toHaveTextContent(
      "Your session ends at 08:30. Save your work; you'll need to sign in again after that.",
    );
    expect(toast.querySelector('strong')).toHaveTextContent('08:30');

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(/Your session ends at/)).not.toBeInTheDocument();
  });

  it('stays until it is dismissed (no auto-close)', async () => {
    await signedInWithSession(15);
    await advance(6 * MINUTE);
    expect(screen.getByText(/Your session ends at/)).toBeInTheDocument();
    await advance(2 * MINUTE);
    expect(screen.getByText(/Your session ends at/)).toBeInTheDocument();
  });
});

describe('S-43b session ended', () => {
  it('shows the dialog over the same page and signs in again returning to it', async () => {
    const { router, backend } = await signedInWithSession(15, '/variables/4?x=1');
    await advance(16 * MINUTE);

    const dialog = screen.getByRole('dialog', { name: 'Your session ended' });
    expect(dialog).toHaveTextContent(
      'For security, sessions last up to 12 hours. Sign in again to continue where you were.',
    );
    expect(dialog).not.toHaveTextContent('unsaved changes');
    // The page stays behind the dialog.
    expect(router.state.location.pathname).toBe('/variables/4');
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    // The application stays in the card and the breadcrumb (it is not reloaded for an ended session).
    expect(screen.getAllByText('SAR').length).toBeGreaterThanOrEqual(2);
    // The dialog is blocking: Escape does not close it.
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: 'Your session ended' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await advance(10);
    expect(router.state.location.pathname).toBe('/login');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: TEST_USER.email } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: PASSWORD } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await advance(10);
    expect(router.state.location.pathname).toBe('/variables/4');
    expect(router.state.location.search).toBe('?x=1');
    // One login from the helper that opened the session and one from the dialog flow.
    expect(backend.count('/auth/login')).toBe(2);
  });
});
