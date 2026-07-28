// @ts-nocheck
import type { PaginationMeta } from "@workspace/api-client-react";

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
  const { page, totalPages, total, limit } = pagination;
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 0",
        borderTop: "1px solid var(--border, #e5e7eb)",
        marginTop: "8px",
        fontSize: "14px",
        color: "var(--text-secondary, #6b7280)",
      }}
    >
      <span>
        {isFetching ? "Loading..." : `${start}–${end} of ${total} records`}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={!pagination.hasPrevPage || isFetching}
          style={{
            padding: "4px 12px",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          ← Prev
        </button>
        <span style={{ fontWeight: 500, color: "var(--text-primary, #111)" }}>
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={!pagination.hasNextPage || isFetching}
          style={{
            padding: "4px 12px",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
