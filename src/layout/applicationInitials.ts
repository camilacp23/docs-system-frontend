// applicationInitials: the two letters of the application tile ("SAR" -> "SA", "Application C" -> "AP").
export function applicationInitials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase();
}
