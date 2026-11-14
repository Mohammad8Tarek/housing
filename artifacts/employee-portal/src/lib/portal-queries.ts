/**
 * portal-queries.ts — Single source of truth for portal data fetching.
 *
 * Every tab reads through these TanStack Query hooks instead of ad-hoc
 * apiFetch + useEffect. Benefits: instant render from the persisted cache
 * (works offline), request de-duplication across tabs, background refresh,
 * and one place to invalidate when a WebSocket event arrives.
 */
import {
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { apiFetch } from "./api";

// ─── Query keys ──────────────────────────────────────────────────────────────
export const portalKeys = {
  me: ["portal", "me"] as const,
  myProfile: ["portal", "my-profile"] as const,
  myRoom: ["portal", "my-room"] as const,
  roommates: ["portal", "roommates"] as const,
  maintenance: ["portal", "my-maintenance"] as const,
  // "portal/notifications" is already used by the generated api-client hook (different payload)
  notifications: ["portal", "my-notifications"] as const,
  documents: ["portal", "documents"] as const,
  evaluations: ["portal", "my-evaluations"] as const,
  activities: ["portal", "my-activities"] as const,
  catalog: ["portal", "catalog"] as const,
  myContacts: ["portal", "my-contacts"] as const,
  supportContacts: ["portal", "support-contacts"] as const,
  housingRatingStatus: ["portal", "housing-rating-status"] as const,
  gatePass: (code: string | number | undefined) =>
    ["portal", "gate-pass", code ?? "me"] as const,
  foodMenu: (date: string) => ["portal", "food-menu", date] as const,
  myOrders: ["portal", "my-orders"] as const,
  transportSchedules: ["portal", "transport-schedules"] as const,
  myBookings: ["portal", "my-bookings"] as const,
  conversations: ["portal", "conversations"] as const,
};

// ─── Fetch helper ────────────────────────────────────────────────────────────
export class PortalApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** GET a portal endpoint and return the parsed JSON. Throws PortalApiError on non-2xx. */
export async function portalGet<T = any>(path: string): Promise<T> {
  const res = await apiFetch(path, { credentials: "include" });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body?.message || body?.error || message;
    } catch {
      /* non-JSON body */
    }
    throw new PortalApiError(res.status, message);
  }
  return (await res.json()) as T;
}

