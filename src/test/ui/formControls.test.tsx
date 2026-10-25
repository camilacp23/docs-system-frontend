// Select, Textarea, Checkbox, SegmentedControl: labelling, invalid state, disabled state and keyboard use.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Checkbox, FormField, SegmentedControl, Select, Textarea } from '../../components/ui';

describe('Select', () => {
  it('is labelled by its FormField and reports an error', () => {
    render(
      <FormField label="Data type" error="Choose one.">
        {(control) => (
          <Select {...control}>
            <option value="TEXT">Text</option>
          </Select>
        )}
      </FormField>,
    );

    const select = screen.getByLabelText('Data type');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAccessibleDescription('Choose one.');
  });

  it('changes value from the keyboard-accessible control', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Select aria-label="Type" onChange={onChange} defaultValue="TEXT">
        <option value="TEXT">Text</option>
        <option value="NUMBER">Number</option>
      </Select>,
    );

    await user.selectOptions(screen.getByLabelText('Type'), 'NUMBER');

    expect(onChange).toHaveBeenCalled();
    expect(screen.getByLabelText('Type')).toHaveValue('NUMBER');
  });

  it('can be disabled', () => {
    render(
      <Select aria-label="Type" disabled>
        <option>Text</option>
      </Select>,
    );
    expect(screen.getByLabelText('Type')).toBeDisabled();
  });
});

describe('Textarea', () => {
  it('is labelled, invalid and accepts typing', async () => {
    const user = userEvent.setup();
    render(
      <FormField label="Description" error="Too long.">
        {(control) => <Textarea {...control} />}
      </FormField>,
    );

    const field = screen.getByLabelText('Description');
    await user.type(field, 'hello');

    expect(field).toHaveValue('hello');
    expect(field).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('Checkbox', () => {
  it('toggles from its label and from the keyboard', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [checked, setChecked] = useState(false);
      return (
        <Checkbox
          label="DEV"
          checked={checked}
          onChange={(event) => {
            setChecked(event.target.checked);
          }}
        />
      );
    }
    render(<Harness />);

    await user.click(screen.getByText('DEV'));
    expect(screen.getByRole('checkbox', { name: 'DEV' })).toBeChecked();

    await user.keyboard(' ');
    expect(screen.getByRole('checkbox', { name: 'DEV' })).not.toBeChecked();
  });

  it('does not toggle when disabled', async () => {
    const user = userEvent.setup();
    render(<Checkbox label="PROD" disabled />);

    await user.click(screen.getByText('PROD'));

    expect(screen.getByRole('checkbox', { name: 'PROD' })).not.toBeChecked();
  });
});

describe('SegmentedControl', () => {
  const options = [
    { value: 'GLOBAL', label: 'Global (Set)' },
    { value: 'CONTEXT', label: 'Context (UpdateContext)' },
  ] as const;

  it('is a labelled radio group and reports the choice', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SegmentedControl
        name="scope"
        label="Scope"
        options={options}
        value="GLOBAL"
        onChange={onChange}
      />,
    );

    expect(screen.getByRole('radiogroup', { name: 'Scope' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Global (Set)' })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: 'Context (UpdateContext)' }));
    expect(onChange).toHaveBeenCalledWith('CONTEXT');
  });

  it('moves with the arrow keys', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SegmentedControl
        name="scope"
        label="Scope"
        options={options}
        value="GLOBAL"
        onChange={onChange}
      />,
    );

    screen.getByRole('radio', { name: 'Global (Set)' }).focus();
    await user.keyboard('{ArrowRight}');

    expect(onChange).toHaveBeenCalledWith('CONTEXT');
  });

  it('disables one option and explains why', () => {
    render(
      <SegmentedControl
        name="scope"
        label="Scope"
        value="GLOBAL"
        onChange={vi.fn()}
        options={[
          { value: 'GLOBAL', label: 'Global' },
          { value: 'CONTEXT', label: 'Context', disabled: true, title: 'Not available' },
        ]}
      />,
    );

    expect(screen.getByRole('radio', { name: 'Context' })).toBeDisabled();
    expect(screen.getByTitle('Not available')).toBeInTheDocument();
  });
});
