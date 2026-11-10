import { useLanguage } from "@/context/LanguageContext";
import { Badge } from "@/components/ui/badge";

const MAX_PROFILE_IMPORT_FILE_SIZE = 1024 * 1024;
const PROFILE_IMPORT_EXTENSIONS = [".xlsx", ".xls"];

export function StatusBadge({ status }: { status: string }) {
  const { language } = useLanguage();
  const ar = language === "ar";

  const map: Record<
    string,
    {
      label: string;
      className: string;
    }
  > = {
    ACTIVE: {
      label: ar ? "مقيم بالسكن" : "In-House",
      className: "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    },
    LEFT: {
      label: ar ? "مغادر" : "Check-out",
      className: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    },
    VACATION: {
      label: ar ? "في إجازة" : "Vacation",
      className: "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
    },
    UNASSIGNED: {
      label: ar ? "غير مسكّن" : "Unassigned",
      className: "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
    },
    SUSPENDED: {
      label: ar ? "موقوف" : "Suspended",
      className: "bg-red-50 text-red-700 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800",
    },
    TRANSFERRED: {
      label: ar ? "منقول لفندق آخر" : "Transferred",
      className: "bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800",
    },
  };

  const cfg = map[status] ?? {
    label: status,
    className: "bg-muted text-muted-foreground border-border",
  };

  return (
    <Badge variant="outline" className={`font-semibold text-xs px-2.5 py-0.5 border ${cfg.className}`}>
      {cfg.label}
    </Badge>
  );
}

/* ── Profile Add Dialog ─────────────────────────────────────────────────── */
