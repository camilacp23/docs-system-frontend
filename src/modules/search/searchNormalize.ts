// searchNormalize: how the search compares texts, the same rules the API uses (D-110 a), so the part of a snippet or
// a name that the user's text matched can be found again in the browser.
// normalizeSearchText(text) -> the text with every character replaced one for one: A-Z to lower case, Ñ to ñ and
//   á é í ó ú ü (in both capitalizations) to their vowel without the accent. Any other character is left as it is
//   (Ç, Σ, à ...), and ñ stays different from n. The map is fixed: it never asks the locale of the browser, so the
//   result is the same everywhere. It works on UTF-16 code units and every pair is one unit to one unit, so the
//   normalized text has the same length as the original and a position in one is a position in the other.
// findMatches(text, query) -> [start, end) ranges of every appearance of the trimmed query in the text (equal after
//   normalizing both), left to right, without overlapping. The query is literal: `%`, `_`, parentheses and the
//   rest of the characters that mean something in a pattern are ordinary characters here.
// splitByMatches(text, query) -> the text cut in consecutive segments, each marked as matched or not.
// This is the only place with the list of pairs.

/** The pairs of D-110 a: [character, what it is compared as]. */
export const SEARCH_NORMALIZATION_PAIRS: readonly (readonly [string, string])[] = [
  ...Array.from({ length: 26 }, (_unused, index): readonly [string, string] => [
    String.fromCharCode(65 + index),
    String.fromCharCode(97 + index),
  ]),
  ['Ñ', 'ñ'],
  ['á', 'a'],
  ['é', 'e'],
  ['í', 'i'],
  ['ó', 'o'],
  ['ú', 'u'],
  ['ü', 'u'],
  ['Á', 'a'],
  ['É', 'e'],
  ['Í', 'i'],
  ['Ó', 'o'],
  ['Ú', 'u'],
  ['Ü', 'u'],
];

const NORMALIZED_UNIT = new Map(SEARCH_NORMALIZATION_PAIRS);

export function normalizeSearchText(text: string): string {
  let result = '';
  for (let index = 0; index < text.length; index += 1) {
    const unit = text.charAt(index);
    result += NORMALIZED_UNIT.get(unit) ?? unit;
  }
  return result;
}

export type MatchRange = readonly [start: number, end: number];

export function findMatches(text: string, query: string): MatchRange[] {
  const wanted = normalizeSearchText(query.trim());
  if (wanted === '') return [];
  const haystack = normalizeSearchText(text);
  const ranges: MatchRange[] = [];
  let from = 0;
  for (;;) {
    const start = haystack.indexOf(wanted, from);
    if (start === -1) return ranges;
    ranges.push([start, start + wanted.length]);
    from = start + wanted.length;
  }
}

export interface TextSegment {
  text: string;
  matched: boolean;
}

export function splitByMatches(text: string, query: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const [start, end] of findMatches(text, query)) {
    if (start > cursor) segments.push({ text: text.slice(cursor, start), matched: false });
    segments.push({ text: text.slice(start, end), matched: true });
    cursor = end;
  }
  if (cursor < text.length || segments.length === 0) {
    segments.push({ text: text.slice(cursor), matched: false });
  }
  return segments;
}
