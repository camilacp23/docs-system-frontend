// Button: type default, loading state (aria-busy, blocked clicks, focus kept), disabled state.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from '../../components/ui';

describe('Button', () => {
  it('renders a type="button" button by default and fires onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('type', 'button');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('marks itself busy and ignores clicks while loading', async () => {
    const onClick = vi.fn();
    render(
      <Button variant="primary" loading onClick={onClick}>
        Save
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button.querySelector('svg')).toBeInTheDocument();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('stays focusable while loading (it is not natively disabled)', async () => {
    render(<Button loading>Save</Button>);

    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
  });

  it('does not submit the surrounding form while loading', async () => {
    const onSubmit = vi.fn((event: React.SyntheticEvent) => {
      event.preventDefault();
    });
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit" loading>
          Sign in
        </Button>
      </form>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the form when idle', async () => {
    const onSubmit = vi.fn((event: React.SyntheticEvent) => {
      event.preventDefault();
    });
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit">Sign in</Button>
      </form>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('is natively disabled and skips the tab order when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders the decorative left icon', () => {
    render(<Button iconLeft={<svg data-testid="icon" />}>New</Button>);

    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });
});
