// @ts-nocheck
/**
 * housing/src/hooks/use-websocket.ts
 *
 * Features:
 * 1. Handles both "SYNC_DATA" (invalidate all) and "data_updated" (module-specific)
 * 2. Exponential backoff reconnect (3s → 6s → 12s → max 30s)
 * 3. Returns isConnected status
 * 4. One connection per component lifecycle — no leaks
 * 5. Real-time Toast Notifications
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useProperty } from "@/context/PropertyContext";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";
import { createWebSocketUrl, resolveApiUrl } from "@/lib/api-origin";

const MODULE_QUERY_KEYS: Record<string, string[]> = {
  assignments: ["/api/assignments"],
  profiles: ["/api/profiles"],
  rooms: ["/api/rooms"],
  housekeeping: ["/api/rooms", "/api/maintenance"],
  maintenance: ["/api/maintenance"],
  reservations: ["/api/reservations"],
  hostings: ["/api/hostings"],
  "hosting-requests": ["/api/hosting-requests"],
  hosting_requests: ["/api/hosting-requests"],
  activities: ["/api/activities"],
  evaluations: ["/api/evaluations"],
  reports: ["/api/reports"],
  documents: ["/api/documents"],
  smart_locks: ["/api/encoder", "/api/locks", "/api/keys"],
  portal_content: [
    "/api/portal-categories",
    "/api/portal-schedule",
    "/api/portal-reports",
    "/api/portal-food",
  ],
  portal_categories: ["/api/portal-categories"],
  portal_tags: ["/api/portal-categories"],
  portal_notifications: ["/api/portal-notifications"],
  portal_food_transport: ["/api/portal-food"],
  portal_auth: ["/api/portal-auth"],
  profile_portal: ["/api/portal-data", "/api/portal-auth"],
  accommodation: [
    "/api/assignments",
    "/api/rooms",
    "/api/reservations",
    "/api/hostings",
    "/api/hosting-requests",
  ],
  notifications: ["/api/notifications"],
  dashboard: [
    "/api/dashboard/stats",
    "/api/dashboard/occupancy-by-building",
    "/api/dashboard/departure-alerts",
    "/api/dashboard/arrival-alerts",
    "/api/dashboard/recent-activity",
  ],
  buildings: ["/api/buildings"],
  floors: ["/api/floors"],
  users: ["/api/users"],
  settings: ["/api/settings"],
  properties: ["/api/properties"],
  activity_log: ["/api/activity-logs"],
};

const DASHBOARD_MODULES = new Set([
  "assignments",
  "rooms",
  "profiles",
  "housekeeping",
  "maintenance",
  "reservations",
  "hostings",
]);
const ALL_KEYS = Object.values(MODULE_QUERY_KEYS).flat();

export function useWebSocket(): { isConnected: boolean } {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { activePropertyId } = useProperty();
  const { language } = useLanguage();
  const ar = language === "ar";

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);
  const unmountingRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);

  // Use refs to avoid reconnecting WS when language/toast change
  const toastRef = useRef(toast);
  const arRef = useRef(ar);

  useEffect(() => {
    toastRef.current = toast;
    arRef.current = ar;
  }, [toast, ar]);

  const invalidateModule = useCallback(
    (module: string) => {
      const keys = MODULE_QUERY_KEYS[module] ?? [];
      const allKeys = [...keys];
      if (DASHBOARD_MODULES.has(module)) {
        allKeys.push(...MODULE_QUERY_KEYS.dashboard!);
      }

      console.info(`[WS] Invalidating module: ${module}`, { keys: allKeys });

      queryClient.invalidateQueries({
        predicate: (query) => {
          const first = query.queryKey[0];
          if (typeof first !== "string") return false;
          return allKeys.some((k) => first === k || first.startsWith(`${k}/`));
        },
        refetchType: "active",
      });
      queryClient.invalidateQueries({
        type: "active",
        refetchType: "active",
      });
    },
    [queryClient],
  );

  const invalidateAll = useCallback(() => {
    console.info("[WS] Invalidating ALL queries");
    queryClient.invalidateQueries({
      type: "active",
      refetchType: "active",
    });
  }, [queryClient]);

  const connect = useCallback(async () => {
    const currentUserId = user?.id;
    const currentPropertyId = activePropertyId;

    if (!currentUserId || !currentPropertyId) {
      console.info("[WS] Skipping connect — user or propertyId not ready:", {
        userId: currentUserId,
        propertyId: currentPropertyId,
      });
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.info("[WS] Already connected, skipping");
      return;
    }

    const wsParams = new URLSearchParams({
      propertyId: String(currentPropertyId),
    });

    try {
      const tokenRes = await fetch(
        resolveApiUrl(`/api/auth/ws-token?propertyId=${currentPropertyId}`),
        { credentials: "include" },
      );
      if (tokenRes.ok) {
        const tokenJson = await tokenRes.json();
        if (tokenJson?.token) wsParams.set("token", tokenJson.token);
      } else {
        console.warn("[WS] Failed to issue auth token:", tokenRes.status);
      }
    } catch (err) {
      console.warn("[WS] Failed to fetch auth token:", err);
    }

    if (unmountingRef.current) return;

    const wsUrl = createWebSocketUrl(
      "/ws",
      wsParams,
    );

    console.info("[WS] Attempting connection:", wsUrl.replace(/\?.*/, "?***"));

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        attemptsRef.current = 0;
        console.info("[WS] ✅ Connected successfully");
      };

      ws.onmessage = ({ data }) => {
        try {
          const msg = JSON.parse(data as string);
          console.info(
            "[WS] 📩 Message received:",
            msg.type,
            "| module:",
            msg.module,
            "| action:",
            msg.action,
          );

          if (msg.type === "SYNC_DATA") {
            console.info("[WS] 🔄 SYNC_DATA — invalidating all queries");
            invalidateAll();
          } else if (msg.type === "notification" && msg.data) {
            const targetUserId = Number(msg.data.targetUserId);
            const isForCurrentUser = !targetUserId || targetUserId === user?.id;

            if (!isForCurrentUser) {
              console.info(
                "[WS] 🔕 Notification filtered out for another user",
                {
                  targetUserId,
                  currentUserId: user?.id,
                },
              );
              return;
            }

            console.info("[WS] 🔔 New Custom Notification Received");
            toastRef.current(
              arRef.current ? msg.data.titleAr || msg.data.title : msg.data.title,
              {
                description: arRef.current
                  ? msg.data.messageAr || msg.data.message
                  : msg.data.message,
              }
            );
            invalidateModule("notifications");
          } else if (msg.module || msg.type === "data_updated") {
            const targetMod = msg.module || "all";
            console.info(
              `[WS] 🔔 ${targetMod}/${msg.action} — invalidating`,
            );
            if (msg.module) {
              invalidateModule(msg.module as string);
            } else {
              invalidateAll();
            }

            // Show toast for specific module events
            if (msg.action === "created") {
              let tTitle = "";
              let tDesc = "";
              if (msg.module === "maintenance") {
                tTitle = arRef.current
                  ? "تذكرة صيانة جديدة"
                  : "New Maintenance Ticket";
                tDesc = arRef.current
                  ? "تم إنشاء تذكرة صيانة جديدة."
                  : "A new maintenance ticket was created.";
              } else if (msg.module === "assignments") {
                tTitle = arRef.current ? "تسكين جديد" : "New Assignment";
                tDesc = arRef.current
                  ? "تم تسكين موظف جديد."
                  : "A new profile assignment was created.";
              } else if (msg.module === "reservations") {
                tTitle = arRef.current ? "حجز جديد" : "New Reservation";
                tDesc = arRef.current
                  ? "تم إضافة حجز جديد."
                  : "A new reservation was added.";
              }
              if (tTitle) {
                toastRef.current(tTitle, { description: tDesc });
              }
            } else if (msg.action === "updated") {
              if (msg.module === "maintenance") {
                toastRef.current(
                  arRef.current
                    ? "تحديث في تذكرة صيانة"
                    : "Maintenance Ticket Updated",
                  {
                    description: arRef.current
                      ? "تم تحديث تذكرة صيانة."
                      : "A maintenance ticket was updated.",
                  }
                );
              } else if (msg.module === "assignments") {
                toastRef.current(
                  arRef.current ? "تحديث التسكين" : "Assignment Updated",
                  {
                    description: arRef.current
                      ? "تم تحديث بيانات التسكين."
                      : "An profile assignment was updated.",
                  }
                );
              }
            }
          }
        } catch (e) {
          console.error("[WS] ❌ Failed to parse message:", e);
        }
      };

      ws.onclose = (ev) => {
        setIsConnected(false);
        wsRef.current = null;
        console.info(`[WS] Connection closed (code: ${ev.code})`);

        if (unmountingRef.current || ev.code === 1008) return;

        attemptsRef.current++;
        const delay = Math.min(3_000 * 2 ** (attemptsRef.current - 1), 30_000);
        console.info(
          `[WS] Will reconnect in ${delay}ms (attempt #${attemptsRef.current})`,
        );
        reconnectRef.current = setTimeout(connect, delay);
      };

      ws.onerror = (err) => {
        console.error("[WS] ❌ WebSocket error:", err);
      };

      const pingId = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 25_000);

      ws.addEventListener("close", () => clearInterval(pingId));
    } catch (err) {
      console.error("[WS] ❌ Failed to create WebSocket:", err);
    }
  }, [user?.id, activePropertyId, invalidateModule, invalidateAll]);

  useEffect(() => {
    unmountingRef.current = false;
    attemptsRef.current = 0;
    connect();

    return () => {
      unmountingRef.current = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close(1000, "Component unmounted");
    };
  }, [connect]);

  return { isConnected };
}
