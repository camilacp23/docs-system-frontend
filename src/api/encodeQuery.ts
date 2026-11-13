// encodeQuery: serializes query parameters the way the contract declares them, encoded as RFC 3986 requires.
// encodeQuery(query) -> the query string without the leading "?" (empty when there is nothing to send).
// The API validator rejects (400) a parameter that carries reserved characters unencoded, and neither
// encodeURIComponent nor URLSearchParams encode all of them: `! ' ( ) *` stay as they are, and URLSearchParams
// writes a space as "+". Here only the unreserved characters (letters, digits, - . _ ~) are left as they are;
// every other UTF-8 byte is written as %XX (a space is %20).
// Styles: a string goes as it is; a number or boolean as its text; an array as `style: form`, `explode: false`
// (the only style the contract uses for lists, e.g. `types=SCREEN,VARIABLE`): each value is encoded and the
// separator is a literal comma. An empty array and undefined / null values are not sent. Any other value is JSON.
const RESERVED_AFTER_URI_COMPONENT = /[!'()*]/g;

/** Percent-encodes one name or value; every character outside A-Z a-z 0-9 - . _ ~ becomes %XX. */
export function encodeRfc3986(text: string): string {
  return encodeURIComponent(text).replace(
    RESERVED_AFTER_URI_COMPONENT,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function scalarText(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function encodeQuery(query: Record<string, unknown> | undefined): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      parts.push(
        `${encodeRfc3986(key)}=${value.map((item) => encodeRfc3986(scalarText(item))).join(',')}`,
      );
      continue;
    }
    parts.push(`${encodeRfc3986(key)}=${encodeRfc3986(scalarText(value))}`);
  }
  return parts.join('&');
}
