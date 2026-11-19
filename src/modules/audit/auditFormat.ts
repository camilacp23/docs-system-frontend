// auditFormat: the words of the changes of a record, so they read like a person would say them and not like a database row.
// humanKey(key)             "dataType" -> "Data type", "miro_link" -> "Miro link", "entityId" -> "Entity ID"
// humanValue(value, zone)   true -> "Yes", "IN_REVIEW" -> "In review", "2026-10-05T14:32:00Z" -> "Oct 5, 2026, 14:32", numbers and
//                           other text as they are (null and empty are drawn by the caller)
// isInstant(text)           true for an ISO 8601 date with time
// Nothing here reads or changes what the API sends: it is only how it is written on the screen.

const ACRONYMS: Readonly<Record<string, string>> = {
  id: 'ID',
  ids: 'IDs',
  url: 'URL',
  api: 'API',
  ui: 'UI',
  db: 'database',
  jira: 'Jira',
  miro: 'Miro',
};

/** Names the screen already knows by another spelling (the Power Fx event keeps its own). */
const KEY_LABEL: Readonly<Record<string, string>> = {
  onStart: 'OnStart',
  passwordHash: 'Password',
  dbRole: 'Database role',
};

/** A column name as a short sentence: words split at capitals and underscores, the first one capitalized. */
export function humanKey(key: string): string {
  const known = KEY_LABEL[key];
  if (known !== undefined) return known;
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s_]+/)
    .filter((word) => word !== '')
    .map((word) => word.toLowerCase());
  if (words.length === 0) return key;
  return words
    .map((word, index) => {
      const acronym = ACRONYMS[word];
      if (acronym !== undefined) return acronym;
      return index === 0 ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word;
    })
    .join(' ');
}

const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

export function isInstant(text: string): boolean {
  return INSTANT.test(text) && !Number.isNaN(Date.parse(text));
}

function formatInstant(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${read('month')} ${read('day')}, ${read('year')}, ${read('hour')}:${read('minute')}`;
}

/** An ENUM_VALUE as a phrase: "IN_REVIEW" -> "In review", "APPROVED" -> "Approved". Short acronyms ("DEV", "PROD") stay as they are. */
function humanEnum(text: string): string | null {
  if (!/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/.test(text)) {
    // A long single word ("APPROVED", "SCREEN") is a name too; the short ones ("DEV", "PROD", "PDF") are acronyms.
    return /^[A-Z]{5,}$/.test(text) ? `${text.charAt(0)}${text.slice(1).toLowerCase()}` : null;
  }
  const words = text.toLowerCase().split('_');
  const first = words[0] ?? '';
  return [`${first.charAt(0).toUpperCase()}${first.slice(1)}`, ...words.slice(1)].join(' ');
}

export function humanValue(value: unknown, timeZone: string): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string') {
    if (isInstant(value)) return formatInstant(value, timeZone);
    return humanEnum(value) ?? value;
  }
  return String(value);
}
