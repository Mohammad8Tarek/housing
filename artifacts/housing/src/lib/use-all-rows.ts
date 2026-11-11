// Complete helper lists (every room / profile / user of a property) for
// dropdowns, lookups and maps. The generated list hooks fetch one page, and the
// API caps the page size (users 100, buildings 1000, rooms/profiles 5000), so a
// `limit: 1000` call silently drops rows once a property outgrows it. This
// hook pages through the whole list instead.
//
// The query key starts with the endpoint path, like the generated hooks'
// (`["/api/rooms", params]`), so existing invalidations by path still refresh it.
// `data` keeps the API's `{ data, pagination }` envelope so call sites that
// unwrap a generated hook's result work unchanged; `rows` is the bare list.
import { useQuery } from "@tanstack/react-query";
import { fetchAllPages } from "./fetch-all-pages";

/** Largest page each endpoint accepts (its server-side cap). */
const PAGE_SIZE: Record<string, number> = {
  "/api/users": 100,
  "/api/buildings": 1000,
};
const DEFAULT_PAGE_SIZE = 1000;

export function useAllRows<T = any>(
  path: string,
  params: Record<string, string | number | undefined | null>,
  options: { enabled?: boolean; staleTime?: number } = {},
) {
  const clean: Record<string, string | number | undefined> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") clean[k] = v;
  }
  const query = useQuery({
    queryKey: [path, { ...clean, allPages: true }],
    queryFn: async () => {
      const data = await fetchAllPages<T>(
        path,
        clean,
        PAGE_SIZE[path] ?? DEFAULT_PAGE_SIZE,
      );
      return { data, pagination: { total: data.length } };
    },
    enabled: options.enabled ?? true,
    staleTime: options.staleTime,
  });
  return { ...query, rows: query.data?.data ?? [] };
}
