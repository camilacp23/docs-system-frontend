// auditDates: days and instants of the audit log (FR-21, D-107).
// The user picks DAYS (`YYYY-MM-DD`) in the time zone of the browser. "From" is the start of its day (00:00:00.000)
// and "to" the end of its day (23:59:59.999), turned into the ISO 8601 instants with zone that the API asks for;
// both limits are inclusive. Everything takes the time zone as a parameter (default: the browser's, see
// browserTimeZone) so it can be tested with a fixed zone and does not depend on the machine.
// Functions: isValidDay, addDays, todayIn, zonedDay(day, edge, timeZone) -> ISO instant, dayOf(iso, timeZone),
// clockOf(iso, timeZone) -> "HH:MM", dayHeading(day, today), formatDay(day), rangeError(from, to).

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The time zone of the browser (IANA name). */
export function browserTimeZone(): string {
  return new Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function pad(value: number, size = 2): string {
  return String(value).padStart(size, '0');
}

function parseDay(day: string): { year: number; month: number; date: number } | null {
  const match = DAY_PATTERN.exec(day);
  if (match === null) return null;
  const [year, month, date] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(Date.UTC(year, month - 1, date));
  const real =
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === date;
  return real ? { year, month, date } : null;
}

/** True for a real calendar day written `YYYY-MM-DD` ("2026-02-30" is not). */
export function isValidDay(day: string): boolean {
  return parseDay(day) !== null;
}

/** The day `count` days after (or before, when negative) `day`; pure calendar arithmetic. */
export function addDays(day: string, count: number): string {
  const parts = parseDay(day);
  if (parts === null) return day;
  const moved = new Date(Date.UTC(parts.year, parts.month - 1, parts.date + count));
  return `${pad(moved.getUTCFullYear(), 4)}-${pad(moved.getUTCMonth() + 1)}-${pad(moved.getUTCDate())}`;
}

function wallClock(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant));
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: read('year'),
    month: read('month'),
    date: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
}

/** The offset of `timeZone` from UTC at `instant`, in ms (negative west of Greenwich). */
function offsetAt(instant: number, timeZone: string): number {
  const wall = wallClock(instant, timeZone);
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.date, wall.hour, wall.minute, wall.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** The calendar day of `now` in `timeZone`, as `YYYY-MM-DD`. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  const wall = wallClock(now.getTime(), timeZone);
  return `${pad(wall.year, 4)}-${pad(wall.month)}-${pad(wall.date)}`;
}

/**
 * The instant of the first (`start`, 00:00:00.000) or last (`end`, 23:59:59.999) millisecond of `day` in
 * `timeZone`, as an ISO 8601 string with zone ("2026-10-03T06:00:00.000Z" for the start of Oct 3 in
 * America/Costa_Rica). The offset is read twice so a day that contains a change of offset is still right.
 */
export function zonedDay(day: string, edge: 'start' | 'end', timeZone: string): string {
  const parts = parseDay(day);
  if (parts === null) throw new RangeError(`Not a valid day: ${day}`);
  const wall =
    edge === 'start'
      ? Date.UTC(parts.year, parts.month - 1, parts.date, 0, 0, 0, 0)
      : Date.UTC(parts.year, parts.month - 1, parts.date, 23, 59, 59, 999);
  const first = wall - offsetAt(wall, timeZone);
  const instant = wall - offsetAt(first, timeZone);
  return new Date(instant).toISOString();
}

/** The local day (`YYYY-MM-DD`) of an ISO instant in `timeZone`; the text itself when it is not a date. */
export function dayOf(iso: string, timeZone: string): string {
  const time = new Date(iso).getTime();
  return Number.isNaN(time) ? iso : todayIn(timeZone, new Date(time));
}

/** "10:21": the local time of an ISO instant in 24 h; the text itself when it is not a date. */
export function clockOf(iso: string, timeZone: string): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return iso;
  const wall = wallClock(time, timeZone);
  return `${pad(wall.hour)}:${pad(wall.minute)}`;
}

function calendarText(day: string, options: Intl.DateTimeFormatOptions): string {
  const parts = parseDay(day);
  if (parts === null) return day;
  const at = new Date(Date.UTC(parts.year, parts.month - 1, parts.date));
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(at);
}

/** "Oct 5", with the year when it is not the year of `today` ("Oct 5, 2025"). */
export function formatDay(day: string, today?: string): string {
  const sameYear = today === undefined || day.slice(0, 4) === today.slice(0, 4);
  return calendarText(
    day,
    sameYear
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' },
  );
}

/** "Today · Oct 5", "Yesterday · Oct 4", "Friday · Oct 3": the heading of one day of the timeline. */
export function dayHeading(day: string, today: string): string {
  const date = formatDay(day, today);
  if (day === today) return `Today · ${date}`;
  if (day === addDays(today, -1)) return `Yesterday · ${date}`;
  return `${calendarText(day, { weekday: 'long' })} · ${date}`;
}

/** The text of the error on "To" when the range is upside down (checked in the client, nothing is sent). */
export const RANGE_ORDER_TEXT = "To can't be earlier than From.";

/** The error of an upside-down range, or null. Days compare as text because the format is fixed. */
export function rangeError(from: string, to: string): string | null {
  return from !== '' && to !== '' && from > to ? RANGE_ORDER_TEXT : null;
}

export type RangePreset = 'today' | 'last7' | 'last30';

const PRESET_DAYS: Record<RangePreset, number> = { today: 0, last7: 6, last30: 29 };

export const PRESET_LABEL: Record<RangePreset, string> = {
  today: 'Today',
  last7: 'Last 7 days',
  last30: 'Last 30 days',
};

/** The days of a preset counted back from `today` (inclusive): Last 7 days = today and the six before. */
export function presetRange(preset: RangePreset, today: string): { from: string; to: string } {
  return { from: addDays(today, -PRESET_DAYS[preset]), to: today };
}

/** The preset that a range matches, or null when it is a custom range. */
export function presetOf(from: string, to: string, today: string): RangePreset | null {
  for (const preset of Object.keys(PRESET_DAYS) as RangePreset[]) {
    const range = presetRange(preset, today);
    if (range.from === from && range.to === to) return preset;
  }
  return null;
}

/** The text of the date filter: a preset's name, or "Oct 1 – Oct 5", "From Oct 1", "Until Oct 5". */
export function rangeText(from: string, to: string, today: string): string {
  const preset = presetOf(from, to, today);
  if (preset !== null) return PRESET_LABEL[preset];
  if (from !== '' && to !== '') return `${formatDay(from, today)} – ${formatDay(to, today)}`;
  if (from !== '') return `From ${formatDay(from, today)}`;
  return `Until ${formatDay(to, today)}`;
}
