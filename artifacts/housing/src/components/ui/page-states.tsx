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
