/**
 * Convert ALL_CAPS stop/street names (as returned by the Sofia Traffic API)
 * to Title Case. Works correctly with Bulgarian Cyrillic characters.
 */
export function stopName(s: string): string {
  if (!s) return s;
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}
