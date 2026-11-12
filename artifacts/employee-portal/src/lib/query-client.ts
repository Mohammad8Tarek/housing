/**
 * query-client.ts — the portal's single TanStack Query client + localStorage persister.
 *
 * Kept outside App.tsx so login/logout code can clear the cache: the persisted
 * cache is per device, and a different resident may sign in on the same phone.
 */
import { QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

export const PORTAL_CACHE_KEY = "SUNRISE_PORTAL_QUERY_CACHE";
/** Bump when cached data shapes change so stale entries are discarded. */
export const PORTAL_CACHE_BUSTER = "v2";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000, // data stays fresh 5 min
      gcTime: 24 * 60 * 60_000, // keep in memory 24 h (for persistence)
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

export const localStoragePersister = createSyncStoragePersister({
  storage: typeof window !== "undefined" ? window.localStorage : undefined,
  key: PORTAL_CACHE_KEY,
  throttleTime: 1000,
});

/** Drop every cached query (memory + persisted). Call on logout and after a new login. */
export function clearPortalQueryCache(): void {
  queryClient.clear();
  try {
    localStorage.removeItem(PORTAL_CACHE_KEY);
  } catch {
    /* storage unavailable */
  }
}
