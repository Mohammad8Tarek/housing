// Date helpers used by report rows (DD/MM/YYYY, AGENTS Rule 7).
import { formatDMY, type DateInput } from "@workspace/dates";

export { parseDMY, toISODate } from "@workspace/dates";

export function formatDate(date: DateInput, fallback: string = "—"): string {
  return formatDMY(date, fallback);
}
