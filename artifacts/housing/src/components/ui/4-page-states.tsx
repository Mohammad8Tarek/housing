import React from "react";
import { AlertCircle, RefreshCw, WifiOff, Database, FileX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
// ErrorState — shown when an API call fails
// ─────────────────────────────────────────────────────────────
interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ message, onRetry, className }: ErrorStateProps) {
  const isNetworkError =
    message?.toLowerCase().includes("network") ||
    message?.toLowerCase().includes("fetch") ||
    message?.toLowerCase().includes("failed to fetch");

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 text-center gap-4",
        className,
      )}
    >
      <div className="rounded-full bg-destructive/10 p-4">
        {isNetworkError ? (
          <WifiOff className="w-8 h-8 text-destructive opacity-80" />
        ) : (
          <AlertCircle className="w-8 h-8 text-destructive opacity-80" />
        )}
      </div>
      <div>
        <h3 className="font-semibold text-base mb-1">
          {isNetworkError ? "تعذر الاتصال بالسيرفر" : "حدث خطأ غير متوقع"}
        </h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {message || "تعذر تحميل البيانات. يرجى المحاولة مرة أخرى."}
        </p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          إعادة المحاولة
        </Button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// EmptyState — shown when query succeeds but returns no data
// ─────────────────────────────────────────────────────────────
interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 text-center gap-4",
        className,
      )}
    >
      <div className="rounded-full bg-muted p-4">
        {icon || <FileX className="w-8 h-8 text-muted-foreground opacity-60" />}
      </div>
      <div>
        <h3 className="font-semibold text-base mb-1">
          {title || "لا توجد بيانات"}
        </h3>
        {description && (
          <p className="text-sm text-muted-foreground max-w-xs">
            {description}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TableSkeleton — shown while table data loads
// ─────────────────────────────────────────────────────────────
interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function TableSkeleton({
  rows = 5,
  columns = 4,
  className,
}: TableSkeletonProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="flex gap-4 px-4 py-2 bg-muted/40 rounded-lg">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex gap-4 px-4 py-3 border-b border-border/50 last:border-0"
        >
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton
              key={j}
              className={cn(
                "h-4 flex-1",
                j === 0 && "w-8 flex-none",
                j === columns - 1 && "w-20 flex-none",
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CardSkeleton — shown while card-based data loads
// ─────────────────────────────────────────────────────────────
interface CardSkeletonProps {
  count?: number;
  className?: string;
}

export function CardSkeleton({ count = 3, className }: CardSkeletonProps) {
  return (
    <div
      className={cn(
        "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PageHeaderSkeleton — page title + subtitle + action buttons
// ─────────────────────────────────────────────────────────────
export function PageHeaderSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4",
        className,
      )}
    >
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// StatsGridSkeleton — KPI stat cards row
// ─────────────────────────────────────────────────────────────
interface StatsGridSkeletonProps {
  count?: number;
  className?: string;
}

export function StatsGridSkeleton({
  count = 4,
  className,
}: StatsGridSkeletonProps) {
  return (
    <div className={cn("grid gap-4 grid-cols-2 lg:grid-cols-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="w-9 h-9 rounded-lg" />
          </div>
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ListSkeleton — list rows with a leading icon/avatar
// ─────────────────────────────────────────────────────────────
interface ListSkeletonProps {
  rows?: number;
  className?: string;
}

export function ListSkeleton({ rows = 4, className }: ListSkeletonProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border bg-card p-4"
        >
          <Skeleton className="w-10 h-10 rounded-full flex-none" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full flex-none" />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// FormSkeleton — labeled form fields inside a card
// ─────────────────────────────────────────────────────────────
interface FormSkeletonProps {
  fields?: number;
  className?: string;
}

export function FormSkeleton({ fields = 6, className }: FormSkeletonProps) {
  return (
    <div className={cn("rounded-xl border bg-card p-6 space-y-6", className)}>
      <div className="space-y-2">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-3 w-64 max-w-full" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DetailSkeleton — back button + identity header + content cards
// ─────────────────────────────────────────────────────────────
export function DetailSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)}>
      <Skeleton className="h-8 w-24" />
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="w-16 h-16 rounded-full flex-none" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-56 max-w-full" />
            <Skeleton className="h-4 w-40" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/6" />
          <Skeleton className="h-4 w-3/6" />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ChartSkeleton — chart card with a donut placeholder + legend
// ─────────────────────────────────────────────────────────────
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card p-5 space-y-4", className)}>
      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-56 max-w-full" />
      </div>
      <div className="flex justify-center py-2">
        <Skeleton className="w-40 h-40 rounded-full" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="w-3 h-3 rounded-full flex-none" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-3 w-10 flex-none" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PageSkeleton — full page: header + KPI stats + table
// ─────────────────────────────────────────────────────────────
export function PageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)}>
      <PageHeaderSkeleton />
      <StatsGridSkeleton />
      <TableSkeleton rows={6} columns={5} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// InlineLoader — small spinner for inline loading
// ─────────────────────────────────────────────────────────────
export function InlineLoader({ message }: { message?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-8 text-muted-foreground text-sm">
      <RefreshCw className="w-4 h-4 animate-spin" />
      <span>{message || "جاري التحميل..."}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DBErrorState — specifically for database connectivity issues
// ─────────────────────────────────────────────────────────────
export function DBErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
      <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-4">
        <Database className="w-8 h-8 text-amber-600 dark:text-amber-400" />
      </div>
      <div>
        <h3 className="font-semibold text-base mb-1">
          تعذر الاتصال بقاعدة البيانات
        </h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          السيرفر يواجه مشكلة مؤقتة. تأكد من أن قاعدة البيانات تعمل بشكل صحيح.
        </p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          إعادة المحاولة
        </Button>
      )}
    </div>
  );
}
