// The pure rules of /onboarding (onboardingModel): the step of the URL, the progress, the done marks, the bar of the
// connections, the text of the depth and the keys screens App (OnStart) reaches directly.
import { describe, expect, it } from 'vitest';

import {
  barPercent,
  countLabel,
  depthText,
  directlyReached,
  isDone,
  maxConnections,
  parseStep,
  progressPercent,
  STEP_COUNT,
  STEPS,
  stepHref,
  stepInfo,
  type KeyScreen,
} from '../../modules/onboarding/onboardingModel';

const key = (id: number, depth: number | null, connections = 1): KeyScreen => ({
  screen: { id, name: `Pantalla${id}` },
  documentationStatus: 'DRAFT',
  connections,
  depth,
  miroLink: null,
});

describe('parseStep', () => {
  it('reads 1 to 5 as they are', () => {
    for (const step of [1, 2, 3, 4, 5]) {
      expect(parseStep(String(step))).toEqual({ step, valid: true });
    }
  });

  it('takes a missing parameter as step 1, valid (nothing to fix in the URL)', () => {
    expect(parseStep(null)).toEqual({ step: 1, valid: true });
  });

  it.each(['0', '6', '-1', '2.5', '01', '1e1', ' 2', '2 ', 'abc', '', 'NaN', '٣', '3,'])(
    'takes %j as step 1, not valid (the page replaces the URL)',
    (raw) => {
      expect(parseStep(raw)).toEqual({ step: 1, valid: false });
    },
  );
});

describe('the steps', () => {
  it('are five, with the names of the frames for the first three', () => {
    expect(STEP_COUNT).toBe(5);
    expect(STEPS.map((step) => step.label)).toEqual([
      'Overview',
      'How the app starts',
      'Key screens',
      'Critical variables',
      'Most used components',
    ]);
    expect(stepInfo(2).kicker).toBe('Integration flow');
    expect(stepInfo(99).label).toBe('Overview');
  });

  it('link to ?step=N', () => {
    expect(stepHref(4)).toBe('/onboarding?step=4');
  });
});

describe('progressPercent and isDone', () => {
  it('count the steps before the current one over five', () => {
    expect([1, 2, 3, 4, 5].map(progressPercent)).toEqual([0, 20, 40, 60, 80]);
  });

  it('mark as done only the steps before the current one', () => {
    expect([1, 2, 3, 4, 5].map((step) => isDone(step, 3))).toEqual([
      true,
      true,
      false,
      false,
      false,
    ]);
  });
});

describe('the bar of the connections', () => {
  it('is relative to the largest of the list', () => {
    expect(barPercent(21, 21)).toBe(100);
    expect(barPercent(14, 21)).toBe(67);
    expect(barPercent(1, 21)).toBe(5);
  });

  it('is empty when nothing in the list is connected', () => {
    expect(barPercent(0, 0)).toBe(0);
  });

  it('finds the largest, and 0 for an empty list', () => {
    expect(maxConnections([key(1, 1, 3), key(2, 2, 9), key(3, null, 4)])).toBe(9);
    expect(maxConnections([])).toBe(0);
  });
});

describe('depthText', () => {
  it('says the three cases', () => {
    expect(depthText(1)).toBe('Reached directly from App (OnStart)');
    expect(depthText(2)).toBe('2 steps from App (OnStart)');
    expect(depthText(7)).toBe('7 steps from App (OnStart)');
    expect(depthText(null)).toBe('Not reachable from App (OnStart)');
  });
});

describe('directlyReached', () => {
  it('keeps the screens with depth 1 in the order of the API', () => {
    const screens = [key(5, 2), key(3, 1), key(9, null), key(4, 1)];

    expect(directlyReached(screens).map((item) => item.screen.id)).toEqual([3, 4]);
    expect(directlyReached([key(1, null)])).toEqual([]);
    expect(directlyReached([])).toEqual([]);
  });
});

describe('countLabel', () => {
  it('uses the singular only for one', () => {
    expect(countLabel(1, 'screen', 'screens')).toBe('screen');
    expect(countLabel(0, 'screen', 'screens')).toBe('screens');
    expect(countLabel(2, 'screen', 'screens')).toBe('screens');
  });
});
