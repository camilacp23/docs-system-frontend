// initials: the letters of a person's avatar. getInitials(name) -> first letter of the first and last words, uppercased
// ("Camila Castillo" -> "CC"; "Integración" -> "I").
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0];
  const last = words.length > 1 ? words[words.length - 1]?.[0] : undefined;
  return `${first ?? ''}${last ?? ''}`.toUpperCase();
}
