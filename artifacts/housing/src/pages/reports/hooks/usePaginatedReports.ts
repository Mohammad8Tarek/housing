import { useQuery } from "@tanstack/react-query";

export function usePaginatedReports(params: {
  propertyId?: number;
  tab: string;
  page: number;
  limit: number;
  search: string;
}) {
  return useQuery({
    queryKey: ["paginated-reports", params],
    queryFn: async () => {
      const qs = new URLSearchParams({
        tab: params.tab,
        page: String(params.page),
        limit: String(params.limit),
        search: params.search,
      });
      if (params.propertyId) {
        qs.append("propertyId", String(params.propertyId));
      }
      const res = await fetch(`/api/reports?${qs.toString()}`, {
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) throw new Error("Failed to fetch reports");
      return res.json();
    },
  });
}
