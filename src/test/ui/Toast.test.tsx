// Toast: provider API, auto-close timing, pause on hover, persistent warning toast, action, roles.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider, useToast } from '../../components/ui';
import type { ToastOptions } from '../../components/ui';

function Trigger({ options }: { options: ToastOptions }) {
  const { show } = useToast();
  return (
    <button
      type="button"
      onClick={() => {
        show(options);
      }}
    >
      Show toast
    </button>
  );
}

// fireEvent instead of user-event: with Vitest fake timers, user-event's async wrapper waits on a real timer.
function setup(options: ToastOptions) {
  render(
    <ToastProvider>
      <Trigger options={options} />
    </ToastProvider>,
  );
  return {
    show: () => {
      fireEvent.click(screen.getByRole('button', { name: 'Show toast' }));
    },
  };
}

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the message as a status and closes by itself after 5 s', () => {
    const toast = setup({ message: 'Variable saved.' });

    toast.show();
    expect(screen.getByRole('status')).toHaveTextContent('Variable saved.');

    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(screen.getByRole('status')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('honors a custom duration', () => {
    const toast = setup({ message: 'Quick', duration: 1000 });

    toast.show();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('pauses the countdown while hovered and resumes afterwards', () => {
    const toast = setup({ message: 'Hover me' });
    toast.show();

    fireEvent.mouseEnter(screen.getByRole('status'));
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(screen.getByRole('status')).toBeInTheDocument();

    fireEvent.mouseLeave(screen.getByRole('status'));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders an action link', () => {
    const toast = setup({
      message: 'TECHEA-108 created.',
      action: { label: 'Open in Jira', href: 'https://jira.example/TECHEA-108', external: true },
    });

    toast.show();
    const link = screen.getByRole('link', { name: 'Open in Jira' });
    expect(link).toHaveAttribute('href', 'https://jira.example/TECHEA-108');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('runs the action callback of a button action', () => {
    const onClick = vi.fn();
    const toast = setup({ message: 'Deleted.', action: { label: 'Undo', onClick } });

    toast.show();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('keeps a warning toast until dismissed, announced as an alert', () => {
    const toast = setup({ tone: 'warning', message: 'Your session ends at 18:05.' });

    toast.show();
    expect(screen.getByRole('alert')).toHaveTextContent('Your session ends at 18:05.');

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('has no close button on the default tone unless dismissible is set', () => {
    const toast = setup({ message: 'Saved.' });
    toast.show();

    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
  });

  it('stacks several toasts', () => {
    const toast = setup({ message: 'One' });

    toast.show();
    toast.show();
    expect(screen.getAllByRole('status')).toHaveLength(2);
  });

  it('throws when useToast is used outside the provider', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Trigger options={{ message: 'x' }} />)).toThrow(/ToastProvider/);
    error.mockRestore();
  });
});
