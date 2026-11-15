/**
 * Egyptian National ID helpers.
 *
 * An Egyptian national ID is 14 digits: C YY MM DD GG S SS K
 *   - C   : century digit (2 → 1900s, 3 → 2000s; 1 → 1800s, legacy)
 *   - YYMMDD : date of birth
 *   - the rest encodes governorate / sequence / checksum (not used here)
 *
 * We use it only to derive a missing date of birth, never to overwrite one the
 * HR system already provided.
 */

const toAsciiDigits = (s: string): string =>
  s
    // Arabic-Indic ٠-٩ and Extended Arabic-Indic ۰-۹ → 0-9
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

/**
 * Derive a `YYYY-MM-DD` date of birth from an Egyptian national ID.
 * Returns null when the input is not a structurally valid 14-digit NID or the
 * encoded date is impossible (bad month/day, or a date in the future).
 */
export function egyptianNidToDob(nationalId: unknown): string | null {
  if (nationalId == null) return null;
  const nid = toAsciiDigits(String(nationalId)).replace(/\D/g, "");
  if (nid.length !== 14) return null;

  const centuryDigit = Number(nid[0]);
  const centuryBase =
    centuryDigit === 1
      ? 1800
      : centuryDigit === 2
        ? 1900
        : centuryDigit === 3
          ? 2000
          : null;
  if (centuryBase === null) return null;

  const year = centuryBase + Number(nid.slice(1, 3));
  const month = Number(nid.slice(3, 5));
  const day = Number(nid.slice(5, 7));
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  // Reject impossible calendar dates (e.g. 31 Feb) by round-tripping through Date.
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  // A birth date in the future means the NID was mistyped / fabricated.
  if (d.getTime() > Date.now()) return null;

  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}
