// @ts-nocheck
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface PaginationProps {
  total: number;
  pageSize: number;
  onPageSizeChange?: (size: number) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
}

export function DataPagination({
  total,
  pageSize,
  onPageSizeChange,
  currentPage,
  onPageChange,
}: PaginationProps) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const totalPages = Math.ceil(total / pageSize);
  const startRecord = (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, total);

  if (total === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t px-4 py-3 text-sm">
      <div className="flex items-center gap-3">
        {onPageSizeChange && (
          <>
            <span className="text-muted-foreground">
              {ar ? "عرض المُدخلات:" : "Show entries:"}
            </span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => onPageSizeChange(Number(v))}
            >
              <SelectTrigger className="w-20 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="15">15</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      <span className="text-muted-foreground text-xs sm:text-sm">
        {ar
          ? `عرض ${startRecord} إلى ${endRecord} من ${total} سجل`
          : `Showing ${startRecord} to ${endRecord} of ${total} records`}
      </span>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="h-8 px-2"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <div className="flex items-center gap-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => {
              const diff = Math.abs(p - currentPage);
              return diff === 0 || diff === 1 || p === 1 || p === totalPages;
            })
            .map((page, idx, arr) => (
              <div key={page}>
                {idx > 0 && arr[idx - 1] !== page - 1 && (
                  <span className="px-1 text-muted-foreground">...</span>
                )}
                <Button
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPageChange(page)}
                  className="h-8 w-8 p-0"
                >
                  {page}
                </Button>
              </div>
            ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="h-8 px-2"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
