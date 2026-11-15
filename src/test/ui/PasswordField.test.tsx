// PasswordField: masked by default, accessible eye toggle (Show / Hide password), keyboard operation, wiring with the input.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { PasswordField } from '../../components/ui';

describe('PasswordField', () => {
  it('masks the value by default and offers "Show password"', () => {
    render(<PasswordField aria-label="Password" />);

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument();
  });

  it('reveals and hides the value with the toggle', async () => {
    render(<PasswordField aria-label="Password" defaultValue="s3cret" />);
    const input = screen.getByLabelText('Password');

    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveValue('s3cret');

    await userEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('works with the keyboard and is a plain button, not a submit', async () => {
    render(<PasswordField aria-label="Password" />);
    const input = screen.getByLabelText('Password');

    await userEvent.tab(); // input
    await userEvent.tab(); // toggle
    const toggle = screen.getByRole('button', { name: 'Show password' });
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute('type', 'button');

    await userEvent.keyboard('{Enter}');
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveFocus();

    await userEvent.keyboard(' ');
    expect(input).toHaveAttribute('type', 'password');
  });

  it('controls the input it toggles (aria-controls) using the provided id', () => {
    render(<PasswordField id="pwd" aria-label="Password" />);

    expect(screen.getByRole('button', { name: 'Show password' })).toHaveAttribute(
      'aria-controls',
      'pwd',
    );
    expect(screen.getByLabelText('Password')).toHaveAttribute('id', 'pwd');
  });

  it('generates an id when none is given', () => {
    render(<PasswordField aria-label="Password" />);

    const id = screen.getByLabelText('Password').id;
    expect(id).not.toBe('');
    expect(screen.getByRole('button', { name: 'Show password' })).toHaveAttribute(
      'aria-controls',
      id,
    );
  });

  it('disables the toggle together with the input', () => {
    render(<PasswordField aria-label="Password" disabled />);

    expect(screen.getByLabelText('Password')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Show password' })).toBeDisabled();
  });

  it('marks the input invalid', () => {
    render(<PasswordField aria-label="Password" invalid />);

    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
  });
});
