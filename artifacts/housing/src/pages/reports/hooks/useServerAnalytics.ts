// Analytics tab KPIs/breakdowns, computed by the API (GET /api/reports/analytics)
// from the property's lists, so the page needs no profile/stay/ticket lists.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { computeReportAnalytics, type ReportAnalytics } from "@workspace/report-rows";

const BROWSER_TIME_ZONE = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
})();

// Shape-complete placeholders (zeros) until the first response arrives.
const EMPTY = {
  ar: computeReportAnalytics({ ar: true, rooms: [], assignments: [], profiles: [], buildings: [], floors: [], maintenance: [], reservations: [], hostings: [] }),
  en: computeReportAnalytics({ ar: false, rooms: [], assignments: [], profiles: [], buildings: [], floors: [], maintenance: [], reservations: [], hostings: [] }),
};

export function useServerAnalytics({
  enabled,
  propId,
  ar,
  filterBuilding,
  filterFloor,
}: {
  enabled: boolean;
  propId: number | undefined;
  ar: boolean;
  filterBuilding: string;
  filterFloor: string;
}) {
  const qs = new URLSearchParams({ propertyId: String(propId ?? ""), lang: ar ? "ar" : "en" });
  if (filterBuilding && filterBuilding !== "all") qs.set("filterBuilding", filterBuilding);
  if (filterFloor && filterFloor !== "all") qs.set("filterFloor", filterFloor);
  if (BROWSER_TIME_ZONE) qs.set("tz", BROWSER_TIME_ZONE);

  const query = useQuery({
    queryKey: ["report-analytics", qs.toString()],
    queryFn: () => customFetch<ReportAnalytics>(`/api/reports/analytics?${qs}`),
    enabled: enabled && !!propId,
    placeholderData: keepPreviousData,
  });

  const result = query.data ?? (ar ? EMPTY.ar : EMPTY.en);
  return { stats: result.stats, analytics: result.analytics, isLoading: query.isLoading };
}
