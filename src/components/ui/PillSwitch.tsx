// PillSwitch: a short list of mutually exclusive choices drawn as a pill with the chosen one filled with the color of its page
// (the scope of the variable list, the filter of the reports). Built on native radios, so arrow keys, focus and screen readers
// work as a radio group.
// Props: name (radio group name), label (accessible name of the group), options ({ value, label }), value, onChange(value),
// tone ('variable' | 'report' | 'map': the color of the page).
import { cx } from './cx';

export type PillSwitchTone = 'variable' | 'report' | 'map';

/** Written out so Tailwind finds the classes. */
const ON: Record<PillSwitchTone, string> = {
  variable: 'bg-variable text-on-primary shadow-button',
  report: 'bg-report text-on-primary shadow-button',
  map: 'bg-map text-on-primary shadow-button',
};
const OFF: Record<PillSwitchTone, string> = {
  variable: 'text-ink-700 hover:bg-variable-soft hover:text-variable-ink',
  report: 'text-ink-700 hover:bg-report-soft hover:text-report-ink',
  map: 'text-ink-700 hover:bg-map-soft hover:text-map-ink',
};

export interface PillSwitchProps<V extends string> {
  name: string;
  label: string;
  options: readonly { value: V; label: string }[];
  value: V;
  onChange: (value: V) => void;
  tone: PillSwitchTone;
  disabled?: boolean;
}

export function PillSwitch<V extends string>({
  name,
  label,
  options,
  value,
  onChange,
  tone,
  disabled = false,
}: PillSwitchProps<V>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex gap-0.5 rounded-pill border border-border-subtle bg-surface p-0.5 shadow-button"
    >
      {options.map((option) => (
        <label
          key={option.value}
          className={cx(
            'relative flex h-8 cursor-pointer items-center justify-center rounded-pill px-4 text-label font-semibold whitespace-nowrap transition-colors duration-150 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus-ring motion-reduce:transition-none',
            value === option.value ? ON[tone] : OFF[tone],
          )}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            disabled={disabled}
            onChange={() => {
              onChange(option.value);
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}
