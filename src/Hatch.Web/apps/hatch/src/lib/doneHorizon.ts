/* The shortest honest phrase for a done-column fold's horizon. */

/**
 * `hours` as a reader would say it: days only on a whole multiple of 24 - never
 * a fractional day like "1.5 days" - hours otherwise, however large the number.
 */
export function doneHorizonPhrase(hours: number): string {
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
  if (hours % 24 === 0) {
    const days = hours / 24;
    return `${days} day${days === 1 ? '' : 's'}`;
  }
  return `${hours} hours`;
}
