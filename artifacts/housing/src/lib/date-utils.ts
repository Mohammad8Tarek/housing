import {
  SYSTEM_DATE_FORMAT,
  SYSTEM_DATE_TIME_FORMAT,
  formatDMY,
  formatDMYTime,
  type DateInput,
} from "@workspace/dates";

export {
  SYSTEM_DATE_FORMAT,
  SYSTEM_DATE_TIME_FORMAT,
  ISO_DATE_FORMAT,
  toISODate,
  todayISO,
  parseDMY,
  isoToDate,
} from "@workspace/dates";

/**
 * Standard Day/Month/Year display across the entire system: DD/MM/YYYY.
 * Thin alias over the canonical `@workspace/dates` implementation.
 */
export function formatDate(
  date: DateInput,
  fallback: string = "—",
): string {
  return formatDMY(date, fallback);
}

export function formatDateTime(
  date: DateInput,
  fallback: string = "—",
): string {
  return formatDMYTime(date, fallback);
}

/**
 * Standard system export filename with Day-Month-Year format (DD-MM-YYYY)
 */
export function getExportFileName(
  prefix: string,
  extension: "xlsx" | "pdf" | "csv" = "xlsx",
): string {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const cleanPrefix = prefix.replace(/[\s/\\:]+/g, "_");
  return `${cleanPrefix}_${day}-${month}-${year}.${extension}`;
}
