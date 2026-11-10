// Module-level constants/types of PortalReports (moved verbatim).
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronUp } from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// MINI CHART COMPONENTS
// ═══════════════════════════════════════════════════════════════
export function BarChart({
  data,
  maxWidth = 200,
}: {
  data: { label: string; value: number; color?: string }[];
  maxWidth?: number;
}) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-1.5">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-20 text-muted-foreground truncate text-end">
            {d.label}
          </span>
          <div className="flex-1 h-4 bg-muted/30 rounded overflow-hidden">
            <div
              className={`h-full rounded ${d.color || "bg-primary"}`}
              style={{ width: `${Math.max((d.value / maxVal) * 100, 2)}%` }}
            />
          </div>
          <span className="w-8 text-muted-foreground font-mono">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

export function StarBar({ distribution }: { distribution: number[] }) {
  const max = Math.max(...distribution, 1);
  return (
    <div className="space-y-1">
      {[5, 4, 3, 2, 1].map((star) => (
        <div key={star} className="flex items-center gap-1.5 text-xs">
          <span className="w-3 text-amber-500">★</span>
          <span className="w-3 text-muted-foreground">{star}</span>
          <div className="flex-1 h-3 bg-muted/30 rounded overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded"
              style={{
                width: `${Math.max((distribution[star - 1] / max) * 100, 2)}%`,
              }}
            />
          </div>
          <span className="w-6 text-muted-foreground font-mono">
            {distribution[star - 1]}
          </span>
        </div>
      ))}
    </div>
  );
}

export function KPICard({
  icon: Icon,
  label,
  value,
  sub,
  color = "text-primary",
}: {
  icon: any;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="p-3 rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ═══ COLLAPSIBLE SECTION ═══
export function CollapsibleSection({
  title,
  icon,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <button
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/20 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-sm">{title}</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {expanded && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}
