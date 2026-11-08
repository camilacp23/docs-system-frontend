// Modal: dialog semantics, focus placement / trap / return, Esc and overlay dismissal, blocking variant.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Button, Modal } from '../../components/ui';

function Harness({ dismissible = true }: { dismissible?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
        }}
      >
        Open
      </Button>
      <Modal
        open={open}
        dismissible={dismissible}
        onClose={() => {
          setOpen(false);
        }}
        title="Delete colClientes?"
        footer={
          <>
            <Button
              onClick={() => {
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button variant="danger">Delete</Button>
          </>
        }
      >
        Its fields are deleted too.
      </Modal>
    </>
  );
}

describe('Modal', () => {
  it('renders nothing while closed', () => {
    render(
      <Modal open={false} onClose={vi.fn()} title="Hidden">
        Body
      </Modal>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('exposes a labelled modal dialog', () => {
    render(
      <Modal open onClose={vi.fn()} title="Your session ended">
        Body
      </Modal>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Your session ended' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveTextContent('Body');
  });

  it('moves focus into the dialog on open and returns it to the trigger on close', async () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open' });

    await userEvent.click(trigger);
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('focuses the element given by initialFocusRef', () => {
    function WithInitialFocus() {
      const cancelRef = useRef<HTMLButtonElement>(null);
      return (
        <Modal
          open
          onClose={vi.fn()}
          title="Confirm"
          initialFocusRef={cancelRef}
          footer={
            <button type="button" ref={cancelRef}>
              Cancel
            </button>
          }
        >
          Body
        </Modal>
      );
    }
    render(<WithInitialFocus />);

    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('keeps focus where the user put it when the parent re-renders with a new ref object', async () => {
    function Rerendering() {
      const [count, setCount] = useState(0);
      return (
        <Modal open onClose={vi.fn()} title="Confirm" initialFocusRef={{ current: null }}>
          <input aria-label="Name" />
          <button
            type="button"
            onClick={() => {
              setCount(count + 1);
            }}
          >
            Rerender {count}
          </button>
        </Modal>
      );
    }
    render(<Rerendering />);

    await userEvent.click(screen.getByLabelText('Name'));
    await userEvent.click(screen.getByRole('button', { name: /Rerender/ }));
    expect(screen.getByRole('button', { name: 'Rerender 1' })).toHaveFocus();
  });

  it('traps Tab and Shift+Tab inside the dialog', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));

    const close = screen.getByRole('button', { name: 'Close' });
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const destroy = screen.getByRole('button', { name: 'Delete' });

    expect(close).toHaveFocus();
    await userEvent.tab();
    expect(cancel).toHaveFocus();
    await userEvent.tab();
    expect(destroy).toHaveFocus();
    await userEvent.tab(); // wraps to the first
    expect(close).toHaveFocus();
    await userEvent.tab({ shift: true }); // wraps to the last
    expect(destroy).toHaveFocus();
  });

  it('closes with Escape', async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Confirm">
        Body
      </Modal>,
    );

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes with the close button and with a click on the overlay, not on the panel', async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Confirm">
        Body
      </Modal>,
    );

    await userEvent.click(screen.getByText('Body'));
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    const overlay = screen.getByRole('dialog').parentElement as HTMLElement;
    await userEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('cannot be dismissed when dismissible is false', async () => {
    const onClose = vi.fn();
    render(
      <Modal
        open
        onClose={onClose}
        dismissible={false}
        title="Your session ended"
        footer={<Button variant="primary">Sign in</Button>}
      >
        Body
      </Modal>,
    );

    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('dialog').parentElement as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Sign in' })).toHaveFocus();
  });

  it('locks page scroll while open and restores it on close', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(document.body.style.overflow).toBe('hidden');

    await userEvent.keyboard('{Escape}');
    expect(document.body.style.overflow).toBe('');
  });

  it('names the dialog by its title and describes it by the line under the title', () => {
    render(
      <Modal
        open
        onClose={() => undefined}
        title="Return Detalle"
        description="The author can edit again."
      >
        Body
      </Modal>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Return Detalle' });
    expect(dialog).toHaveAccessibleDescription('The author can edit again.');
    expect(screen.getByText('The author can edit again.')).toBeVisible();
  });

  it('has no description when none is given', () => {
    render(
      <Modal open onClose={() => undefined} title="Delete">
        Body
      </Modal>,
    );

    expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-describedby');
  });
});
