// ChoiceCard (the format cards of S-34) and ToggleChip (its Include and status chips): native controls that the keyboard and
// assistive technology operate, with a state that never depends on color alone.
import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ChoiceCard, ToggleChip } from '../../components/ui';
import { setupUser } from '../helpers/setupUser';

function Cards({ onChange }: { onChange: (value: string) => void }) {
  const [value, setValue] = useState('PDF');
  return (
    <div role="radiogroup" aria-label="Format">
      {['PDF', 'XLSX'].map((format) => (
        <ChoiceCard
          key={format}
          name="format"
          value={format}
          checked={value === format}
          onChange={(next) => {
            onChange(next);
            setValue(next);
          }}
          title={format === 'PDF' ? 'PDF' : 'Excel'}
          description="Some help"
          badge={<b>{format}</b>}
        />
      ))}
    </div>
  );
}

describe('ChoiceCard', () => {
  it('is a radio named by its title and described by its sentence, and arrows move the choice', async () => {
    const user = setupUser();
    const onChange = vi.fn();
    render(<Cards onChange={onChange} />);

    const pdf = screen.getByRole('radio', { name: /PDF/ });
    expect(pdf).toBeChecked();
    pdf.focus();
    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('radio', { name: /Excel/ })).toBeChecked();
    expect(onChange).toHaveBeenCalledWith('XLSX');
  });

  it('does not change when disabled', async () => {
    const user = setupUser();
    const onChange = vi.fn();
    render(
      <ChoiceCard
        name="x"
        value="a"
        checked={false}
        disabled
        onChange={onChange}
        title="A"
        description="d"
      />,
    );

    await user.click(screen.getByRole('radio', { name: /A/ }));

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('ToggleChip', () => {
  it('is a button with aria-pressed that Space and Enter toggle, and a pressed chip shows a check', async () => {
    const user = setupUser();
    const onChange = vi.fn();
    function Chip() {
      const [pressed, setPressed] = useState(false);
      return (
        <ToggleChip
          pressed={pressed}
          onChange={(next) => {
            onChange(next);
            setPressed(next);
          }}
        >
          Screens
        </ToggleChip>
      );
    }
    const { container } = render(<Chip />);
    const chip = screen.getByRole('button', { name: 'Screens' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    expect(container.querySelector('svg')).toBeNull();

    chip.focus();
    await user.keyboard(' ');
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('svg')).not.toBeNull();
    await user.keyboard('{Enter}');

    expect(onChange.mock.calls).toEqual([[true], [false]]);
  });

  it('is flat and out of the tab order when disabled, and marks an invalid chip with the danger border', async () => {
    const user = setupUser();
    const onChange = vi.fn();
    render(
      <>
        <ToggleChip pressed={false} disabled onChange={onChange}>
          Draft
        </ToggleChip>
        <ToggleChip pressed invalid onChange={onChange}>
          Approved
        </ToggleChip>
      </>,
    );

    await user.click(screen.getByRole('button', { name: 'Draft' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Draft' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Approved' })).toHaveClass('border-danger');
  });
});
