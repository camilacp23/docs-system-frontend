// chartContrast: the colors of the charts and of their text, read from theme.css (never copied here), measured with
// WCAG 2.x. Text needs 4.5:1; the parts of a graphic needed to understand it need 3:1 (WCAG 1.4.11).
// The fill of two statuses (Undocumented, In review) does not reach 3:1 against white, which is why each segment has an
// outline in the dark ink of its Tag: the test pins both facts so a change of token is noticed.
import { describe, expect, it } from 'vitest';

// Vitest runs with css: false, so the file is read from disk; the app's tsconfig has no Node types, so the file system
// comes through a typed view of the Node runtime (as in mapCss.test.ts).
const runtime = globalThis as unknown as {
  process: { getBuiltinModule: (id: string) => unknown; cwd: () => string };
};
const { readFileSync } = runtime.process.getBuiltinModule('node:fs') as {
  readFileSync: (path: string, encoding: 'utf8') => string;
};
const THEME = readFileSync(`${runtime.process.cwd()}/src/styles/theme.css`, 'utf8');

function token(name: string): string {
  const match = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(THEME);
  if (match?.[1] === undefined) throw new Error(`token --color-${name} not found in theme.css`);
  return match[1];
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

const STATUSES = ['undocumented', 'draft', 'in-progress', 'in-review', 'approved'] as const;
const SURFACE = token('surface');

describe('segments of the status donut', () => {
  it.each(STATUSES)('the outline of %s reads at least 4.5:1 against the card', (status) => {
    expect(contrast(token(`status-${status}-ink`), SURFACE)).toBeGreaterThanOrEqual(4.5);
  });

  it('shows why the outline is needed: two fills are under 3:1 against the card', () => {
    const under = STATUSES.filter((status) => contrast(token(`status-${status}`), SURFACE) < 3);
    expect(under).toEqual(['undocumented', 'in-review']);
  });

  it.each(STATUSES)('%s is told apart from the card by its fill or by its outline', (status) => {
    const fill = contrast(token(`status-${status}`), SURFACE);
    const outline = contrast(token(`status-${status}-ink`), SURFACE);
    expect(Math.max(fill, outline)).toBeGreaterThanOrEqual(3);
  });
});

describe('bars of the pending to-dos', () => {
  it.each(['primary', 'accent'])('the %s end of the bar reads 3:1 against its track', (end) => {
    expect(contrast(token(end), token('divider'))).toBeGreaterThanOrEqual(3);
  });
});

describe('text of the dashboard', () => {
  it.each([
    ['ink-900', 'surface'],
    ['ink-500', 'surface'],
    ['primary', 'surface'],
    ['warning-ink', 'warning-bg'],
    ['status-undocumented-ink', 'status-undocumented-bg'],
  ])('%s on %s reads at least 4.5:1', (ink, background) => {
    expect(contrast(token(ink), token(background))).toBeGreaterThanOrEqual(4.5);
  });
});
