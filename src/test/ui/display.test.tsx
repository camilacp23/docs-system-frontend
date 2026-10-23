// Presentational components: Banner roles, StatusTag labels, ErrorState copy (S-41a/b/c), EmptyState, Avatar, icons.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  Avatar,
  Banner,
  DOCUMENTATION_STATUSES,
  ElementTypeIcon,
  EmptyState,
  ErrorState,
  Spinner,
  StatusTag,
} from '../../components/ui';

describe('Banner', () => {
  it('announces danger and warning as alerts, info and success as status', () => {
    render(
      <>
        <Banner tone="danger" lead="Error.">
          Failed
        </Banner>
        <Banner tone="warning" lead="Warning.">
          Stale
        </Banner>
        <Banner tone="info" lead="Info.">
          FYI
        </Banner>
        <Banner tone="success" lead="Success.">
          Done
        </Banner>
      </>,
    );

    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(screen.getAllByRole('status')).toHaveLength(2);
  });

  it('puts the lead word in bold and renders actions and dismiss', async () => {
    const onDismiss = vi.fn();
    render(
      <Banner
        tone="warning"
        lead="Warning."
        actions={<button type="button">Reload</button>}
        onDismiss={onDismiss}
      >
        Someone else saved changes.
      </Banner>,
    );

    expect(screen.getByText('Warning.')).toHaveClass('font-semibold');
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('StatusTag', () => {
  it('shows the fixed label of each of the five statuses', () => {
    render(
      <>
        {DOCUMENTATION_STATUSES.map((status) => (
          <StatusTag key={status} status={status} />
        ))}
      </>,
    );

    for (const label of ['Undocumented', 'Draft', 'In progress', 'In review', 'Approved']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});

describe('ErrorState', () => {
  it('not-found names the element and offers the way back (S-41a)', async () => {
    const onAction = vi.fn();
    render(
      <ErrorState
        variant="not-found"
        element="variable"
        listLabel="Variables"
        onAction={onAction}
      />,
    );

    expect(
      screen.getByRole('heading', { name: "This variable doesn't exist" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('It may have been deleted. Its history stays in the audit log.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back to Variables' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('no-access names the role (S-41b)', () => {
    render(<ErrorState variant="no-access" roleName="Reader" />);

    expect(
      screen.getByRole('heading', { name: "You don't have access to this page" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your role (Reader) doesn't include it. Ask an administrator if you need it.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to Dashboard' })).toBeInTheDocument();
  });

  it('server-error shows the request reference (S-41c)', () => {
    render(<ErrorState variant="server-error" requestId="7f3c2a" />);

    expect(
      screen.getByRole('heading', { name: 'Something went wrong on our side' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByText('7f3c2a')).toHaveClass('font-mono');
  });

  it('server-error without a reference omits the line', () => {
    render(<ErrorState variant="server-error" />);

    expect(screen.queryByText(/Reference:/)).not.toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('renders title, help and the optional action', () => {
    render(
      <EmptyState
        icon={<svg />}
        title="No collections yet"
        description="Record SAR's collections and their fields."
        action={<button type="button">New collection</button>}
      />,
    );

    expect(screen.getByRole('heading', { name: 'No collections yet' })).toBeInTheDocument();
    expect(screen.getByText("Record SAR's collections and their fields.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New collection' })).toBeInTheDocument();
  });

  it('omits the action when the role cannot act', () => {
    render(<EmptyState icon={<svg />} title="No collections yet" description="Nothing here." />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('Avatar, Spinner and ElementTypeIcon', () => {
  it('shows the initials of the first and last words', () => {
    render(<Avatar name="Camila Castillo" />);

    const avatar = screen.getByRole('img', { name: 'Camila Castillo' });
    expect(avatar).toHaveTextContent('CC');
  });

  it('can be decorative', () => {
    render(<Avatar name="Sample Reader" decorative />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('SR')).toBeInTheDocument();
  });

  it('a spinner with a label is a status, without one it is hidden', () => {
    const { rerender } = render(<Spinner label="Loading" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading');

    rerender(<Spinner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders one distinct icon per element type with an optional accessible name', () => {
    render(
      <>
        <ElementTypeIcon type="screen" label="Screen" />
        <ElementTypeIcon type="variable" label="Variable" />
        <ElementTypeIcon type="collection" label="Collection" />
        <ElementTypeIcon type="component" label="Component" />
      </>,
    );

    for (const name of ['Screen', 'Variable', 'Collection', 'Component']) {
      expect(screen.getByRole('img', { name })).toBeInTheDocument();
    }
  });
});
