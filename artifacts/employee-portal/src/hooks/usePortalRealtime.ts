/**
 * usePortalRealtime — subscribes the TanStack Query cache to the portal's
 * shared WebSocket (see lib/portal-socket.ts).
 *
 * `data_updated` / `SYNC_DATA` events invalidate the matching query keys, so
 * notifications, request status, documents and activities refresh the moment
 * the admin changes them. Replaces the old 15s/30s polling loops.
 */
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  invalidateAllPortal,
  invalidateForModule,
} from "../lib/portal-queries";
import {
  subscribePortalSocket,
  getPortalSocketStatus,
  type PortalSocketStatus,
} from "../lib/portal-socket";

export { getPortalWsEndpoint } from "../lib/portal-socket";
export type RealtimeStatus = PortalSocketStatus;

interface Options {
  /** Subscribe only once the user is authenticated. */
  enabled: boolean;
  /** Called for every non-chat data event, after invalidation (e.g. to play a sound). */
  onEvent?: (event: { module: string; action?: string; data?: any }) => void;
}

export function usePortalRealtime({
  enabled,
  onEvent,
}: Options): RealtimeStatus {
  const qc = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>(getPortalSocketStatus());
  // Latest-callback ref, updated in an effect (refs must not be written during render).
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled) return;
    let wasOnline = false;

    return subscribePortalSocket({
      onStatus: (next) => {
        setStatus(next);
        if (next === "online" && !wasOnline) {
          // Anything that changed while we were disconnected
          invalidateAllPortal(qc);
        }
        wasOnline = next === "online";
      },
      onMessage: (msg) => {
        if (msg.type === "SYNC_DATA") {
          invalidateAllPortal(qc);
          return;
        }
        // chat has its own handler (useTabChat); everything else maps to queries
        if (msg.module && msg.module !== "chat") {
          invalidateForModule(qc, String(msg.module));
          onEventRef.current?.({
            module: String(msg.module),
            action: msg.action,
            data: msg.data,
          });
        }
        if (msg.type === "notification") {
          invalidateForModule(qc, "notifications");
          onEventRef.current?.({
            module: "notifications",
            action: "push",
            data: msg.data,
          });
        }
      },
    });
  }, [enabled, qc]);

  return status;
}
