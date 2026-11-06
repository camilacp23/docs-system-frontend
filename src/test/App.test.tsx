// Smoke test: the real App recovers no session (no refresh cookie) and shows the sign-in page.
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../app/App';

import { FakeBackend } from './helpers/fakeBackend';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('App', () => {
  it('sends an anonymous visitor to the sign-in page', async () => {
    new FakeBackend().install();
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Documentación técnica' })).toBeInTheDocument();
  });
});
