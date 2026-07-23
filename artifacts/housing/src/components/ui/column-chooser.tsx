// @ts-nocheck
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Columns3 } from "lucide-react";

export type ColDef = {
  key: string;
  label: string;
  labelAr?: string;
  defaultVisible?: boolean;
  fixed?: boolean;
};

export function useColumnVisibility(cols: ColDef[]) {
  const [visible, setVisible] = useState<Set<string>>(
    () =>
      new Set(cols.filter((c) => c.defaultVisible !== false).map((c) => c.key)),
  );

  const toggle = (key: string, checked: boolean) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const showAll = () => setVisible(new Set(cols.map((c) => c.key)));
  const hideAll = () =>
    setVisible(new Set(cols.filter((c) => c.fixed).map((c) => c.key)));
  const isVisible = (key: string) =>
    cols.some((c) => c.key === key) && visible.has(key);

  return { visible, toggle, showAll, hideAll, isVisible };
}

interface ColumnChooserProps {
  cols: ColDef[];
  visible: Set<string>;
  onToggle: (key: string, checked: boolean) => void;
  onShowAll?: () => void;
  onHideAll?: () => void;
  ar?: boolean;
}

export function ColumnChooser({
  cols,
  visible,
  onToggle,
  onShowAll,
  onHideAll,
  ar,
}: ColumnChooserProps) {
  const visibleCount = cols.filter((col) => visible.has(col.key)).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Columns3 className="w-4 h-4" />
          <span>{ar ? "الأعمدة" : "Columns"}</span>
          <span className="text-muted-foreground text-xs">
            ({visibleCount}/{cols.length})
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{ar ? "إظهار / إخفاء الأعمدة" : "Toggle Columns"}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {(onShowAll || onHideAll) && (
          <>
            <div className="flex gap-1 px-2 py-1">
              {onShowAll && (
                <button
                  className="text-xs text-blue-600 hover:underline"
                  onClick={onShowAll}
                >
                  {ar ? "الكل" : "All"}
                </button>
              )}
              {onShowAll && onHideAll && (
                <span className="text-muted-foreground text-xs">·</span>
              )}
              {onHideAll && (
                <button
                  className="text-xs text-muted-foreground hover:underline"
                  onClick={onHideAll}
                >
                  {ar ? "إخفاء الكل" : "None"}
                </button>
              )}
            </div>
            <DropdownMenuSeparator />
          </>
        )}

        {cols.map((col) => (
          <DropdownMenuCheckboxItem
            key={col.key}
            checked={visible.has(col.key)}
            disabled={col.fixed}
            onCheckedChange={(checked) => onToggle(col.key, !!checked)}
          >
            {ar && col.labelAr ? col.labelAr : col.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
