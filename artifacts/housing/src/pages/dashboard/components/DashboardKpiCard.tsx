import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { ArrowUpRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { motion } from "framer-motion";

interface DashboardKpiCardProps {
  title: string;
  value: React.ReactNode;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  color?: string;
  bg?: string;
  delta?: {
    value: string;
    isPositive?: boolean;
    isNeutral?: boolean;
    label?: string;
  };
  sparklineData?: number[];
  alert?: boolean;
}

export function DashboardKpiCard({
  title,
  value,
  sub,
  icon: Icon,
  href,
  color = "text-primary",
  bg = "bg-primary/10",
  delta,
  sparklineData = [35, 42, 40, 48, 55, 52, 60],
  alert,
}: DashboardKpiCardProps) {
  // Generate mini SVG sparkline path
  const minVal = Math.min(...sparklineData);
  const maxVal = Math.max(...sparklineData, minVal + 1);
  const width = 64;
  const height = 24;
  const points = sparklineData
    .map((val, i) => {
      const x = (i / (sparklineData.length - 1)) * width;
      const y = height - ((val - minVal) / (maxVal - minVal)) * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(" ");

  const cardContent = (
    <Card className="h-full flex flex-col justify-between bg-card/75 backdrop-blur-xl border border-border/50 shadow-md hover:shadow-xl hover:border-primary/40 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group cursor-pointer">
      {/* Top subtle glow */}
      <div
        className={`absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-15 pointer-events-none transition-opacity duration-300 group-hover:opacity-30 ${bg}`}
      />

      <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
        <CardTitle className="text-xs sm:text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors line-clamp-1">
          {title}
        </CardTitle>
        <div
          className={`p-2 rounded-xl ${bg} flex items-center justify-center shadow-xs transition-transform duration-300 group-hover:scale-110 shrink-0`}
        >
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-end relative z-10 pt-1">
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div
              className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                alert ? "text-orange-600 dark:text-orange-400" : "text-foreground"
              }`}
            >
              {value}
            </div>

            {/* Subtext and Delta Badge */}
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {delta && (
                <span
                  className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                    delta.isNeutral
                      ? "bg-muted text-muted-foreground"
                      : delta.isPositive
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {delta.isNeutral ? (
                    <Minus className="w-2.5 h-2.5" />
                  ) : delta.isPositive ? (
                    <TrendingUp className="w-2.5 h-2.5" />
                  ) : (
                    <TrendingDown className="w-2.5 h-2.5" />
                  )}
                  {delta.value}
                </span>
              )}

              {sub && (
                <span className="text-[11px] text-muted-foreground truncate" title={sub}>
                  {sub}
                </span>
              )}
            </div>
          </div>

          {/* Mini Sparkline Graph */}
          {sparklineData.length > 1 && (
            <div className="shrink-0 mb-1 opacity-70 group-hover:opacity-100 transition-opacity">
              <svg width={width} height={height} className="overflow-visible">
                <polyline
                  fill="none"
                  stroke={alert ? "#f97316" : delta?.isPositive ? "#10b981" : "#6366f1"}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={points}
                />
              </svg>
            </div>
          )}
        </div>
      </CardContent>

      {/* Bottom subtle accent line */}
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-primary/30 to-violet-500/30 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {cardContent}
      </Link>
    );
  }

  return <div className="h-full">{cardContent}</div>;
}
