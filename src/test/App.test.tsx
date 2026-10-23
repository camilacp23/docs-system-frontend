// Smoke test: the minimal application renders the product name.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from '../app/App';

describe('App', () => {
  it('renders the product name', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Documentación técnica' })).toBeInTheDocument();
  });
});
