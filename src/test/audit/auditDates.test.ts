// Days and instants of the audit log (D-107): the start and the end of a day in a FIXED time zone (America/Costa_Rica,
// UTC-6 all year, so the tests do not depend on the zone of the machine), inclusive limits, presets and texts.
import { describe, expect, it } from 'vitest';

import {
  RANGE_ORDER_TEXT,
  addDays,
  clockOf,
  dayHeading,
  dayOf,
  formatDay,
  isValidDay,
  presetOf,
  presetRange,
  rangeError,
  rangeText,
  todayIn,
  zonedDay,
} from '../../modules/audit/auditDates';

const COSTA_RICA = 'America/Costa_Rica';

describe('zonedDay', () => {
  it('turns the start of a day into the instant 00:00:00.000 local', () => {
    expect(zonedDay('2026-10-03', 'start', COSTA_RICA)).toBe('2026-10-03T06:00:00.000Z');
  });

  it('turns the end of a day into the instant 23:59:59.999 local, which is already the next day in UTC', () => {
    expect(zonedDay('2026-10-03', 'end', COSTA_RICA)).toBe('2026-10-04T05:59:59.999Z');
  });

  it('keeps both limits of one day inside that day and 1 ms apart from the next one (inclusive limits)', () => {
    const end = new Date(zonedDay('2026-10-03', 'end', COSTA_RICA)).getTime();
    const nextStart = new Date(zonedDay('2026-10-04', 'start', COSTA_RICA)).getTime();
    expect(nextStart - end).toBe(1);
  });

  it('works east of Greenwich and on UTC', () => {
    expect(zonedDay('2026-10-03', 'start', 'Asia/Tokyo')).toBe('2026-10-02T15:00:00.000Z');
    expect(zonedDay('2026-10-03', 'end', 'UTC')).toBe('2026-10-03T23:59:59.999Z');
  });

  it('is right on a day with a change of offset (New York leaves daylight time on Nov 1, 2026)', () => {
    expect(zonedDay('2026-11-01', 'start', 'America/New_York')).toBe('2026-11-01T04:00:00.000Z');
    expect(zonedDay('2026-11-01', 'end', 'America/New_York')).toBe('2026-11-02T04:59:59.999Z');
  });

  it('refuses a text that is not a real day', () => {
    expect(() => zonedDay('2026-02-30', 'start', COSTA_RICA)).toThrow(RangeError);
  });
});

describe('days', () => {
  it('validates real calendar days only', () => {
    expect(isValidDay('2026-02-28')).toBe(true);
    expect(isValidDay('2028-02-29')).toBe(true);
    expect(isValidDay('2026-02-29')).toBe(false);
    expect(isValidDay('2026-13-01')).toBe(false);
    expect(isValidDay('2026-1-1')).toBe(false);
    expect(isValidDay('')).toBe(false);
  });

  it('adds days across months and years', () => {
    expect(addDays('2026-10-05', -6)).toBe('2026-09-29');
    expect(addDays('2026-01-02', -5)).toBe('2025-12-28');
    expect(addDays('2026-02-27', 3)).toBe('2026-03-02');
  });

  it('finds the local day and clock of an instant in the zone', () => {
    // 2026-10-04T05:59:59.999Z is still Oct 3 at 23:59 in Costa Rica.
    expect(dayOf('2026-10-04T05:59:59.999Z', COSTA_RICA)).toBe('2026-10-03');
    expect(clockOf('2026-10-04T05:59:59.999Z', COSTA_RICA)).toBe('23:59');
    expect(clockOf('2026-10-05T06:00:00.000Z', COSTA_RICA)).toBe('00:00');
    expect(todayIn(COSTA_RICA, new Date('2026-10-05T03:00:00.000Z'))).toBe('2026-10-04');
  });
});

describe('headings and texts', () => {
  it('names Today and Yesterday and otherwise the weekday', () => {
    expect(dayHeading('2026-10-05', '2026-10-05')).toBe('Today · Oct 5');
    expect(dayHeading('2026-10-04', '2026-10-05')).toBe('Yesterday · Oct 4');
    expect(dayHeading('2026-10-03', '2026-10-05')).toBe('Saturday · Oct 3');
    expect(dayHeading('2025-12-28', '2026-01-02')).toBe('Sunday · Dec 28, 2025');
  });

  it('writes a day with the year only when it is not the current year', () => {
    expect(formatDay('2026-10-05', '2026-11-14')).toBe('Oct 5');
    expect(formatDay('2025-10-05', '2026-11-14')).toBe('Oct 5, 2025');
  });

  it('reports an upside-down range and nothing else', () => {
    expect(rangeError('2026-10-05', '2026-10-01')).toBe(RANGE_ORDER_TEXT);
    expect(rangeError('2026-10-01', '2026-10-01')).toBeNull();
    expect(rangeError('', '2026-10-01')).toBeNull();
    expect(rangeError('2026-10-05', '')).toBeNull();
  });
});

describe('presets', () => {
  const today = '2026-10-05';

  it('counts back from today, inclusive: Last 7 days is today and the six before', () => {
    expect(presetRange('today', today)).toEqual({ from: '2026-10-05', to: '2026-10-05' });
    expect(presetRange('last7', today)).toEqual({ from: '2026-09-29', to: '2026-10-05' });
    expect(presetRange('last30', today)).toEqual({ from: '2026-09-06', to: '2026-10-05' });
  });

  it('recognizes a preset by its days and calls anything else custom', () => {
    expect(presetOf('2026-09-29', '2026-10-05', today)).toBe('last7');
    expect(presetOf('2026-09-28', '2026-10-05', today)).toBeNull();
  });

  it('writes the text of the date filter', () => {
    expect(rangeText('2026-09-29', '2026-10-05', today)).toBe('Last 7 days');
    expect(rangeText('2026-10-01', '2026-10-03', today)).toBe('Oct 1 – Oct 3');
    expect(rangeText('2026-10-01', '', today)).toBe('From Oct 1');
    expect(rangeText('', '2026-10-03', today)).toBe('Until Oct 3');
  });
});
