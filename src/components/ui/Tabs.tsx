// Tabs: the tab bar of a detail page (S-15a-c: Overview, Fields, Variable assignments), WAI-ARIA tabs pattern.
// Props: label (accessible name of the tab list), tabs ({ key, label, count? }), value (the selected key),
// onChange(key), idPrefix (the ids of tabs and panels are `<idPrefix>-tab-<key>` and `<idPrefix>-panel-<key>`; give
// the panel role="tabpanel", id and aria-labelledby with them, see tabPanelProps in tabPanelProps.ts).
// One tab is in the tab order (the selected one); Left / Right / Home / End move to another tab and select it
// (automatic activation). The selection is the page's: it lives in the URL (D-57) and arrives here as `value`.
import type { KeyboardEvent, ReactNode } from 'react';

import { cx } from './cx';

export interface TabItem<K extends string> {
  key: K;
  label: ReactNode;
  /** A number shown in a small badge after the label. */
  count?: number;
}

export interface TabsProps<K extends string> {
  label: string;
  tabs: readonly TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  idPrefix: string;
  className?: string;
}

export function Tabs<K extends string>({
  label,
  tabs,
  value,
  onChange,
  idPrefix,
  className,
}: TabsProps<K>) {
  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1;
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    const target = tabs[next];
    if (target === undefined) return;
    onChange(target.key);
    document.getElementById(`${idPrefix}-tab-${target.key}`)?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cx(
        'inline-flex gap-1 rounded-card border border-border-subtle bg-surface p-1 shadow-card',
        className,
      )}
    >
      {tabs.map((tab, index) => {
        const selected = tab.key === value;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${tab.key}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${tab.key}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => {
              onChange(tab.key);
            }}
            onKeyDown={(event) => {
              move(event, index);
            }}
            className={cx(
              'flex h-9 items-center gap-2 rounded-control px-3.5 text-body-lg font-medium whitespace-nowrap',
              selected
                ? 'bg-navy-900 text-on-primary'
                : 'text-ink-700 hover:bg-control-hover active:bg-control-active',
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cx(
                  'rounded-pill px-1.5 text-tag font-bold',
                  selected ? 'bg-sidebar-switch text-on-primary' : 'bg-disabled-bg text-ink-700',
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
