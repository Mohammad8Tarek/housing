// Load every row of a paginated list endpoint.
// Reports need complete datasets (totals, exports, print). A single
// `?limit=5000` request is silently capped by the server and would drop rows
// once a property outgrows it, so we read `pagination.total` and fetch the
// remaining pages in parallel.
import { customFetch } from "@workspace/api-client-react";

type ListResponse = {
  data?: unknown[];
  logs?: unknown[];
  pagination?: { total?: number | string };
  total?: number | string;
};

const MAX_PAGES = 200;

function rowsOf(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  const b = body as ListResponse | null;
  return (b?.data ?? b?.logs ?? []) as unknown[];
}

function totalOf(body: unknown): number | null {
  if (Array.isArray(body)) return null; // unpaginated endpoint: already complete
  const b = body as ListResponse | null;
  const t = Number(b?.pagination?.total ?? b?.total);
  return Number.isFinite(t) ? t : null;
}

/**
 * @param path     endpoint path, e.g. "/api/rooms"
 * @param params   query params (page/limit are set here)
 * @param pageSize must not exceed the endpoint's server-side limit cap
 */
export async function fetchAllPages<T = any>(
  path: string,
  params: Record<string, string | number | undefined>,
  pageSize: number,
): Promise<T[]> {
  const url = (page: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") qs.set(k, String(v));
    }
    qs.set("page", String(page));
    qs.set("limit", String(pageSize));
    return `${path}?${qs.toString()}`;
  };

  const first = await customFetch<unknown>(url(1));
  const rows = rowsOf(first);
  const total = totalOf(first);
  if (total === null || rows.length >= total || rows.length < pageSize) {
    return rows as T[];
  }

  const pages = Math.min(Math.ceil(total / pageSize), MAX_PAGES);
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, i) => customFetch<unknown>(url(i + 2))),
  );
  // Rows inserted while paging can shift an item onto two pages; keep the first copy.
  const seen = new Set<unknown>();
  return rows.concat(...rest.map(rowsOf)).filter((r: any) => {
    if (r?.id === undefined || r?.id === null) return true;
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  }) as T[];
}
