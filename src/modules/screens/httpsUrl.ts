// httpsUrl: isHttpsUrl(value) -> true only for an absolute https address. The contract only accepts https for the
// Miro diagram of a screen (FR-13), and a stored value of another kind (http:, javascript:, a relative path) is never
// made clickable. Used by MiroLink and by the dependency map (the `miroLink` of a screen node, FR-16).
export function isHttpsUrl(value: string | null | undefined): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname !== '';
  } catch {
    return false;
  }
}
