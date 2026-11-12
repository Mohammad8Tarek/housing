// Chips above the In-House table: stays already past their expected
// check-out date, and stays ending within 7 / 14 / 30 days. Picking one
// filters the list (sorted by end date) so extend / checkout are one click away.
import { AlarmClock, CalendarClock, X } from "lucide-react";

export type EndingFilter = "overdue" | "7" | "14" | "30";
export type EndingCounts = {
  overdue: number;
  d7: number;
  d14: number;
  d30: number;
};

export function EndingStayFilter({
  ar,
  value,
  counts,
  onChange,
}: {
  ar: boolean;
  value: EndingFilter | null;
  counts?: EndingCounts | null;
  onChange: (v: EndingFilter | null) => void;
}) {
  const chips: Array<{
    key: EndingFilter;
    label: string;
    n: number | undefined;
    tone: string;
  }> = [
    {
      key: "overdue",
      label: ar ? "تعدّى تاريخ الخروج" : "Past check-out date",
      n: counts?.overdue,
      tone: "rose",
    },
    {
      key: "7",
      label: ar ? "ينتهي خلال 7 أيام" : "Ending in 7 days",
      n: counts?.d7,
      tone: "amber",
    },
    {
      key: "14",
      label: ar ? "خلال 14 يوم" : "In 14 days",
      n: counts?.d14,
      tone: "sky",
    },
    {
      key: "30",
      label: ar ? "خلال 30 يوم" : "In 30 days",
      n: counts?.d30,
      tone: "slate",
    },
  ];
  const toneClass: Record<string, string> = {
    rose: "border-rose-500/40 text-rose-700 dark:text-rose-400 bg-rose-500/5",
    amber:
      "border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/5",
    sky: "border-sky-500/40 text-sky-700 dark:text-sky-400 bg-sky-500/5",
    slate: "border-border text-foreground bg-muted/40",
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <CalendarClock className="w-4 h-4" />
        {ar ? "الإقامات المنتهية:" : "Ending stays:"}
      </span>
      {chips.map((c) => {
        const selected = value === c.key;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onChange(selected ? null : c.key)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
              selected
                ? `${toneClass[c.tone]} ring-2 ring-offset-1 ring-current`
                : c.n
                  ? toneClass[c.tone]
                  : "border-border text-muted-foreground"
            }`}
          >
            {c.key === "overdue" && <AlarmClock className="w-3.5 h-3.5" />}
            {c.label}
            <span className="tabular-nums">({c.n ?? "–"})</span>
          </button>
        );
      })}
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="w-3.5 h-3.5" />
          {ar ? "إلغاء الفلتر" : "Clear"}
        </button>
      )}
    </div>
  );
}
