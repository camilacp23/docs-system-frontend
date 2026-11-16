// No figure, name or platform of the Figma frames (S-38a to S-38c) is written in the code of /onboarding: the numbers, the
// application name, the platform and the names of screens and variables always come from the summary and the selected
// application (D-79, D-99: never invented values). The sources of the module are read as text and searched for what the frames
// draw as sample data.
import { describe, expect, it } from 'vitest';

const SOURCES = import.meta.glob<string>('../../modules/onboarding/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** What the frames draw as sample data: the figures of the counts, the percentage and the names of the examples. */
const SAMPLE_VALUES: ReadonlyArray<[string, RegExp]> = [
  ['the screens figure (24)', /(?<![\w.%-])24(?![\w.%-])/],
  ['the variables figure (134)', /(?<![\w.%-])134(?![\w.%-])/],
  ['the collections figure (4)', /(?<![\w.%-])4 (?:collections|screens|variables)/],
  ['the components figure (58)', /(?<![\w.%-])58(?![\w.%-])/],
  ['the approved percentage (42%)', /(?<![\w.%-])42(?:%|\.\d)?(?![\w.-])/],
  ['the platform (Power Apps)', /Power Apps/],
  ['the application (SAR)', /\bSAR\b/],
  ['a sample screen (Inicio, Detalle, Busqueda)', /\b(?:Inicio|Detalle|Busqueda)\b/],
  ['a sample variable or collection', /\b(?:gUsuario|colClientes|colUsuarios|Clientes)\b/],
  ['the sample user', /Sample Developer/],
];

describe('the code of /onboarding', () => {
  it('reads the sources of the module', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThanOrEqual(13);
  });

  it.each(SAMPLE_VALUES)('does not write %s', (_label, pattern) => {
    const found = Object.entries(SOURCES)
      .filter(([, text]) => pattern.test(text))
      .map(([file]) => file.split('/').pop());

    expect(found).toEqual([]);
  });

  it('takes the name and the platform from the application', () => {
    const texts = SOURCES['../../modules/onboarding/onboardingTexts.ts'] ?? '';

    expect(texts).toMatch(/overviewLeadOf\(applicationName: string, platform: string\)/);
    expect(texts).toMatch(/\$\{platform\}/);
    expect(texts).toMatch(/pageTitleOf\(applicationName: string\)/);
  });
});
