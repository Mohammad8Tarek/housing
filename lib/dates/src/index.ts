/**
 * Canonical date utilities for the whole system — the ONE implementation.
 *
 * Display convention: Day/Month/Year (DD/MM/YYYY).
 * Storage/API convention: ISO calendar date "YYYY-MM-DD" (no time).
 *
 * Pure functions, zero dependencies (housing uses date-fns v3, portal uses
 * v4 — hand-rolled getters avoid cross-version conflicts entirely).
 */

export const SYSTEM_DATE_FORMAT = "dd/MM/yyyy";
export const SYSTEM_DATE_TIME_FORMAT = "dd/MM/yyyy HH:mm";
export const ISO_DATE_FORMAT = "yyyy-MM-dd";

export type DateInput = Date | string | number | null | undefined;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isRealDate(d: unknown): d is Date {
  return (
    d instanceof Date && !isNaN(d.getTime()) && isFinite(d.getTime())
  );
}

/** Parse Date | ISO/datetime string | timestamp → Date at local time (null when invalid). */
export function toDate(value: DateInput): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return isRealDate(value) ? value : null;
  if (typeof value === "number") {
    const d = new Date(value);
    return isRealDate(d) ? d : null;
  }
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  // Strict ISO calendar prefix first (avoids TZ-shift surprises for date-only strings).
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (
      isRealDate(d) &&
      d.getFullYear() === Number(m[1]) &&
      d.getMonth() === Number(m[2]) - 1 &&
      d.getDate() === Number(m[3])
    ) {
      return d;
    }
    return null;
  }
  const d = new Date(trimmed);
  return isRealDate(d) ? d : null;
}

/** Format any date value as "DD/MM/YYYY" (fallback when empty/invalid). */
export function formatDMY(
  value: DateInput,
  fallback: string = "—",
): string {
  const d = toDate(value);
  if (!d) return fallback;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Format any date value as "DD/MM/YYYY HH:mm" (fallback when empty/invalid). */
export function formatDMYTime(
  value: DateInput,
  fallback: string = "—",
): string {
  const d = toDate(value);
  if (!d) return fallback;
  return `${formatDMY(d, fallback)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Local calendar date → "YYYY-MM-DD" (no UTC day-shift). */
export function toISODate(date: Date): string {
  if (!isRealDate(date)) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Today's local calendar date as "YYYY-MM-DD". */
export function todayISO(): string {
  return toISODate(new Date());
}

/** "YYYY-MM-DD" → Date at local midnight (null when invalid). */
export function isoToDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (
    !isRealDate(d) ||
    d.getFullYear() !== Number(m[1]) ||
    d.getMonth() !== Number(m[2]) - 1 ||
    d.getDate() !== Number(m[3])
  ) {
    return null;
  }
  return d;
}

/**
 * Parse user-typed "DD/MM/YYYY" (also accepts dots/dashes or 8 digits)
 * into "YYYY-MM-DD". Returns null when invalid or outside [min, max].
 */
export function parseDMY(
  input: string,
  min?: string,
  max?: string,
): string | null {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, "");
  let day: number;
  let month: number;
  let year: number;
  if (/^\d{8}$/.test(digits)) {
    day = Number(digits.slice(0, 2));
    month = Number(digits.slice(2, 4));
    year = Number(digits.slice(4, 8));
  } else {
    const m = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/.exec(trimmed);
    if (!m) return null;
    day = Number(m[1]);
    month = Number(m[2]);
    year = Number(m[3]);
    if (year < 100) year += 2000;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  if (
    !isRealDate(d) ||
    d.getDate() !== day ||
    d.getMonth() !== month - 1 ||
    d.getFullYear() !== year
  ) {
    return null;
  }
  const iso = toISODate(d);
  if (min && iso < min) return null;
  if (max && iso > max) return null;
  return iso;
}
