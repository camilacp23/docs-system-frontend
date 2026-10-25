// Pagination, SortableHeader, ActionMenu, Tag: behavior and accessibility semantics of the list building blocks.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  ActionMenu,
  Pagination,
  SortableHeader,
  Tag,
  nextSort,
  visiblePages,
} from '../../components/ui';

describe('visiblePages', () => {
  it('shows every page when there are few', () => {
    expect(visiblePages(2, 3)).toEqual([1, 2, 3]);
  });

  it('marks gaps between distant pages', () => {
    expect(visiblePages(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
  });
});

describe('Pagination', () => {
  it('shows the range and moves between pages', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <Pagination
        page={2}
        pageSize={20}
        total={45}
        onPageChange={onPageChange}
        onPageSizeChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Showing 21–40 of 45')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('disables both arrows and shows 0–0 when empty', () => {
    render(
      <Pagination
        page={1}
        pageSize={20}
        total={0}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Showing 0–0 of 0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('offers 20, 50 and 100 rows per page', async () => {
    const user = userEvent.setup();
    const onPageSizeChange = vi.fn();
    render(
      <Pagination
        page={1}
        pageSize={20}
        total={500}
        onPageChange={vi.fn()}
        onPageSizeChange={onPageSizeChange}
      />,
    );

    const select = screen.getByLabelText('Rows per page');
    expect([...select.querySelectorAll('option')].map((o) => o.value)).toEqual(['20', '50', '100']);
    await user.selectOptions(select, '50');
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });
});

describe('SortableHeader', () => {
  it('toggles ascending and descending and exposes aria-sort', async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    render(
      <table>
        <thead>
          <tr>
            <SortableHeader label="Name" sortKey="name" sort="name" onSort={onSort} />
            <SortableHeader label="Scope" sortKey="scope" sort="name" onSort={onSort} />
          </tr>
        </thead>
      </table>,
    );

    expect(screen.getByRole('columnheader', { name: /name/i })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    expect(screen.getByRole('columnheader', { name: /scope/i })).toHaveAttribute(
      'aria-sort',
      'none',
    );

    await user.click(screen.getByRole('button', { name: 'Sort by Name' }));
    expect(onSort).toHaveBeenCalledWith('-name');
    await user.click(screen.getByRole('button', { name: 'Sort by Scope' }));
    expect(onSort).toHaveBeenCalledWith('scope');
  });

  it('nextSort cycles ascending to descending', () => {
    expect(nextSort('name', 'name')).toBe('-name');
    expect(nextSort('-name', 'name')).toBe('name');
    expect(nextSort('scope', 'name')).toBe('name');
  });
});

describe('ActionMenu', () => {
  function setup() {
    const onView = vi.fn();
    const onEdit = vi.fn();
    render(
      <ActionMenu
        label="Actions for gUsuario"
        items={[
          { key: 'view', label: 'View', onSelect: onView },
          { key: 'edit', label: 'Edit', onSelect: onEdit, disabled: true, reason: 'Read-only' },
        ]}
      />,
    );
    return { onView, onEdit };
  }

  it('opens with the keyboard, moves with arrows and runs an item', async () => {
    const user = userEvent.setup();
    const { onView } = setup();

    const trigger = screen.getByRole('button', { name: 'Actions for gUsuario' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    trigger.focus();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('menuitem', { name: 'View' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveFocus();
    await user.keyboard('{ArrowUp}{Enter}');

    expect(onView).toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });

  it('a disabled item explains itself and does nothing', async () => {
    const user = userEvent.setup();
    const { onEdit } = setup();

    await user.click(screen.getByRole('button', { name: 'Actions for gUsuario' }));
    const edit = screen.getByRole('menuitem', { name: 'Edit' });
    expect(edit).toHaveAttribute('aria-disabled', 'true');
    expect(edit).toHaveAttribute('title', 'Read-only');
    await user.click(edit);

    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the button', async () => {
    const user = userEvent.setup();
    setup();

    const trigger = screen.getByRole('button', { name: 'Actions for gUsuario' });
    await user.click(trigger);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});

describe('Tag', () => {
  it('renders its text', () => {
    render(<Tag tone="warning">Untraced</Tag>);
    expect(screen.getByText('Untraced')).toBeInTheDocument();
  });
});
