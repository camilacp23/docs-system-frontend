// donutGeometry: the paths of the status donut are a pure function of the counts.
import { describe, expect, it } from 'vitest';

import { donutSegments } from '../../modules/dashboard/donutGeometry';

const subpaths = (d: string) => d.split('M').length - 1;

describe('donutSegments', () => {
  it('has no segment when everything is 0', () => {
    expect(donutSegments([0, 0, 0, 0, 0])).toEqual([]);
  });

  it('draws one segment per count above 0, in order, with its share', () => {
    const segments = donutSegments([2, 3, 6, 3, 10]);
    expect(segments.map((segment) => segment.index)).toEqual([0, 1, 2, 3, 4]);
    expect(segments.map((segment) => Math.round(segment.fraction * 1000))).toEqual([
      83, 125, 250, 125, 417,
    ]);
    for (const segment of segments) expect(subpaths(segment.d)).toBe(1);
  });

  it('skips a status that is 0 but keeps the index of the others', () => {
    const segments = donutSegments([0, 4, 0, 0, 4]);
    expect(segments.map((segment) => segment.index)).toEqual([1, 4]);
  });

  it('draws a single segment that holds everything as a full ring (outer and inner circle)', () => {
    const segments = donutSegments([0, 0, 0, 0, 24]);
    expect(segments).toHaveLength(1);
    expect(segments[0]?.index).toBe(4);
    expect(subpaths(segments[0]?.d ?? '')).toBe(2);
  });

  it('uses the large arc only for a segment of more than half a turn', () => {
    const [half, rest] = donutSegments([7, 3]);
    expect(half?.d).toMatch(/A 100 100 0 1 1/);
    expect(rest?.d).toMatch(/A 100 100 0 0 1/);
  });

  it('keeps a very thin segment instead of losing it', () => {
    const segments = donutSegments([1, 0, 0, 0, 9999]);
    expect(segments).toHaveLength(2);
    expect(segments[0]?.d.startsWith('M ')).toBe(true);
  });

  it('is deterministic', () => {
    expect(donutSegments([2, 3, 6, 3, 10])).toEqual(donutSegments([2, 3, 6, 3, 10]));
  });
});
