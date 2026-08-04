// @ts-nocheck
import type { PaginationMeta } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface PaginationBarProps {
  pagination: PaginationMeta;
  isFetching?: boolean;
  onPageChange: (page: number) => void;
}

export function PaginationBar({
  pagination,
  isFetching,
  onPageChange,
}: PaginationBarProps) {
  const { language } = useLanguage();
  const ar = language === "ar";

  const { page, totalPages, total, limit } = pagination;
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  if (total === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-4 border-t mt-4 text-sm text-muted-foreground">
      <span>
        {isFetching 
          ? (ar ? "جاري التحميل..." : "Loading...") 
          : (ar ? `عرض ${start} إلى ${end} من أصل ${total} سجل` : `${start}-${end} of ${total} records`)}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={!pagination.hasPrevPage || isFetching}
          className="gap-1"
        >
          {ar ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {ar ? "السابق" : "Previous"}
        </Button>
        <span className="font-medium text-foreground mx-2 text-sm">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={!pagination.hasNextPage || isFetching}
          className="gap-1"
        >
          {ar ? "التالي" : "Next"}
          {ar ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
