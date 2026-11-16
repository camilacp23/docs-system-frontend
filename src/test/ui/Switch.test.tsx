// Switch (design system): role="switch" with aria-checked, Space and Enter, the label that is also its name, and a disabled
// switch that stays reachable by keyboard, does not change and gives its reason to assistive technology.
import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Switch } from '../../components/ui';
import { setupUser } from '../helpers/setupUser';

function Controlled({ onChange = () => undefined }: { onChange?: (next: boolean) => void }) {
  const [checked, setChecked] = useState(false);
  return (
    <Switch
      checked={checked}
      label="Include dependencies"
      description="What each screen reads, writes and opens"
      onChange={(next) => {
        setChecked(next);
        onChange(next);
      }}
    />
  );
}

describe('Switch', () => {
  it('is a switch named by its label, with its description', () => {
    render(<Controlled />);
    const control = screen.getByRole('switch', { name: 'Include dependencies' });
    expect(control).toHaveAttribute('aria-checked', 'false');
    expect(control).toHaveAccessibleDescription('What each screen reads, writes and opens');
  });

  it('changes with a click on the control, on its label, and with Space and Enter', async () => {
    const user = setupUser();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const control = screen.getByRole('switch');

    await user.click(control);
    await user.click(screen.getByText('Include dependencies'));
    control.focus();
    await user.keyboard(' ');
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledTimes(4);
    expect(onChange.mock.calls).toEqual([[true], [false], [true], [false]]);
  });

  it('stays in the tab order when disabled, does not change and gives its reason', async () => {
    const user = setupUser();
    const onChange = vi.fn();
    render(
      <Switch
        checked={false}
        label="Not published"
        disabled
        disabledReason="Available when the report is ready."
        onChange={onChange}
      />,
    );
    const control = screen.getByRole('switch');

    await user.tab();
    expect(control).toHaveFocus();
    await user.keyboard(' ');
    await user.click(control);

    expect(onChange).not.toHaveBeenCalled();
    expect(control).toHaveAttribute('aria-disabled', 'true');
    expect(control).toHaveAccessibleDescription('Available when the report is ready.');
    expect(control.parentElement).toHaveAttribute('title', 'Available when the report is ready.');
  });

  it('ignores presses and says it is busy while a change is being sent', async () => {
    const user = setupUser();
    const onChange = vi.fn();
    render(<Switch checked={false} label="Published" loading onChange={onChange} />);
    const control = screen.getByRole('switch');

    await user.click(control);

    expect(onChange).not.toHaveBeenCalled();
    expect(control).toHaveAttribute('aria-busy', 'true');
  });
});
