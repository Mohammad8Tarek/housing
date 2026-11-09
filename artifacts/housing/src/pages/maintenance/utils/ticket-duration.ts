import { differenceInMinutes } from "date-fns";

export const STATUS_AR: Record<string, string> = {
  open: "لم تبدأ / مفتوحة",
  in_progress: "قيد التنفيذ",
  resolved: "تم الإنجاز",
  closed: "مغلقة",
};
export const STATUS_EN: Record<string, string> = {
  open: "Not Started",
  in_progress: "In Progress",
  resolved: "Order Completed",
  closed: "Closed",
};

export function getDurationMins(
  startedAt: any,
  resolvedAt: any,
  reportedAt: any,
): number {
  const start = reportedAt ?? startedAt;
  if (!start) return -1;
  const startDate = new Date(start);
  const endDate = resolvedAt ? new Date(resolvedAt) : new Date();
  return differenceInMinutes(endDate, startDate);
}

export function formatDuration(
  startedAt: any,
  resolvedAt: any,
  reportedAt: any,
  ar: boolean = false,
): string {
  const totalMins = getDurationMins(startedAt, resolvedAt, reportedAt);
  if (totalMins < 0) return "—";
  if (totalMins < 1) return ar ? "< دقيقة" : "< 1 min";
  if (totalMins >= 60) {
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return ar ? `${hours} س ${mins} د` : `${hours}h ${mins}m`;
  }
  return ar ? `${totalMins} دقيقة` : `${totalMins} min`;
}

export function getDurationColor(
  startedAt: any,
  resolvedAt: any,
  reportedAt: any,
): string {
  const totalMins = getDurationMins(startedAt, resolvedAt, reportedAt);
  if (totalMins < 0) return "text-muted-foreground";
  if (totalMins <= 30) return "text-emerald-600 dark:text-emerald-400";
  if (totalMins <= 120) return "text-amber-500 dark:text-amber-400";
  return "text-red-500 dark:text-red-400 font-bold";
}
