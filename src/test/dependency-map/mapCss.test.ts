// mapCanvas.css: the label of an edge must have a fill. React Flow's base.css gives none (only its style.css does, and the
// map does not import it), so without these rules every labeled edge drew a BLACK rectangle behind its text. Vitest does not
// apply CSS, so this reads the file: the rules must exist and must use tokens, never a hard-coded color.
import { describe, expect, it } from 'vitest';

// Vitest runs with css: false, so importing the file (even with ?raw) gives an empty string. The file is read from disk;
// the app's tsconfig has no Node types, so the file system comes through a typed view of the Node runtime.
const runtime = globalThis as unknown as {
  process: { getBuiltinModule: (id: string) => unknown; cwd: () => string };
};
const { readFileSync } = runtime.process.getBuiltinModule('node:fs') as {
  readFileSync: (path: string, encoding: 'utf8') => string;
};
// Vitest runs from the project root (import.meta.url is not a file: URL under jsdom).
const mapCss = readFileSync(
  `${runtime.process.cwd()}/src/modules/dependency-map/mapCanvas.css`,
  'utf8',
);

function ruleOf(selector: string): string {
  const start = mapCss.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`no rule for ${selector}`);
  return mapCss.slice(start, mapCss.indexOf('}', start));
}

describe('mapCanvas.css', () => {
  it('fills the background of an edge label with a surface token', () => {
    expect(ruleOf('.map-flow .react-flow__edge-textbg')).toMatch(/fill:\s*var\(--color-surface\)/);
  });

  it('fills the text of an edge label with a text token', () => {
    expect(ruleOf('.map-flow .react-flow__edge-text')).toMatch(/fill:\s*var\(--color-ink-700\)/);
  });

  it('uses no hard-coded color anywhere', () => {
    const withoutComments = mapCss.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(withoutComments).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(withoutComments).not.toMatch(/\b(black|white|red|blue|green)\b/);
  });
});
