import type { PaginationMeta } from "@workspace/api-client-react";
import { DataPagination } from "@/components/DataPagination";

interface PaginationBarProps {
  pagination: PaginationMeta;
  isFetching?: boolean;
  onPageChange: (page: number) => void;
}

export function PaginationBar({
  pagination,
  onPageChange,
}: PaginationBarProps) {
  const { page, total, limit } = pagination;

  return (
    <DataPagination
      total={total}
      pageSize={limit}
      currentPage={page}
      onPageChange={onPageChange}
    />
  );
}
