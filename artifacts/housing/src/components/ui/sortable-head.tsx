import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc";

type SortableHeadProps = {
  label: React.ReactNode;
  sortKey: string;
  activeKey: string | null;
  dir: SortDir;
  onToggle: (key: string) => void;
  className?: string;
};

/**
 * Canonical sortable table header: click cycles asc → desc → off.
 * Shows direction icon only for the active column.
 */
export function SortableHead({
  label,
  sortKey,
  activeKey,
  dir,
  onToggle,
  className,
}: SortableHeadProps) {
  const active = activeKey === sortKey;
  return (
    <TableHead className={cn("text-white font-semibold whitespace-nowrap", className)}>
      <button
        type="button"
        onClick={() => onToggle(sortKey)}
        title={active ? (dir === "asc" ? "تصاعدي" : "تنازلي") : "ترتيب"}
        className="inline-flex items-center gap-1.5 hover:text-amber-200 transition-colors whitespace-nowrap"
      >
        <span>{label}</span>
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="w-3 h-3 text-amber-300 shrink-0" />
          ) : (
            <ArrowDown className="w-3 h-3 text-amber-300 shrink-0" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40 shrink-0" />
        )}
      </button>
    </TableHead>
  );
}