/** POST/PUT/PATCH/DELETE JSON to a portal endpoint. Returns parsed JSON, throws on non-2xx. */
export async function portalSend<T = any>(
  path: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const res = await apiFetch(path, {
    method,
    credentials: "include",
    headers:
      body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    throw new PortalApiError(
      res.status,
      data?.message || data?.error || `HTTP ${res.status}`,
    );
  }
  return data as T;
}

/** Never retry auth failures; otherwise retry once (mobile networks flake). */
function retryPolicy(failureCount: number, error: unknown): boolean {
  if (
    error instanceof PortalApiError &&
    (error.status === 401 || error.status === 403)
  )
    return false;
  return failureCount < 1;
}

type Opts<T> = Omit<UseQueryOptions<T, Error, T, any>, "queryKey" | "queryFn">;

function usePortalQuery<T>(
  key: readonly unknown[],
  fetcher: () => Promise<T>,
  opts?: Opts<T>,
) {
  return useQuery<T, Error, T, any>({
    queryKey: key,
    queryFn: fetcher,
    retry: retryPolicy,
    ...opts,
  });
}

// ─── Shapes ──────────────────────────────────────────────────────────────────
export interface MaintenanceRequest {
  id: number;
  category?: string;
  problemType?: string;
  description?: string;
  priority?: string;
  status?: string;
  photoUrl?: string | null;
  rating?: number | null;
  ratingComment?: string | null;
  assignedTo?: string | null;
  workerName?: string | null;
  reportedAt?: string | null;
  startedAt?: string | null;
  resolvedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface PortalNotification {
  id: number;
  title: string;
  titleAr?: string | null;
  message: string;
  messageAr?: string | null;
  type?: string;
  priority?: string;
  isRead?: boolean;
  createdAt: string;
  [key: string]: unknown;
}

export interface NotificationsPayload {
  notifications: PortalNotification[];
  unreadCount: number;
}

export interface MyRoomPayload {
  success: boolean;
  assignment?: Record<string, any> | null;
  room?: Record<string, any> | null;
  building?: Record<string, any> | null;
  floor?: Record<string, any> | null;
  property?: Record<string, any> | null;
  roommates?: Record<string, any>[];
  [key: string]: unknown;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────
export function useMe(enabled = true) {
  return usePortalQuery(portalKeys.me, () => portalGet("/api/portal-auth/me"), {
    enabled,
    staleTime: 60_000,
  });
}

export function useMyProfile(enabled = true) {
  return usePortalQuery(
    portalKeys.myProfile,
    () => portalGet("/api/portal-data/my-profile"),
    { enabled },
  );
}

export function useMyRoom(enabled = true) {
  return usePortalQuery<MyRoomPayload>(
    portalKeys.myRoom,
    () => portalGet("/api/portal-data/my-room"),
    { enabled },
  );
}

export function useRoommates(enabled = true) {
  return usePortalQuery(
    portalKeys.roommates,
    async () => {
      const d = await portalGet("/api/portal-data/roommates");
      return {
        roommates: (d?.roommates || []) as Record<string, any>[],
        room: (d?.room ?? null) as Record<string, any> | null,
      };
    },
    { enabled },
  );
}

export function useMyMaintenance(enabled = true) {
  return usePortalQuery<MaintenanceRequest[]>(
    portalKeys.maintenance,
    async () => {
      const d = await portalGet("/api/portal-data/my-maintenance");
      return Array.isArray(d) ? d : d?.requests || [];
    },
    { enabled },
  );
}

const DONE_STATUSES = ["resolved", "closed", "completed", "done"];
const OPEN_STATUSES = ["open", "in_progress", "pending", "assigned"];

export function isRequestDone(r: MaintenanceRequest): boolean {
  return DONE_STATUSES.includes(String(r.status || "").toLowerCase());
}
export function isRequestOpen(r: MaintenanceRequest): boolean {
  return OPEN_STATUSES.includes(String(r.status || "").toLowerCase());
}

export function useNotifications(enabled = true) {
  return usePortalQuery<NotificationsPayload>(
    portalKeys.notifications,
    async () => {
      const d = await portalGet("/api/portal-notifications/my");
      return {
        notifications: (d?.notifications || []) as PortalNotification[],
        unreadCount: Number(d?.unreadCount || 0),
      };
    },
    { enabled },
  );
}

export function useDocuments(enabled = true) {
  return usePortalQuery<Record<string, unknown>[]>(
    portalKeys.documents,
    async () => {
      const d = await portalGet("/api/portal-data/documents");
      return Array.isArray(d) ? d : d?.documents || [];
    },
    { enabled },
  );
}

export function useEvaluations(enabled = true) {
  return usePortalQuery<Record<string, unknown>[]>(
    portalKeys.evaluations,
    async () => {
      const d = await portalGet("/api/portal-data/my-evaluations");
      return Array.isArray(d) ? d : d?.evaluations || [];
    },
    { enabled },
  );
}

export function useMyActivities(enabled = true) {
  return usePortalQuery<Record<string, any>[]>(
    portalKeys.activities,
    async () => {
      const d = await portalGet("/api/portal-data/my-activities");
      return Array.isArray(d) ? d : d?.activities || [];
    },
    { enabled },
  );
}

export function useCatalog(enabled = true) {
  return usePortalQuery(
    portalKeys.catalog,
    () => portalGet("/api/portal-data/catalog"),
    {
      enabled,
      staleTime: 30 * 60_000,
    },
  );
}

export function useMyContacts(enabled = true) {
  return usePortalQuery<Record<string, any>[]>(
    portalKeys.myContacts,
    async () => {
      const d = await portalGet("/api/portal-data/my-contacts");
      return Array.isArray(d) ? d : d?.contacts || [];
    },
    { enabled, staleTime: 10 * 60_000 },
  );
}

export function useSupportContacts(enabled = true) {
  return usePortalQuery<Record<string, any>[]>(
    portalKeys.supportContacts,
    async () => {
      const d = await portalGet("/api/portal-data/support-contacts");
      return ((d?.contacts || []) as Record<string, any>[]).filter(
        (c) => c.name || c.phone || c.email,
      );
    },
    { enabled, staleTime: 10 * 60_000 },
  );
}

export function useHousingRatingStatus(enabled = true) {
  return usePortalQuery(
    portalKeys.housingRatingStatus,
    () => portalGet("/api/portal-data/housing-rating-status"),
    {
      enabled,
    },
  );
}

export function useGatePass(
  empCode: string | number | undefined,
  enabled = true,
) {
  return usePortalQuery(
    portalKeys.gatePass(empCode),
    async () => {
      const d = await portalGet(
        empCode ? `/api/gate/pass/${empCode}` : "/api/gate/pass/me",
      );
      return d?.gatePass ?? null;
    },
    { enabled, staleTime: 5 * 60_000 },
  );
}

export function useFoodMenu(date: string, enabled = true) {
  return usePortalQuery<Record<string, any>[]>(
    portalKeys.foodMenu(date),
    async () => {
      const d = await portalGet(
        `/api/portal-food/menu?date=${date}&type=daily`,
      );
      return d?.items || [];
    },
    { enabled },
  );
}

export function useMyOrders(enabled = true) {
  return usePortalQuery<Record<string, any>[]>(
    portalKeys.myOrders,
    async () => (await portalGet("/api/portal-food/my-orders"))?.orders || [],
    { enabled },
  );
}

export function useTransportSchedules(enabled = true) {
  return usePortalQuery<Record<string, any>[]>(
    portalKeys.transportSchedules,
    async () =>
      (await portalGet("/api/portal-food/schedules"))?.schedules || [],
    { enabled },
  );
}

export function useMyBookings(enabled = true) {
  return usePortalQuery<Record<string, any>[]>(
    portalKeys.myBookings,
    async () =>
      (await portalGet("/api/portal-food/my-bookings"))?.bookings || [],
    { enabled },
  );
}

// ─── Invalidation helpers ────────────────────────────────────────────────────
/** Maps a WebSocket `module` to the query keys that depend on it. */
export const MODULE_TO_KEYS: Record<string, readonly (readonly unknown[])[]> = {
  notifications: [portalKeys.notifications],
  maintenance: [portalKeys.maintenance],
  documents: [portalKeys.documents],
  activities: [portalKeys.activities],
  evaluations: [portalKeys.evaluations],
  rooms: [portalKeys.myRoom, portalKeys.roommates],
  assignments: [
    portalKeys.myRoom,
    portalKeys.roommates,
    portalKeys.gatePass(undefined),
  ],
  profiles: [portalKeys.myProfile, portalKeys.me, portalKeys.roommates],
  food: [portalKeys.myOrders],
  transport: [portalKeys.transportSchedules, portalKeys.myBookings],
  settings: [
    portalKeys.supportContacts,
    portalKeys.myContacts,
    portalKeys.housingRatingStatus,
  ],
  dashboard: [portalKeys.maintenance, portalKeys.notifications],
};

export function invalidateForModule(qc: QueryClient, module: string): void {
  const keys = MODULE_TO_KEYS[module];
  if (!keys) return;
  for (const key of keys) {
    // gate-pass key is a prefix; invalidate by prefix for all
    qc.invalidateQueries({ queryKey: key.slice(0, 3) as unknown[] });
  }
}

/** Invalidate everything portal-related (pull-to-refresh, reconnect, SYNC_DATA). */
export function invalidateAllPortal(qc: QueryClient): Promise<void> {
  return qc.invalidateQueries({ queryKey: ["portal"] });
}

export function usePortalInvalidate() {
  const qc = useQueryClient();
  return {
    module: (m: string) => invalidateForModule(qc, m),
    all: () => invalidateAllPortal(qc),
    keys: (...keys: readonly (readonly unknown[])[]) =>
      Promise.all(
        keys.map((k) => qc.invalidateQueries({ queryKey: k as unknown[] })),
      ),
  };
}
