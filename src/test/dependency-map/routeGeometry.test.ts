// Geometry of the three views, with the data of 13 and of about 500 elements: nothing overlaps, components are inside their
// group, boxes have room between them, every line has its own lane and its own ports, no line crosses a box that is not its
// own, no label covers a box or another label. The time of the layout and the routing is measured and printed (no threshold).
import { describe, expect, it } from 'vitest';

import { buildAllScene } from '../../modules/dependency-map/allScene';
import { buildFocusScene } from '../../modules/dependency-map/focusScene';
import type { GraphData } from '../../modules/dependency-map/graphTypes';
import { onlyUntraced } from '../../modules/dependency-map/graphModel';
import type { Scene } from '../../modules/dependency-map/scene';
import { buildScreensScene } from '../../modules/dependency-map/screensScene';
import { makeLargeGraph, sampleGraph } from '../helpers/graphFixtures';
import { neighborhoodOf } from '../helpers/graphQueries';
import { geometryProblems } from '../helpers/routeGeometry';

function check(name: string, scene: Scene | null) {
  expect(scene, `${name} has a scene`).not.toBeNull();
  const problems = geometryProblems(scene as Scene);
  expect(problems.slice(0, 8), `${name}: ${problems.length} problems`).toEqual([]);
  expect((scene as Scene).failures, `${name}: lines without a lane`).toBe(0);
  expect(scene?.edges.length ?? 0).toBeGreaterThanOrEqual(0);
}

const sample = sampleGraph();
const large = makeLargeGraph(500);

describe('geometry: 13 elements (the sample of frame S-27)', () => {
  it('Screens view', () => {
    check('screens', buildScreensScene(sample));
  });

  it('All elements view', () => {
    check('all', buildAllScene(sample));
  });

  it.each([
    ['variable:1', 1],
    ['variable:1', 2],
    ['collection:21', 1],
    ['collection:21', 2],
    ['screen:12', 1],
    ['screen:12', 2],
    ['component:31', 1],
    ['screen:10', 2],
  ])('focus on %s, depth %i', (key, depth) => {
    check(`focus ${key}/${depth}`, buildFocusScene(sample, key, depth));
  });
});

describe('geometry: about 500 elements', () => {
  it('Screens view (40 screens in a ring of navigation)', () => {
    check('screens', buildScreensScene(large));
  });

  it('All elements view, with what is left after "Show untraced only" (50 elements)', () => {
    check('all untraced', buildAllScene(onlyUntraced(large)));
  });

  it('All elements view with 100 elements (a crowded one, below the limit of 150)', () => {
    check('all 100', buildAllScene(makeLargeGraph(100)));
  });

  it.each([
    ['screen:16', 1],
    ['screen:16', 2],
    ['screen:19', 2],
    ['collection:44', 2],
    ['variable:101', 2],
  ])('focus on %s, depth %i', (key, depth) => {
    const neighborhood: GraphData = neighborhoodOf(large, key, depth);
    check(`focus ${key}/${depth}`, buildFocusScene(neighborhood, key, depth));
  });

  it('measures the time of the layout and the routing', () => {
    const rows: string[] = [];
    const measure = (name: string, build: () => Scene | null, runs: number) => {
      if (runs > 1) build(); // warm-up: the first call pays for compiling the code
      const times = Array.from({ length: runs }, () => {
        const started = performance.now();
        const scene = build();
        return {
          ms: performance.now() - started,
          lines: scene?.edges.length ?? 0,
          boxes: scene?.nodes.length ?? 0,
          attempts: scene?.attempts ?? 0,
        };
      });
      const sorted = times.map((run) => run.ms).sort((a, b) => a - b);
      rows.push(
        `${name}: boxes=${times[0]?.boxes} lines=${times[0]?.lines} attempts=${times[0]?.attempts} median(ms)=${(sorted[Math.floor(runs / 2)] ?? 0).toFixed(0)} runs(ms)=${times.map((run) => run.ms.toFixed(0)).join(',')}`,
      );
    };
    measure('screens 40', () => buildScreensScene(large), 3);
    measure('all untraced 50', () => buildAllScene(onlyUntraced(large)), 3);
    measure(
      'focus screen:16 d1',
      () => buildFocusScene(neighborhoodOf(large, 'screen:16', 1), 'screen:16', 1),
      3,
    );
    measure(
      'focus screen:16 d2',
      () => buildFocusScene(neighborhoodOf(large, 'screen:16', 2), 'screen:16', 2),
      3,
    );
    // Printed on purpose: the numbers go to the report. No threshold.
    console.log(['ROUTING-TIME', ...rows].join('\n'));
    expect(rows).toHaveLength(4);
  });
});

describe('the geometry check itself', () => {
  const good = () => structuredClone(buildAllScene(sample));

  it('finds nothing wrong in a good scene', () => {
    expect(geometryProblems(good())).toEqual([]);
  });

  it('finds two boxes that overlap', () => {
    const scene = good();
    const [first, second] = scene.nodes.filter((node) => node.parentKey === null);
    if (first && second) {
      second.x = first.x;
      second.y = first.y;
    }
    expect(geometryProblems(scene).some((problem) => problem.includes('overlaps'))).toBe(true);
  });

  it('finds a component that sticks out of its group', () => {
    const scene = good();
    const child = scene.nodes.find((node) => node.parentKey !== null);
    if (child) child.x = 400;
    expect(geometryProblems(scene).some((problem) => problem.includes('is not inside'))).toBe(true);
  });

  it('finds two lines that share a piece', () => {
    const scene = good();
    const [first, second] = scene.edges.filter((line) => (line.route?.points.length ?? 0) >= 2);
    if (first?.route && second?.route) second.route.points = structuredClone(first.route.points);
    expect(
      geometryProblems(scene).some(
        (problem) => problem.includes('share a piece') || problem.includes('share the port'),
      ),
    ).toBe(true);
  });

  it('finds a line that goes through a box that is not its own', () => {
    const scene = good();
    const line = scene.edges.find((candidate) => (candidate.route?.points.length ?? 0) >= 2);
    const victim = scene.nodes.find(
      (node) =>
        node.parentKey === null &&
        node.key !== line?.source &&
        node.key !== line?.target &&
        !line?.source.includes(node.key),
    );
    if (line?.route && victim) {
      const y = victim.y + victim.height / 2;
      line.route.points = [
        { x: victim.x - 32, y },
        { x: victim.x + victim.width + 32, y },
      ];
    }
    expect(geometryProblems(scene).some((problem) => problem.includes('through'))).toBe(true);
  });

  it('finds a line that was not routed', () => {
    const scene = good();
    const line = scene.edges[0];
    if (line?.route) line.route.routed = false;
    expect(geometryProblems(scene).some((problem) => problem.includes('no free lane'))).toBe(true);
  });
});
