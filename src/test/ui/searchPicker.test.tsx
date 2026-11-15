// SearchPicker: combobox semantics, filtering, disabled options and keyboard use.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { FormField, SearchPicker, type SearchPickerOption } from '../../components/ui';

const OPTIONS: readonly SearchPickerOption[] = [
  { value: '1', label: 'gUsuario', detail: 'Global · App (OnStart)' },
  { value: '2', label: 'locFiltro', detail: 'Context · Inicio · write only' },
  { value: '3', label: 'locSinOrigen', detail: 'Set its origin screen first', disabled: true },
];

function Harness({
  onChange,
  onSubmit,
}: {
  onChange?: (value: string) => void;
  onSubmit?: () => void;
}) {
  const [value, setValue] = useState('');
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      <SearchPicker
        aria-label="Variable"
        options={OPTIONS}
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange?.(next);
        }}
      />
    </form>
  );
}

describe('SearchPicker', () => {
  it('is a labelled combobox that reports its error', () => {
    render(
      <FormField label="Variable" error="Variable is required.">
        {(control) => <SearchPicker {...control} options={OPTIONS} value="" onChange={vi.fn()} />}
      </FormField>,
    );
    const input = screen.getByRole('combobox', { name: 'Variable' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Variable is required.');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens on click, filters while typing and chooses with the mouse', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByRole('combobox', { name: 'Variable' });

    await user.click(input);
    expect(screen.getAllByRole('option')).toHaveLength(3);

    await user.type(input, 'FILT');
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('locFiltro');

    await user.click(options[0] as HTMLElement);
    expect(onChange).toHaveBeenCalledWith('2');
    expect(input).toHaveValue('locFiltro');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('also searches the detail text and says when nothing matches', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: 'Variable' });
    await user.type(input, 'app (onstart)');
    expect(screen.getByRole('option')).toHaveTextContent('gUsuario');
    await user.clear(input);
    await user.type(input, 'zzz');
    expect(within(screen.getByRole('listbox')).getByText('No matches.')).toBeInTheDocument();
  });

  it('moves over the enabled options with the arrow keys and chooses with Enter without submitting', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    render(<Harness onChange={onChange} onSubmit={onSubmit} />);
    const input = screen.getByRole('combobox', { name: 'Variable' });
    input.focus();

    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    const first = screen.getByRole('option', { name: /gUsuario/ });
    expect(input).toHaveAttribute('aria-activedescendant', first.id);

    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: /locFiltro/ }).id,
    );
    // The disabled option is skipped: the next one wraps to the first.
    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant', first.id);

    await user.keyboard('{ArrowUp}{Enter}');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('2');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(input).toHaveValue('locFiltro');
  });

  it('never chooses a disabled option and shows its reason', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.click(screen.getByRole('combobox', { name: 'Variable' }));
    const disabled = screen.getByRole('option', { name: /locSinOrigen/ });
    expect(disabled).toHaveAttribute('aria-disabled', 'true');
    expect(disabled).toHaveAttribute('title', 'Set its origin screen first');
    await user.click(disabled);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('closes with Escape restoring the chosen label, and when focus leaves', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Harness />
        <button type="button">Next</button>
      </>,
    );
    const input = screen.getByRole('combobox', { name: 'Variable' });
    await user.click(input);
    // An open list starts on its first enabled option.
    await user.keyboard('{Enter}');
    expect(input).toHaveValue('gUsuario');

    await user.click(input);
    await user.clear(input);
    await user.type(input, 'loc');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveValue('gUsuario');

    await user.click(input);
    await user.tab();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
  });

  it('can be disabled', () => {
    render(
      <SearchPicker
        aria-label="Variable"
        disabled
        options={OPTIONS}
        value="1"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Variable' })).toBeDisabled();
  });
});

describe('SearchPicker, options searched by the caller', () => {
  it('reports what is typed and the end of the typing, and keeps the options it was given', async () => {
    const user = userEvent.setup({ delay: null });
    const onQueryChange = vi.fn();
    render(
      <SearchPicker
        aria-label="User"
        filterOptions={false}
        options={[{ value: '9', label: 'Ana Mora', detail: 'ana@example.com' }]}
        value=""
        onChange={vi.fn()}
        onQueryChange={onQueryChange}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'User' }));
    await user.type(screen.getByRole('combobox', { name: 'User' }), 'zzz');
    expect(onQueryChange).toHaveBeenLastCalledWith('zzz');
    // 'zzz' matches neither the label nor the detail, yet the option stays: the caller searched.
    expect(screen.getByRole('option', { name: /Ana Mora/ })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(onQueryChange).toHaveBeenLastCalledWith('');
  });

  it('still filters on its own by default', async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <SearchPicker
        aria-label="User"
        options={[{ value: '9', label: 'Ana Mora' }]}
        value=""
        onChange={vi.fn()}
      />,
    );
    await user.type(screen.getByRole('combobox', { name: 'User' }), 'zzz');
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });
});
