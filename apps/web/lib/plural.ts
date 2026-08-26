/**
 * Polish plural inflection: three forms instead of the two English has.
 *
 * 1 → "1 nowy wpis", 2–4 → "3 nowe wpisy", the rest → "8 nowych wpisów", with
 * 12–14 as the exception that behaves like the "many" group despite ending in
 * 2–4. Written once here, because the same rule was already being spelled out
 * separately in the header and in the refresh — and two copies of a rule with
 * an exception in it drift.
 */
export function plural(count: number, one: string, few: string, many: string): string {
  if (count === 1) return `${count} ${one}`;

  const units = count % 10;
  const teens = count % 100;
  const isFew = units >= 2 && units <= 4 && (teens < 12 || teens > 14);

  return `${count} ${isFew ? few : many}`;
}
