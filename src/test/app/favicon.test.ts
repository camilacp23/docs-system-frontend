// Favicon: index.html points to an own SVG icon in public/, so the browser never asks for /favicon.ico (which the static
// host would answer with index.html). The icon uses the primary color of the design system (theme.css).
import { describe, expect, it } from 'vitest';

import html from '../../../index.html?raw';
import svg from '../../../public/favicon.svg?raw';

// Vitest runs with css: false, so theme.css imported with ?raw is empty: it is read from disk (the app's tsconfig has no Node
// types, so the file system comes through a typed view of the Node runtime).
const runtime = globalThis as unknown as {
  process: { getBuiltinModule: (id: string) => unknown; cwd: () => string };
};
const { readFileSync } = runtime.process.getBuiltinModule('node:fs') as {
  readFileSync: (path: string, encoding: 'utf8') => string;
};
const theme = readFileSync(`${runtime.process.cwd()}/src/styles/theme.css`, 'utf8');

describe('favicon', () => {
  it('is declared in index.html and the file exists', () => {
    expect(html).toMatch(
      /<link\s+rel="icon"\s+type="image\/svg\+xml"\s+href="\/favicon\.svg"\s*\/>/,
    );
    expect(svg.length).toBeGreaterThan(0);
  });

  it('is a plain SVG in the primary color, with nothing external', () => {
    const primary = /--color-primary:\s*(#[0-9a-f]{6})/i.exec(theme)?.[1];
    expect(primary).toBeDefined();
    expect(svg).toMatch(/^<svg\b[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg.toLowerCase()).toContain(`fill="${String(primary).toLowerCase()}"`);
    expect(svg).not.toMatch(/<script|<image|<use|href=|url\(/i);
  });
});
